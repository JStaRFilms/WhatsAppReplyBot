import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { manageServer } from '../src/launcher-startup.ts';
import { SqliteStore } from '@replybot/core';
import { createApp } from '../src/server.ts';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { DEMO_ACCOUNT } from '../src/seed.ts';
import http from 'node:http';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
test('stop received before listen settles is retained', async () => {
  const events = new EventEmitter();
  let release = () => {}; let closes = 0; let gates = 0;
  const listening = new Promise<void>(resolve => { release = resolve; });
  const lifecycle = manageServer({ events, listen: () => listening, gate: () => { gates++; },
    close: async () => { closes++; }, onClosed() {}, onError: () => assert.fail('unexpected stop failure') });
  await tick();
  events.emit('message', { type: 'otherme-stop' });
  assert.equal(gates, 1); assert.equal(closes, 0);
  events.emit('disconnect'); events.emit('SIGTERM');
  release(); assert.equal(await lifecycle.ready, false); await lifecycle.stop();
  assert.equal(closes, 1, 'early stop must not disappear while listen is pending');
  assert.equal(events.listenerCount('message'), 0);
});

test('parent loss during startup, listen failure and close rejection are handled without duplicate closes', async () => {
  for (const failListen of [true, false]) {
    const events = new EventEmitter(); let closes = 0; let errors = 0; let disconnected = false;
    const lifecycle = manageServer({ events, listen: async () => { if (failListen) throw new Error('synthetic-listen'); },
      gate() {}, close: async () => { closes++; if (!failListen) throw new Error('synthetic-drain'); },
      onClosed: () => { disconnected = true; }, onError: () => { errors++; } });
    if (failListen) await assert.rejects(lifecycle.ready, /synthetic-listen/);
    else assert.equal(await lifecycle.ready, true);
    events.emit('disconnect'); await tick();
    if (failListen) { await lifecycle.stop(); assert.equal(disconnected, true); }
    else { await assert.rejects(lifecycle.stop(), /synthetic-drain/); assert.equal(errors, 1); assert.equal(disconnected, false); }
    assert.equal(closes, 1);
  }
});

test('admitted HTTP model work and idle connections drain before SQLite closes', async t => {
  const store = new SqliteStore(); let release = () => {}; let entered = () => {}; let closed = false;
  const model = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { entered = resolve; });
  const original = store.close.bind(store);
  t.mock.method(store, 'close', () => { closed = true; original(); });
  const phases: string[] = [];
  const app = createApp({ store, token: 'synthetic', onShutdownPhase: phase => phases.push(phase),
    remoteModel: { generate: async () => { entered(); await model; return { kind: 'text', text: 'Synthetic reply', reason: 'Fixture' }; } } });
  const agent = new http.Agent({ keepAlive: true });
  t.after(async () => { release(); agent.destroy(); await app.close(); });
  store.saveModelConsent(DEMO_ACCOUNT, true);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  assert.ok(![3210, 8081, 8083].includes(address.port));
  const base = 'http://127.0.0.1:'+address.port;
  const send = (path: string, body?: string) => new Promise<void>((resolve, reject) => {
    const request = http.request(base+path, { agent, method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer synthetic', 'content-type': 'application/json' } }, response => {
      response.resume(); response.on('end', () => resolve());
    });
    request.on('error', reject); request.end(body);
  });
  await send('/v1/health');
  const drafting = send('/v1/conversations/demo-chat-7/draft', JSON.stringify({ requestId: 'synthetic-drain' }));
  await Promise.race([reached, drafting.then(() => assert.fail('Fixture returned before entering the model'))]);
  app.beginShutdown();
  assert.equal((await app.inject({ url: '/v1/snapshot', headers: { authorization: 'Bearer synthetic' } })).statusCode, 503);
  const closing = app.close();
  try {
    await tick(); assert.equal(closed, false); assert.ok(phases.includes('requests'));
  } finally { release(); await drafting; await closing; }
  assert.equal(closed, true); assert.equal(phases.at(-1), 'stopped');
});

test('shutdown gates and reports its blocked transport drain before closing the store', async t => {
  let release = () => {}; let entered = () => {}; let closed = false;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { entered = resolve; });
  t.mock.method(WhatsAppAdapter.prototype, 'quiesce', () => { entered(); return blocked; });
  const store = new SqliteStore();
  const original = store.close.bind(store);
  t.mock.method(store, 'close', () => { closed = true; original(); });
  const phases: string[] = [];
  const options = { store, token: 'synthetic', whatsapp: { authDir: 'unused-synthetic-auth' }, onShutdownPhase: (phase: string) => { phases.push(phase); } };
  const app = createApp(options); await app.ready();
  const closing = app.close();
  try {
    await reached;
    assert.equal(closed, false);
    assert.ok(phases.includes('gating'), 'admission must close before waiting');
    assert.ok(phases.includes('transport'), 'blocked drain must name its phase');
  } finally { release(); await closing; }
  assert.equal(closed, true);
});
