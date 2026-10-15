import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '@replybot/core';
import { PcDisplay, SessionDiscovery } from '@replybot/core/api';
import { createApp } from '../src/server.ts';
import { WhatsAppAdapter, type WhatsAppStatus } from '../src/whatsapp.ts';
import type { PcDisplayIntent } from '../src/pc-display.ts';

const scope = { profileId: 'original', accountId: 'whatsapp-owner', revision: 7 };
const headers = { authorization: 'Bearer synthetic-owner-token', 'x-otherme-profile': scope.profileId, 'x-otherme-revision': '7' };
const identity = { rootId: 'synthetic-root', instanceId: 'synthetic-instance' };
function adapter(t: TestContext) {
  const status: WhatsAppStatus = { state: 'qr', qr: 'data:image/png;base64,YQ==', error: null, historyMessages: 0 };
  let starts = 0;
  t.mock.method(WhatsAppAdapter.prototype, 'start', async () => { starts++; });
  t.mock.method(WhatsAppAdapter.prototype, 'snapshot', () => ({ ...status }));
  t.mock.method(WhatsAppAdapter.prototype, 'quiesce', async () => {});
  return { status, starts: () => starts };
}
test('explicit scoped intent starts once and only matching nonce/instance/scope can acknowledge it', async t => {
  const wa = adapter(t); let clock = 1000;
  const intents: PcDisplayIntent[] = [];
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', accountId: scope.accountId, profileScope: scope,
    launcher: identity, whatsapp: { authDir: 'unused-synthetic-auth' }, now: () => clock,
    onPcDisplay: async intent => { intents.push(intent); } });
  const connect = (requestId: string, extra = {}) => app.inject({ method: 'POST', url: '/v1/whatsapp/connect', headers,
    payload: { requestId, confirm: true, displayOnPc: true, ...extra } });
  const status = async () => (await app.inject({ url: '/v1/whatsapp', headers })).json();
  try {
    const discovery = SessionDiscovery.parse((await app.inject({ url: '/v1/session?capabilities=1', headers })).json());
    assert.equal(discovery.capabilities?.pcQrDisplay, true);
    assert.equal((await app.inject({ url: '/v1/whatsapp', headers })).json().pcDisplay, undefined);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/whatsapp/connect', headers: { ...headers, 'x-otherme-revision': '6' },
      payload: { requestId: 'wrong-scope', confirm: true, displayOnPc: true } })).statusCode, 409);
    assert.equal(wa.starts(), 0); assert.equal(intents.length, 0);
    const first = await connect('link');
    assert.deepEqual(PcDisplay.parse(first.json().pcDisplay), { requestId: 'link', state: 'requested' });
    await Promise.all([connect('link'), connect('link')]);
    for (let i = 0; i < 3; i++) await status();
    assert.equal(wa.starts(), 1); assert.equal(intents.length, 1);
    const intent = intents[0]; assert.ok(intent);
    assert.deepEqual(Object.keys(intent).sort(), ['instanceId', 'nonce', 'profileScope', 'requestId', 'rootId', 'type']);
    const ack = { ...intent, type: 'otherme-pc-display-ack', state: 'ready' };
    for (const changed of [{ rootId: 'other' }, { instanceId: 'other' }, { requestId: 'other' },
      { nonce: '00000000-0000-4000-8000-000000000000' }, { profileScope: { ...scope, revision: 8 } }]) {
      app.acknowledgePcDisplay({ ...ack, ...changed }); assert.equal((await status()).pcDisplay.state, 'requested');
    }
    app.acknowledgePcDisplay(ack); assert.equal((await status()).pcDisplay.state, 'ready');
    assert.equal((await connect('link', { displayOnPc: false })).statusCode, 409);
    clock += 60001; assert.equal((await status()).pcDisplay.state, 'expired');
    app.acknowledgePcDisplay(ack); assert.equal((await status()).pcDisplay.state, 'expired');
    await connect('link'); assert.equal(intents.length, 1);
    await connect('next');
    app.acknowledgePcDisplay(ack); assert.deepEqual((await status()).pcDisplay, { requestId: 'next', state: 'requested' });
    wa.status.state = 'connected'; wa.status.qr = null;
    assert.equal((await status()).pcDisplay.state, 'expired');
  } finally { await app.close(); }
});
test('omitted display intent stays valid and absent owning launcher is honestly unavailable', async t => {
  const wa = adapter(t);
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', accountId: scope.accountId, profileScope: scope,
    whatsapp: { authDir: 'unused-synthetic-auth' } });
  try {
    const connect = (payload: object) => app.inject({ method: 'POST', url: '/v1/whatsapp/connect', headers, payload });
    const legacy = await connect({ requestId: 'legacy', confirm: true });
    assert.equal(legacy.statusCode, 200); assert.equal(legacy.json().pcDisplay, undefined);
    const result = await connect({ requestId: 'display', confirm: true, displayOnPc: true });
    assert.deepEqual(result.json().pcDisplay, { requestId: 'display', state: 'unavailable' });
    assert.equal(wa.starts(), 2);
  } finally { await app.close(); }
});
test('failed IPC is unavailable, transport errors remain visible, and stopping rejects new admission', async t => {
  const wa = adapter(t);
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', accountId: scope.accountId, profileScope: scope,
    launcher: identity, whatsapp: { authDir: 'unused-synthetic-auth' }, onPcDisplay: async () => { throw new Error('synthetic-ipc-failure'); } });
  try {
    const result = await app.inject({ method: 'POST', url: '/v1/whatsapp/connect', headers, payload: { requestId: 'link', confirm: true, displayOnPc: true } });
    assert.equal(result.json().pcDisplay.state, 'unavailable');
    wa.status.state = 'error';
    const error = await app.inject({ url: '/v1/whatsapp', headers });
    assert.equal(error.json().state, 'error');
    app.beginShutdown();
    assert.equal((await app.inject({ url: '/v1/snapshot', headers })).statusCode, 503);
  } finally { await app.close(); }
});
