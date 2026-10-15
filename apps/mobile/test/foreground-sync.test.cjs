const test=require('node:test');
const assert=require('node:assert/strict');
const {z}=require('zod');
const {deferred}=require('./render-harness.cjs');
const {scope,descriptor,snapshot,json,apiFixture,providerFixture}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('foreground immediately refreshes independent PC work, keeps cached content and rejects old reads',async()=>{
  const f=providerFixture(),a=scope();await f.connect(a);const cached=f.render().snapshot;
  f.render();f.h.flush();await settle();
  const late=deferred();let signal;
  f.respond(async call=>{
    if(call.path==='/v1/session')return json(descriptor(a));
    signal=call.signal;return late.promise;
  });
  const old=f.render().refresh();await settle();
  f.foreground('background');assert.equal(signal.aborted,true);
  assert.equal(f.render().snapshot,cached);assert.equal(f.render().snapshotFresh,false);
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(a):snapshot(a,4)));
  const before=f.calls.length;f.foreground('active');
  assert.equal(f.calls[before].path,'/v1/session');await settle();
  assert.equal(f.render().snapshot.conversations[0].workflowVersion,4);
  assert.equal(f.render().snapshotFresh,true);assert.equal(f.render().status,'online');
  late.resolve(json(snapshot(a,99)));await old;await settle();
  assert.equal(f.render().snapshot.conversations[0].workflowVersion,4);
});

test('poll ticks deduplicate slow reads; explicit refresh supersedes and ignores late errors',async()=>{
  const f=providerFixture(),a=scope();await f.connect(a);f.render();f.h.flush();
  const late=deferred();f.respond(()=>late.promise);
  const before=f.calls.length;f.timers.at(-1)();f.timers.at(-1)();f.timers.at(-1)();
  assert.equal(f.calls.length,before+1);const signal=f.calls.at(-1).signal;
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(a):snapshot(a,3)));
  await f.render().refresh();assert.equal(signal.aborted,true);
  late.reject(new Error('synthetic obsolete error'));await settle();
  assert.equal(f.render().error,null);assert.equal(f.render().snapshotFresh,true);
});

test('read timeout is bounded even when transport ignores abort and retry clears only read feedback',async()=>{
  let timeout;
  const f=providerFixture({apiGlobals:{setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){}}}),a=scope();
  await f.connect(a);let reads=0;
  f.respond(async call=>{
    if(call.path==='/v1/session')return json(descriptor(a));
    if(++reads===1)return new Promise(()=>{});
    return json(snapshot(a,2));
  });
  const pending=f.render().refresh();await settle();timeout();await settle();
  assert.match(f.render().error,/Could not refresh/);assert.doesNotMatch(f.render().error,/send|No action|acknowledge/i);
  assert.equal(f.render().snapshotFresh,false);assert.ok(f.render().snapshot);
  await pending;
  assert.equal(reads,2);assert.equal(f.render().error,null);assert.equal(f.render().snapshotFresh,true);
  f.render().reportError('A send outcome is unknown. Do not resend.');
  await f.render().refresh();assert.match(f.render().error,/send outcome is unknown/);
});

test('transport read retries stop at three; authentication is not retried',async()=>{
  const f=providerFixture(),a=scope();await f.connect(a);
  let reads=0;f.respond(async()=>{reads++;throw new Error('synthetic offline');});
  await f.render().refresh();assert.equal(reads,3);assert.equal(f.render().status,'offline');assert.ok(f.render().snapshot);
  reads=0;f.respond(async()=>{reads++;return json({error:'owner_auth_required'},401);});
  await f.render().refresh();assert.equal(reads,1);assert.equal(f.render().pcStatus,'auth-required');
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(a):snapshot(a)));
  await f.render().refresh();assert.equal(f.render().error,null);assert.equal(f.render().pcStatus,'authenticated');
});

test('authenticated PC without accepted profile saves private credential and reconnect does not provision again',async()=>{
  const writes=[],a=scope(),f=providerFixture({save:async(_key,value)=>writes.push(JSON.parse(value))});
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(a):snapshot(a)));
  await f.render().connect('http://synthetic.local/','synthetic-token');
  assert.equal(f.render().pcStatus,'authenticated');assert.equal(f.render().acceptedScope,null);assert.equal(f.render().snapshot,null);
  assert.equal(f.render().hasSavedCredential,true);assert.equal(writes.at(-1).scope,undefined);
  assert.equal(writes.at(-1).token,'synthetic-token');
  await f.render().connect('http://synthetic.local');
  assert.ok(f.calls.every(call=>call.path==='/v1/session'));
  assert.ok(f.calls.every(call=>call.headers.Authorization==='Bearer synthetic-token'));
  assert.equal('token' in f.render(),false);
});

test('a superseded credential-only save cannot discard the newly accepted saved scope',async()=>{
  const held=deferred(),writes=[],a=scope();let first=true;
  const f=providerFixture({save:async(_key,value)=>{if(first){first=false;await held.promise;}writes.push(JSON.parse(value));}});
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(a):snapshot(a)));
  const connecting=f.render().connect('http://synthetic.local','synthetic-token');await settle();
  const accepting=f.render().continueProfile();await settle();held.resolve();await connecting;await accepting;
  assert.equal(writes.at(-1).scope.profileId,a.profileId);assert.equal(f.render().acceptedScope.profileId,a.profileId);
});

test('background does not cancel or replay mutations and uncertain mutation errors survive read recovery',async()=>{
  const f=providerFixture(),a=scope(),post=deferred();await f.connect(a);f.render();f.h.flush();await settle();
  let mutationSignal;
  f.respond(async call=>{
    if(call.method==='POST'){mutationSignal=call.signal;return post.promise;}
    return json(call.path==='/v1/session'?descriptor(a):snapshot(a));
  });
  const pending=f.render().perform('/v1/synthetic-action',z.object({ok:z.boolean()}),{});await settle();
  f.foreground('background');assert.equal(mutationSignal.aborted,false);
  post.reject(new Error('synthetic lost response'));await pending;
  f.foreground('active');await settle();
  assert.equal(f.calls.filter(call=>call.method==='POST').length,1);
  assert.match(f.render().error,/outcome is unconfirmed/);
});

test('read cancellation handles late response bodies without accepting obsolete data',async()=>{
  const body=deferred();const {ApiClient}=apiFixture(async()=>({ok:true,headers:new Headers(),json:()=>body.promise}));
  const client=new ApiClient('http://synthetic.local','synthetic-token',scope()),abort=new AbortController();
  const pending=client.request('/v1/snapshot',z.unknown(),undefined,abort.signal);
  await settle();abort.abort();await assert.rejects(pending,/Could not refresh/);
  body.resolve({obsolete:true});await settle();
});
