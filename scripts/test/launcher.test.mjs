import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { EventEmitter } from 'node:events';
import { ensureService, inspectService, stopOwned, openDesktop } from '../launcher-service.mjs';
import { createPcQrViewer } from '../pc-qr.mjs';

const token = 'synthetic-owner-token';
const identity = { service: 'otherme-backend', protocol: 2, accountId: 'whatsapp-owner', profileScope: { profileId: 'original', accountId: 'whatsapp-owner', revision: 0 }, demo: false, whatsapp: 'connected',rootId:'synthetic-root',instanceId:'synthetic-instance' };
async function fake(handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  assert.notEqual(port, 3210); assert.notEqual(port, 8081); assert.notEqual(port, 8083);
  return { port, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
test('occupied port attaches only with matching token, live account and launcher identity, without starting anything', async () => {
  let requests = 0;
  const service = await fake((req, res) => {
    assert.equal(req.url, '/v1/launcher'); assert.equal(req.headers.authorization, 'Bearer '+token); requests++;
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(identity));
  });
  try {
    const result = await ensureService({ port: service.port, rootId:identity.rootId, instanceId:'synthetic-new-instance', readToken: () => token, start: () => assert.fail('must not start') });
    assert.equal(result.owned, false); assert.equal(result.child, null); assert.equal(requests, 1);
  } finally { await service.close(); }
});
test('unverified, demo, wrong account, bad token and redirect services cannot be attached or replaced', async () => {
  for (const body of [{ ...identity, service: 'another' }, { ...identity, demo: true }, { ...identity, accountId: 'another' }, { ...identity, protocol: 1 }, null, 'redirect']) {
    const service = await fake((_req, res) => {
      if (body === null) res.writeHead(401).end();
      else if (body === 'redirect') res.writeHead(302, { location: 'http://127.0.0.1:3210' }).end();
      else res.end(JSON.stringify(body));
    });
    try {
      await assert.rejects(ensureService({ port: service.port, rootId:identity.rootId, instanceId:'synthetic-new-instance', readToken: () => token, start: () => assert.fail('must not start') }));
      await assert.rejects(inspectService(service.port, ''));
    } finally { await service.close(); }
  }
});
test('isolated fake child starts once and exits through graceful IPC, never a PID kill', async () => {
  const reservation = await fake((_req, res) => res.end());
  const port = reservation.port; await reservation.close();
  let starts = 0, child;
  try {
    const result = await ensureService({ port, rootId:identity.rootId, instanceId:identity.instanceId, readToken: () => token, interval: 50, start: () => {
      starts++;
      child = fork(new URL('./fake-backend.cjs', import.meta.url), [], {
        env: { ...process.env, TEST_PORT: String(port),TEST_ROOT_ID:identity.rootId,TEST_INSTANCE_ID:identity.instanceId }, execArgv: [], stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      });
      return child;
    } });
    assert.equal(starts, 1); assert.equal(result.owned, true);
    await stopOwned(result.child);
    assert.equal(child.exitCode, 0); assert.equal(await inspectService(port, token), null);
  } finally { if (child?.connected) await stopOwned(child); }
});
test('early Q cancels readiness and the known fake child still exits through owned IPC', async () => {
  const reservation = await fake((_req, res) => res.end()); const port = reservation.port; await reservation.close();
  let stopping = false, child;
  try {
    await assert.rejects(ensureService({ port, rootId: identity.rootId, instanceId: identity.instanceId, readToken: () => token,
      interval: 50, shouldStop: () => stopping, start: () => {
        child = fork(new URL('./fake-backend.cjs', import.meta.url), [], { env: { ...process.env, TEST_PORT: String(port), TEST_ROOT_ID: identity.rootId, TEST_INSTANCE_ID: identity.instanceId },
          execArgv: [], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        stopping = true; return child;
      } }), /Startup cancelled/);
    await stopOwned(child); assert.equal(child.exitCode, 0);
    assert.equal(await inspectService(port, token), null);
  } finally { if (child?.connected) await stopOwned(child); }
});

test('token acceptance cannot attach a different checkout or revalidate a replaced instance',async()=>{
  const service=await fake((_req,res)=>res.end(JSON.stringify(identity)));
  try{
    await assert.rejects(inspectService(service.port,token,{rootId:'another-checkout'}));
    await assert.rejects(inspectService(service.port,token,{rootId:identity.rootId,instanceId:'another-instance'}));
    assert.equal((await inspectService(service.port,token,{rootId:identity.rootId,instanceId:identity.instanceId})).instanceId,identity.instanceId);
  }finally{await service.close();}
});
test('newly started service must match the launch nonce before claiming ownership',async()=>{
  const reservation=await fake((_req,res)=>res.end());const port=reservation.port;await reservation.close();let child;
  try{
    await assert.rejects(ensureService({port,rootId:identity.rootId,instanceId:'expected-new-instance',readToken:()=>token,attempts:3,interval:100,start:()=>{
      child=fork(new URL('./fake-backend.cjs',import.meta.url),[],{env:{...process.env,TEST_PORT:String(port),TEST_ROOT_ID:identity.rootId,TEST_INSTANCE_ID:'wrong-instance'},execArgv:[],stdio:['ignore','ignore','inherit','ipc']});return child;
    }}));
  }finally{if(child?.connected)await stopOwned(child);}
});
const intent = { ...identity, type: 'otherme-pc-display', requestId: 'synthetic-link', nonce: '00000000-0000-4000-8000-000000000001' };
test('pairing errors print the safe backend reason immediately without suggesting another P retry', async () => {
  const logs = []; let reads = 0;
  const reason = 'Saved WhatsApp login belongs to a different number. Create a profile in Settings.';
  const viewer = createPcQrViewer({ getIdentity: () => identity, isStopping: () => false,
    readStatus: async () => { reads++; return { state: 'error', error: reason }; },
    write: () => assert.fail('must not write QR'), open: () => assert.fail('must not open QR'), remove() {}, acknowledge() {},
    wait: () => assert.fail('must not wait on a pairing error'), report: message => logs.push(message) });
  await viewer.request(intent, { manual: true });
  assert.equal(reads, 1); assert.deepEqual(logs, [reason]);
});

test('pairing QR arriving after launcher exit is never written or opened', async () => {
  let resolveQR, reached; let stopping = false;
  const response = new Promise(resolve => { resolveQR = resolve; });
  const waiting = new Promise(resolve => { reached = resolve; });
  const viewer = createPcQrViewer({ getIdentity: () => identity, isStopping: () => stopping,
    readStatus: () => { reached(); return response; }, write: () => assert.fail('late QR must not be written'),
    open: () => assert.fail('late QR must not open'), remove() {}, acknowledge() {} });
  const pending = viewer.request(intent); await waiting; stopping = true; viewer.cancel();
  resolveQR({ state: 'qr', qr: 'data:image/png;base64,YQ==' }); await pending;
});

test('D opens only the verified public local root, never a token URL or another service', async () => {
  let capability = true; const opened = [];
  const service = await fake((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer '+token);
    res.end(JSON.stringify(req.url === '/v1/launcher' ? identity : { capabilities: { desktopBrowser: capability } }));
  });
  try {
    await openDesktop({ port: service.port, token, identity, open: async url => opened.push(url) });
    assert.deepEqual(opened, ['http://127.0.0.1:'+service.port+'/']);
    capability = false;
    await assert.rejects(openDesktop({ port: service.port, token, identity, open: () => assert.fail('not built') }), /assets are unavailable/);
    await assert.rejects(openDesktop({ port: service.port, token, identity: { ...identity, instanceId: 'other' }, open: () => assert.fail('wrong owner') }));
  } finally { await service.close(); }
});

test('stop timeout reports only a matching owned phase and never releases or kills pending work', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 123, connected: true, exitCode: null, signalCode: null,
    send(_message, callback) {
      child.emit('message', { type: 'otherme-stopping', ...identity, phase: 'transport' });
      child.emit('message', { type: 'otherme-stopping', ...identity, instanceId: 'other', phase: 'storage' });
      callback();
    } });
  await assert.rejects(stopOwned(child, 20, identity), /waiting for transport/);
  assert.equal(child.exitCode, null); assert.equal(child.listenerCount('exit'), 0); assert.equal(child.listenerCount('message'), 0);
  child.exitCode = 1; await assert.rejects(stopOwned(child), /did not exit cleanly/);
});
