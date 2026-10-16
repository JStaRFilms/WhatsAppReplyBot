import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate as ioTurn } from 'node:timers/promises';
import { SqliteStore, Workflow, type Message } from '@replybot/core';
import type { WAMessage } from '@whiskeysockets/baileys';
import { WhatsAppAdapter } from '../src/whatsapp.ts';

const owner = '15550000999@s.whatsapp.net';
const chat = '15550000001@s.whatsapp.net';
const raws = (count: number): WAMessage[] => Array.from({ length: count }, (_, i) => ({
  key: { remoteJid: chat, id: 'synthetic-'+i, fromMe: false },
  messageTimestamp: 1, message: { conversation: 'Invented history '+i },
}));
async function fixture() {
  const auth = mkdtempSync(join(tmpdir(), 'otherme-synthetic-yield-'));
  writeFileSync(join(auth, 'owner-identity.json'), JSON.stringify({ owner }));
  const store = new SqliteStore();
  const flow = new Workflow(store, 'a', () => 1000);
  const adapter = new WhatsAppAdapter(flow, auth, async () => assert.fail('backfill must not invoke AI'), undefined, () => 1000, true);
  let ev = new EventEmitter();
  Object.defineProperties(adapter, {
    loadAuth: { value: async () => ({ state: { creds: { me: { id: owner } }, keys: {} }, saveCreds: async () => {} }) },
    makeSocket: { value: () => ({ ev, user: { id: owner }, end() {} }) },
  });
  await adapter.start(); ev.emit('connection.update', { connection: 'open' });
  return { store, flow, adapter, ev, replace: async () => {
    // Replace through start after invalidating this socket, without a reconnect timer.
    adapter['socket'] = undefined;
    adapter['verifiedSocket'] = undefined;
    adapter['status'].state = 'disconnected';
    ev = new EventEmitter(); await adapter.start(); ev.emit('connection.update', { connection: 'open' });
    return ev;
  }, dispose: async () => { await adapter.stop(); store.close(); rmSync(auth, { recursive: true, force: true }); } };
}

for (const event of ['messaging-history.set', 'messages.upsert'] as const) for (const queued of [false, true]) {
  test(`actual ${event} listener admits I/O before ${queued ? 'queued single-message events' : 'one large batch'} completes`, async () => {
    const f = await fixture(); const seen: string[] = []; const sources: Message['source'][] = [];
    let atIO = -1; let io: Promise<void> = Promise.resolve();
    // Keep the scheduler regression independent of SQLite speed and machine load.
    Object.defineProperty(f.adapter, 'receive', { value: async (raw: WAMessage, source: Message['source']) => {
      seen.push(raw.key.id ?? ''); sources.push(source);
      if (seen.length === 1) io = ioTurn().then(() => { atIO = seen.length; });
    } });
    try {
      const messages = raws(96);
      const emit = (batch: WAMessage[]) => f.ev.emit(event, event === 'messaging-history.set'
        ? { contacts: [], messages: batch } : { type: 'append', messages: batch });
      if (queued) for (const raw of messages) emit([raw]);
      else emit(messages);
      await f.adapter['events']; await io;
      assert.ok(atIO > 0 && atIO <= 32, `I/O observed ${atIO}/${messages.length} processed`);
      assert.deepEqual(seen, messages.map(raw => raw.key.id));
      assert.ok(sources.every(source => source === (event === 'messaging-history.set' ? 'backfill' : 'replay')));
      assert.equal(f.adapter.snapshot().error, null);
    } finally { await f.dispose(); }
  });
}

test('history scheduler also yields on elapsed work before reaching the item budget', async t => {
  const f = await fixture(); let now = 0; let seen = 0; let atIO = -1; let io: Promise<void> = Promise.resolve();
  t.mock.method(performance, 'now', () => now);
  Object.defineProperty(f.adapter, 'receive', { value: async () => {
    seen++; now += 3;
    if (seen === 1) io = ioTurn().then(() => { atIO = seen; });
  } });
  try {
    f.ev.emit('messaging-history.set', { contacts: [], messages: raws(96) });
    await f.adapter['events']; await io;
    assert.equal(atIO, 3); assert.equal(seen, 96);
  } finally { await f.dispose(); }
});

for (const event of ['contacts.upsert', 'contacts.update', 'messaging-history.set'] as const) {
  test(`${event} yields during contact mappings and keeps names after history`, async () => {
    const f = await fixture(); const seen: string[] = []; let atIO = -1; let io: Promise<void> = Promise.resolve();
    Object.defineProperty(f.adapter, 'canonical', { value: (jid: string) => {
      seen.push(jid);
      if (seen.length === 1) io = ioTurn().then(() => { atIO = seen.length; });
      return jid;
    } });
    try {
      const contacts = Array.from({ length: 96 }, (_, i) => ({ id: (15550001000+i)+'@s.whatsapp.net', name: 'Invented '+i }));
      f.ev.emit(event, event === 'messaging-history.set' ? { contacts, messages: [] } : contacts);
      await f.adapter['events']; await io;
      assert.ok(atIO > 0 && atIO <= 32, `I/O observed ${atIO}/${contacts.length} mappings`);
      const ids = contacts.map(contact => contact.id);
      assert.deepEqual(seen, event === 'messaging-history.set' ? [...ids, ...ids] : ids);
      assert.deepEqual(f.store.conversations('a'), [], 'names must not establish chats');
    } finally { await f.dispose(); }
  });
}

