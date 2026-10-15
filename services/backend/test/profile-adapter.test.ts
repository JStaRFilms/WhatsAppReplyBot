import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setImmediate as flush } from 'node:timers/promises';
import { SqliteStore, Workflow } from '@replybot/core';
import { WhatsAppAdapter } from '../src/whatsapp.ts';

function fixture(requireLock = true) {
  const auth = mkdtempSync(join(tmpdir(), 'otherme-synthetic-adapter-'));
  writeFileSync(join(auth, 'owner-identity.json'), JSON.stringify({ owner: '456@s.whatsapp.net' }));
  const store = new SqliteStore(); const flow = new Workflow(store, 'a'); let losses = 0;
  const adapter = new WhatsAppAdapter(flow, auth, async () => {}, () => { losses++; }, Date.now, requireLock);
  return { auth, store, flow, adapter, losses: () => losses, dispose: () => { store.close(); rmSync(auth, { recursive: true, force: true }); } };
}

test('same-owner repair verifies before ingestion; wrong owner and a removed lock never ingest', async () => {
  for (const scenario of ['same', 'different', 'missing'] as const) {
    const f = fixture(); const ev = new EventEmitter(); let ended = 0;
    const creds: { me?: { id: string } } = {};
    const state = { creds, keys: {} };
    Object.defineProperties(f.adapter, {
      loadAuth: { value: async () => ({ state, saveCreds: async () => {} }) },
      makeSocket: { value: () => ({ ev, end: () => { ended++; } }) },
    });
    try {
      await f.adapter.start(); if (scenario === 'missing') unlinkSync(join(f.auth, 'owner-identity.json'));
      state.creds.me = { id: scenario === 'different' ? '999:1@s.whatsapp.net' : '456:1@s.whatsapp.net' };
      ev.emit('connection.update', { connection: 'open' });
      ev.emit('contacts.upsert', [{ id: '123@s.whatsapp.net', name: 'Synthetic' }]);
      ev.emit('messages.upsert', { type: 'notify', messages: [{ key: { remoteJid: '123@s.whatsapp.net', id: 'same-id', fromMe: false }, messageTimestamp: Math.floor(Date.now()/1000), message: { conversation: 'Synthetic only' } }] });
      await f.adapter['events'];
      assert.equal(f.store.conversations('a').length, scenario === 'same' ? 1 : 0);
      assert.equal(f.store.messages('a', '123@s.whatsapp.net').length, scenario === 'same' ? 1 : 0);
      if (scenario !== 'same') { assert.equal(f.adapter.snapshot().state, 'error'); assert.equal(ended, 1); }
    } finally { await f.adapter.stop(); f.dispose(); }
  }
});

test('saved mismatched owner never opens a socket or rewrites auth; registered false alone does not reject the right owner', async () => {
  for (const sameOwner of [false, true]) {
    const f = fixture(); const ev = new EventEmitter(); let sockets = 0;
    const state = { creds: { registered: false, me: { id: sameOwner ? '456:1@s.whatsapp.net' : '999:1@s.whatsapp.net' } }, keys: {} };
    const path = join(f.auth, 'creds.json'); const saved = JSON.stringify(state.creds);
    writeFileSync(path, saved); const lock = readFileSync(join(f.auth, 'owner-identity.json'));
    Object.defineProperties(f.adapter, {
      loadAuth: { value: async () => ({ state, saveCreds: async () => assert.fail('must not rewrite auth') }) },
      makeSocket: { value: () => { sockets++; return { ev, end: () => {} }; } },
    });
    try {
      await f.adapter.start();
      assert.equal(sockets, sameOwner ? 1 : 0);
      if (sameOwner) {
        ev.emit('connection.update', { connection: 'open' });
        assert.equal(f.adapter.snapshot().state, 'connected');
      } else {
        assert.equal(f.adapter.snapshot().state, 'error');
        assert.match(f.adapter.snapshot().error ?? '', /different number.*Use another number/);
      }
      assert.equal(readFileSync(path, 'utf8'), saved);
      assert.deepEqual(readFileSync(join(f.auth, 'owner-identity.json')), lock);
      assert.deepEqual(f.store.conversations('a'), []);
    } finally { await f.adapter.stop(); f.dispose(); }
  }
});

test('shutdown wins an in-flight auth startup and clears connection callback only once', async () => {
  const f = fixture(); let release: () => void = () => {}; let sockets = 0;
  const authLoaded = new Promise<void>(resolve => { release = resolve; });
  Object.defineProperties(f.adapter, {
    loadAuth: { value: async () => { await authLoaded; return { state: { creds: {}, keys: {} }, saveCreds: async () => {} }; } },
    makeSocket: { value: () => { sockets++; throw new Error('must not create a socket'); } },
  });
  try {
    const startup = f.adapter.start(); const stopped = f.adapter.quiesce();
    release(); await startup; await stopped; await f.adapter.quiesce();
    assert.equal(sockets, 0); assert.equal(f.losses(), 1);
    await assert.rejects(f.adapter.start(), /profile_transition_in_progress/);
  } finally { release(); await f.adapter.stop(); f.dispose(); }
});

test('shutdown drains an admitted credential write and rejects late socket credential events', async () => {
  const f = fixture(); const ev = new EventEmitter(); let writes = 0; let release: () => void = () => {}; let entered: () => void = () => {};
  const saving = new Promise<void>(resolve => { entered = resolve; }); const finish = new Promise<void>(resolve => { release = resolve; });
  Object.defineProperties(f.adapter, {
    loadAuth: { value: async () => ({ state: { creds: {}, keys: {} }, saveCreds: async () => { writes++; entered(); await finish; } }) },
    makeSocket: { value: () => ({ ev, end: () => {} }) },
  });
  try {
    await f.adapter.start(); ev.emit('creds.update', {}); await saving;
    let stopped = false; const closing = f.adapter.quiesce().then(() => { stopped = true; });
    ev.emit('creds.update', {}); ev.emit('connection.update', { connection: 'close' });
    await flush(); assert.equal(stopped, false); release(); await closing;
    ev.emit('creds.update', {}); await f.adapter['events'];
    assert.equal(writes, 1); assert.equal(f.adapter.snapshot().state, 'disconnected'); assert.equal(f.losses(), 1);
  } finally { release(); await f.adapter.stop(); f.dispose(); }
});
