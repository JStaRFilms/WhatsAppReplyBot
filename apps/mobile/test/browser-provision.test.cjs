const test=require('node:test');
const assert=require('node:assert/strict');
const {apiFixture,json,providerFixture,scope,descriptor,snapshot}=require('./profile-fixture.cjs');

const tokenGuidance=error=>{
  assert.match(error.message,/enter the service token/i);
  assert.doesNotMatch(error.message,/pnpm|start .*backend/i);
  return true;
};

test('blank-token LAN setup gives token guidance without requesting provisioning',async()=>{
  const calls=[];
  const api=apiFixture(async(...args)=>{calls.push(args);return json({error:'local_browser_provision_only'},403);},{URL});
  for(const base of ['http://192.168.50.8:3210','http://10.5.6.7:3210/','http://172.20.1.8:8081','http://localhost.attacker.invalid:3210']){
    await assert.rejects(api.ApiClient.provision(base),tokenGuidance);
  }
  assert.equal(calls.length,0);
});

test('a denied loopback provisioning request gives token guidance, not a developer command',async()=>{
  const api=apiFixture(async()=>json({error:'local_browser_provision_only'},403),{URL});
  await assert.rejects(api.ApiClient.provision('http://127.0.0.1:3210'),tokenGuidance);
});

for(const phase of ['fetch','body'])test('loopback provisioning bounds '+phase+' even when transport ignores abort',async()=>{
  const timers=[],cleared=[],calls=[];
  const never=new Promise(()=>{});
  const api=apiFixture(async(_url,init)=>{
    calls.push(init);
    return phase==='fetch'?never:{ok:true,json:()=>never};
  },{URL,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>cleared.push(id)});
  const pending=api.ApiClient.provision('http://localhost:3210');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(timers.length,1,'provisioning must install a deadline');
  assert.ok(timers[0].ms>0 && timers[0].ms<=10000);
  const rejected=assert.rejects(pending,error=>{
    assert.match(error.message,/Otherme|service/);assert.doesNotMatch(error.message,/pnpm/);return true;
  });
  timers[0].fn();await rejected;
  assert.equal(calls.length,1);assert.equal(calls[0].signal.aborted,true);assert.deepEqual(cleared,[1]);
});

test('successful loopback provisioning retains native Origin and clears its deadline',async()=>{
  for(const platform of ['web','android']){
    const calls=[],timers=[],cleared=[];
    const api=apiFixture(async(url,init)=>{calls.push({url,...init});return json({token:'invented-provision-token',demo:true});},
      {URL,process:{env:{EXPO_OS:platform}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>cleared.push(id)});
    assert.equal(await api.ApiClient.provision('http://127.0.0.1:3210/'),'invented-provision-token');
    assert.equal(calls.length,1);assert.equal(calls[0].url,'http://127.0.0.1:3210/v1/local-provision');
    assert.equal(calls[0].headers.Origin,platform==='web'?undefined:'http://localhost');
    assert.equal(calls[0].headers.Authorization,undefined);assert.deepEqual(JSON.parse(calls[0].body),{confirmLocalDemo:true});
    assert.equal(timers.length,1);assert.deepEqual(cleared,[1]);assert.equal(calls[0].signal.aborted,false);
  }
});

test('LAN failure leaves profile unbound; entered and saved tokens still need explicit Continue',async()=>{
  const f=providerFixture({apiGlobals:{URL}}),a=scope();
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(a):call.path==='/v1/local-provision'?{error:'local_browser_provision_only'}:snapshot(a),call.path==='/v1/local-provision'?403:200));
  await f.render().connect('http://192.168.50.8:3210');
  assert.equal(f.calls.length,0);assert.equal(f.render().acceptedScope,null);assert.equal(f.render().snapshot,null);
  tokenGuidance({message:f.render().error});
  await f.render().connect('http://192.168.50.8:3210','invented-lan-token');
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/v1/session');assert.equal(f.render().acceptedScope,null);
  await f.render().connect('http://192.168.50.8:3210');
  assert.equal(f.calls.length,2);assert.equal(f.calls[1].path,'/v1/session');assert.equal(f.calls[1].headers.Authorization,'Bearer invented-lan-token');
  assert.equal(f.render().acceptedScope,null);
  await f.render().continueProfile();assert.equal(f.render().snapshot.accountId,a.accountId);
  assert.ok(f.calls.every(call=>call.method!=='POST'));
});