for (const event of ['contacts.upsert', 'contacts.update', 'messaging-history.set'] as const) {
  test(`${event} drops remaining contact work when sealed during a yield`, async t => {
    const f = await fixture(); let mapped = 0; let atIO = -1; let io: Promise<void> = Promise.resolve();
    const verify = f.flow.verifyAlias.bind(f.flow);
    t.mock.method(f.flow, 'verifyAlias', (...args: Parameters<Workflow['verifyAlias']>) => {
      verify(...args); mapped++;
      if (mapped === 1) io = ioTurn().then(() => { atIO = mapped; f.adapter['sealed'] = true; });
    });
    try {
      const contacts = Array.from({ length: 96 }, (_, i) => ({ id: (1000+i)+'@lid', phoneNumber: (15550001000+i)+'@s.whatsapp.net' }));
      f.ev.emit(event, event === 'messaging-history.set' ? { contacts, messages: raws(1) } : contacts);
      await f.adapter['events']; await io;
      assert.ok(atIO > 0 && atIO <= 32); assert.equal(mapped, atIO);
      assert.equal(f.store.waCanonical('a', '1095@lid'), '1095@lid');
      assert.equal(f.store.messages('a', chat).length, 0);
      assert.equal(f.adapter.snapshot().error, null);
    } finally { await f.dispose(); }
  });
}

for (const cancellation of ['stop', 'seal', 'socket', 'generation', 'verification'] as const) {
  test(`real history ingestion discards remaining and queued stale work after ${cancellation} during a yield`, async t => {
    const f = await fixture(); let atIO = -1; let io: Promise<void> = Promise.resolve(); let stopping: Promise<void> | undefined;
    const observe = f.flow.observe.bind(f.flow);
    t.mock.method(f.flow, 'observe', (...args: Parameters<Workflow['observe']>) => {
      const result = observe(...args);
      if (f.adapter.snapshot().historyMessages === 0) io = ioTurn().then(async () => {
        atIO = f.adapter.snapshot().historyMessages;
        if (cancellation === 'stop') stopping = f.adapter.stop();
        else if (cancellation === 'seal') stopping = f.adapter.quiesce();
        else if (cancellation === 'socket') await f.replace();
        else if (cancellation === 'generation') f.adapter['generation']++;
        else f.adapter['verifiedSocket'] = undefined;
      });
      return result;
    });
    try {
      f.ev.emit('messaging-history.set', { contacts: [], messages: raws(96) });
      // Already queued old-socket work must not be revived by a replacement.
      f.ev.emit('messaging-history.set', { contacts: [{ id: '999@lid', phoneNumber: chat }], messages: [{ ...raws(1)[0], key: { remoteJid: chat, id: 'stale-queued' } }] });
      await f.adapter['events']; await io; await stopping;
      assert.ok(atIO > 0 && atIO < 96, `cancellation observed ${atIO}/96 stored`);
      assert.equal(f.store.messages('a', chat).length, atIO);
      assert.equal(f.store.waCanonical('a', '999@lid'), '999@lid');
      if (cancellation === 'stop') await f.replace();
      if (cancellation === 'seal') await assert.rejects(f.adapter.start(), /profile_transition_in_progress/);
      await ioTurn(); await f.adapter['events'];
      assert.equal(f.store.messages('a', chat).length, atIO, 'cancelled history must not replay');
      assert.equal(f.adapter.snapshot().error, null);
    } finally { await f.dispose(); }
  });
}

test('real multi-slice history completes mapping, storage and names without model work', async () => {
  const f = await fixture();
  try {
    f.flow.setContactNames({ requestId: 'names', expectedRevision: 0, enabled: true });
    const messages = raws(70).map(raw => ({ ...raw, key: { ...raw.key, remoteJid: '123@lid' } }));
    f.ev.emit('messaging-history.set', { contacts: [{ id: '123@lid', phoneNumber: chat, name: 'Invented saved name' }], messages });
    await f.adapter['events'];
    assert.equal(f.store.waCanonical('a', '123@lid'), chat);
    assert.deepEqual(f.store.messages('a', chat).map(m => m.transportId), messages.map(m => m.key.id));
    assert.equal(f.flow.conversation(chat).name, 'Invented saved name');
    assert.equal(f.adapter.snapshot().historyMessages, 70);
    assert.equal(f.adapter.snapshot().error, null);
    assert.equal(f.store.drafts('a').length, 0); assert.equal(f.store.outboxes('a').length, 0);
  } finally { await f.dispose(); }
});
