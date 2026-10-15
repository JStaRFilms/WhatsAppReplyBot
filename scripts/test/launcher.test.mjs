import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ensureService, inspectService, stopOwned } from '../launcher-service.mjs';

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
test('pairing QR arriving after launcher exit is never written or opened',async()=>{
  const source=readFileSync(new URL('../start-otherme.mjs',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('async function showPairing()'),source.indexOf('async function stop()'));
  let resolveQR,waiting;const response=new Promise(resolve=>resolveQR=resolve);const reached=new Promise(resolve=>waiting=resolve);let writes=0,opens=0;
  const context={pairing:false,stopping:false,restarting:undefined,rootId:identity.rootId,serviceIdentity:identity,readToken:()=>token,
    inspectService:async(_port,_token,expected)=>{assert.equal(expected.rootId,identity.rootId);assert.equal(expected.instanceId,identity.instanceId);return identity;},
    fetch:async url=>url.endsWith('/connect') ? {ok:true} : {ok:true,json:()=>{waiting();return response;}},
    randomUUID:()=> 'synthetic',AbortSignal,console:{info(){}},runtime:'synthetic',qrPath:'synthetic.png',Buffer,
    mkdirSync(){},writeFileSync(){writes++;},spawn(){opens++;return{on(){},unref(){}};}};
  const showPairing=vm.runInNewContext(code+'\nshowPairing;',context);
  const pending=showPairing();await reached;context.stopping=true;resolveQR({state:'qr',qr:'data:image/png;base64,YQ=='});await pending;
  assert.equal(writes,0);assert.equal(opens,0);
});
