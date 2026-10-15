const test=require('node:test');
const assert=require('node:assert/strict');
const {z}=require('zod');
const {load,hooks,deferred,nodes,label}=require('./render-harness.cjs');
const {core,scope,descriptor,snapshot,json,apiFixture,providerFixture}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const operation=(source,target,kind='activate',state='completed',requestId='own-request')=>({requestId,kind,state,sourceScope:source,targetProfileId:target?.profileId ?? null,resultScope:state==='completed'?target:null,error:null});

test('every bound JSON, binary upload, image and audio request carries immutable profile and revision headers',async()=>{
  const calls=[];const source=scope();
  const {ApiClient}=apiFixture(async(url,init)=>{
    calls.push({url,...init});
    if(url.endsWith('/audio-uploads'))return json({id:'00000000-0000-4000-8000-000000000001',mime:'audio/ogg; codecs=opus',duration:1});
    if(url.endsWith('/uploads'))return json({id:'00000000-0000-4000-8000-000000000001',mime:'image/jpeg',width:1,height:1});
    if(url.endsWith('/media/audio'))return new Response(new Uint8Array([1]),{headers:{'Content-Type':'audio/mpeg'}});
    if(url.endsWith('/media/image'))return new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/png'}});
    return json({ok:true});
  });
  const client=new ApiClient('http://synthetic.local','synthetic-token',source);source.revision=99;
  await client.request('/v1/snapshot',z.object({ok:z.boolean()}));
  await client.request('/v1/conversations/same-jid/composer',z.object({ok:z.boolean()}),{hasText:true});
  await client.uploadImage('same-jid',btoa('synthetic'),'upload-image');
  await client.uploadAudio('same-jid',new Uint8Array([1]),'upload-audio');
  await client.audio('same-jid','audio',new AbortController().signal);
  await client.media('same-jid','image',new AbortController().signal);
  assert.equal(calls.length,6);
  for(const call of calls){assert.equal(call.headers.Authorization,'Bearer synthetic-token');assert.equal(call.headers['X-Otherme-Profile'],'original');assert.equal(call.headers['X-Otherme-Revision'],'0');}
  assert.ok(Object.isFrozen(client.scope));
  await assert.rejects(new ApiClient('http://synthetic.local','synthetic-token').request('/v1/snapshot',z.unknown()),/Review the active account/);
  assert.equal(calls.length,6);
});

test('revocation rejects delayed JSON, upload, image and audio bodies, including transports ignoring abort',async()=>{
  for(const kind of ['json','imageUpload','audioUpload','image','audio']){
    const body=deferred();let signal;
    const {ApiClient}=apiFixture(async(_url,init)=>{signal=init.signal;return {ok:true,headers:new Headers({'Content-Type':kind==='audio'?'audio/mpeg':'image/png'}),json:()=>body.promise,arrayBuffer:()=>body.promise};});
    const client=new ApiClient('http://synthetic.local','synthetic-token',scope());
    const pending=kind==='json'?client.request('/v1/snapshot',z.unknown()):kind==='imageUpload'?client.uploadImage('same-jid',btoa('synthetic'),'image'):
      kind==='audioUpload'?client.uploadAudio('same-jid',new Uint8Array([1]),'audio'):kind==='image'?client.media('same-jid','same-message',new AbortController().signal):client.audio('same-jid','same-message',new AbortController().signal);
    const rejected=assert.rejects(pending,/Connection changed/);await settle();client.revoke();assert.equal(signal.aborted,true);
    body.resolve(kind==='image'||kind==='audio'?new ArrayBuffer(1):{});await rejected;
    await assert.rejects(client.request('/v1/mutate',z.unknown(),{}),/Connection changed/);
  }
});

test('426 and pre-profile service 404 give upgrade guidance; scope rejection never retries a mutation',async()=>{
  for(const status of [404,426]){
    let calls=0;
    const {ApiClient}=apiFixture(async()=>{calls++;return json({error:'not_found'},status);});
    await assert.rejects(new ApiClient('http://synthetic.local','synthetic-token').session(),/Update Otherme and the Windows service/);
    assert.equal(calls,1);
  }
  for(const code of ['profile_scope_changed','profile_transition_in_progress']){
    let calls=0,invalidated=0;
    const {ApiClient}=apiFixture(async()=>{calls++;return json({error:code},409);});
    const client=new ApiClient('http://synthetic.local','synthetic-token',scope(),()=>{invalidated++;client.revoke();});
    await assert.rejects(client.request('/v1/mutate',z.unknown(),{}));assert.equal(calls,1);assert.equal(invalidated,1);
    await assert.rejects(client.request('/v1/mutate',z.unknown(),{}));assert.equal(calls,1);
  }
});

test('discovery precedes all account data; Continue acknowledges only the descriptor displayed',async()=>{
  const f=providerFixture(),a=scope(),b=scope('second',1);let visible=a;
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(visible):snapshot(visible)));
  await f.render().connect('http://synthetic.local','synthetic-token');
  assert.equal(f.render().snapshot,null);assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/v1/session');
  visible=b;await f.render().continueProfile();
  assert.equal(f.render().snapshot,null);assert.equal(f.render().discovery.scope.profileId,'second');
  assert.ok(f.calls.every(c=>c.path==='/v1/session'));
  await f.render().continueProfile();assert.equal(f.render().snapshot.accountId,b.accountId);
});

test('external scope change revokes before render, clears history and requires Continue without automatic history fetch',async()=>{
  const f=providerFixture(),a=scope(),b=scope('second',1);await f.connect(a);const old=f.render();
  f.respond(async call=>call.path.endsWith('/history')?json({messages:[],watermark:1}):json(call.path==='/v1/session'?descriptor(b):snapshot(b)));
  await old.history.load('same-jid');assert.ok(old.history.get('same-jid'));
  const stops=f.stops();await old.refresh();
  await assert.rejects(old.client.request('/v1/mutate',z.unknown(),{}),/Connection changed/);
  const changed=f.render();assert.equal(changed.snapshot,null);assert.equal(changed.acceptedScope,null);assert.ok(f.stops()>stops);
  const count=f.calls.length;await old.composer('same-jid',true).catch(()=>{});assert.equal(f.calls.length,count);
  assert.equal(f.calls.filter(c=>c.path==='/v1/snapshot').length,1);
  await changed.continueProfile();const next=f.render();
  assert.equal(next.snapshot.accountId,b.accountId);assert.notEqual(next.client,old.client);assert.notEqual(next.history,old.history);assert.notEqual(next.clock,old.clock);
  assert.equal(next.history.get('same-jid'),undefined);assert.notEqual(next.sessionKey,old.sessionKey);
});

test('A-B-A revisions replace caches and reject late first-A snapshots and queued composer callbacks',async()=>{
  const f=providerFixture(),a=scope(),b=scope('second',1),back=scope('original',2);await f.connect(a);const first=f.render();
  const late=deferred(),hold=deferred();let visible=a;
  f.respond(async call=>{
    if(call.path==='/v1/session')return json(descriptor(visible));
    if(call.path==='/v1/snapshot' && visible===a)return late.promise;
    if(call.path.endsWith('/composer'))return hold.promise;
    return json(snapshot(visible));
  });
  const refreshing=first.refresh(),composing=first.composer('same-jid',true),queued=first.composer('same-jid',false);
  const rejected=Promise.all([assert.rejects(composing,/Connection changed/),assert.rejects(queued,/Connection changed/)]);await settle();
  visible=b;await f.render().refresh();await f.render().continueProfile();const second=f.render();
  visible=back;await second.refresh();await f.render().continueProfile();const returned=f.render();
  assert.equal(returned.acceptedScope.revision,2);assert.notEqual(returned.sessionKey,first.sessionKey);assert.notEqual(returned.history,first.history);assert.notEqual(returned.clock,first.clock);
  late.resolve(json(snapshot(a,99)));hold.resolve(json({acknowledged:true,conversation:snapshot(a).conversations[0]}));await refreshing;await rejected;
  assert.equal(f.render().acceptedScope.revision,2);assert.equal(f.render().snapshot.profileScope.revision,2);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/composer')).length,1);
});

test('an older discovery response cannot flip a newer accepted revision back',async()=>{
  const f=providerFixture(),a=scope(),back=scope('original',2),late=deferred();await f.connect(a);let reads=0;
  f.respond(async call=>call.path==='/v1/session'?(++reads===1?late.promise:json(descriptor(back))):json(snapshot(back)));
  const pending=f.render().refresh();await settle();await f.render().refresh();await f.render().continueProfile();
  late.resolve(json(descriptor(a)));await pending;
  assert.equal(f.render().discovery.scope.revision,2);assert.equal(f.render().snapshot.profileScope.revision,2);
});

test('own explicit create, return and repair confirmation binds only its matching completed operation',async()=>{
  for(const kind of ['create','activate','repair']){
    const f=providerFixture(),a=scope(),target=kind==='repair'?scope('original',1):scope('second',1);await f.connect(a);let completed=false;
    const input={requestId:'own-request',kind,confirm:true,...(kind==='create'?{label:'Fresh'}:kind==='activate'?{profileId:target.profileId}:{})};
    const pending=operation(a,target,kind,'pending');
    f.respond(async call=>call.method==='POST'?json({operation:pending},202):call.path.startsWith('/v1/profile-operations/')?json(completed?operation(a,target,kind):pending):
      json(call.path==='/v1/session'?descriptor(completed?target:a,completed?operation(a,target,kind):pending):snapshot(target)));
    await f.render().transitionProfile(input);let state=f.render();assert.equal(state.snapshot,null);assert.equal(state.operation.state,'pending');
    await state.refresh();assert.equal(f.render().profileBusy,true);assert.equal(f.render().snapshot,null);
    completed=true;await f.render().refresh();state=f.render();assert.equal(state.acceptedScope.revision,1);assert.equal(state.snapshot.accountId,target.accountId);
    assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  }
});

test('another operation or mismatched target does not reuse this clients confirmation',async()=>{
  for(const mismatch of ['request','kind','target','source']){
    const f=providerFixture(),a=scope(),b=scope('second',1);await f.connect(a);let completed=false;
    const pending=operation(a,b,'activate','pending');const done=operation(a,b);
    if(mismatch==='request')done.requestId='another-client';if(mismatch==='kind')done.kind='create';if(mismatch==='target')done.targetProfileId='wrong';if(mismatch==='source')done.sourceScope=scope('original',3);
    f.respond(async call=>call.method==='POST'?json({operation:pending},202):call.path.startsWith('/v1/profile-operations/')?json(done):json(call.path==='/v1/session'?descriptor(completed?b:a,completed?done:pending):snapshot(b)));
    await f.render().transitionProfile({requestId:'own-request',kind:'activate',confirm:true,profileId:'second'});completed=true;
    await f.render().refresh();assert.equal(f.render().snapshot,null);assert.equal(f.render().acceptedScope,null);
    await f.render().continueProfile();assert.equal(f.render().snapshot.accountId,b.accountId);
  }
});

test('404/409 lifecycle rejections and lost acknowledgements only poll readonly routes, never retry POST',async()=>{
  for(const status of [404,409,'lost']){
    const f=providerFixture(),a=scope();await f.connect(a);
    f.respond(async call=>{if(call.method==='POST'){if(status==='lost')throw new Error('synthetic connection loss');return json({error:status===409?'profile_scope_changed':'not_found'},status);}
      return call.path.startsWith('/v1/profile-operations/')?json({error:'not_found'},404):json(descriptor(a));});
    await f.render().transitionProfile({requestId:'own-request',kind:'repair',confirm:true});
    await f.render().refresh();await f.render().refresh();
    assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.render().snapshot,null);assert.equal(f.render().acceptedScope,null);
    assert.ok(f.calls.slice(3).filter(c=>c.method!=='POST').every(c=>c.path==='/v1/session'||c.path.startsWith('/v1/profile-operations/')));
  }
});

test('pending transition polling stops with an unconfirmed status rather than claiming completion',async()=>{
  const f=providerFixture(),a=scope(),b=scope('second',1);await f.connect(a);const pending=operation(a,b,'activate','restarting');
  f.respond(async()=>json(descriptor(a,pending)));await f.render().refresh();
  f.render();f.h.flush();const timer=f.timers.at(-1);assert.ok(timer);
  for(let i=0;i<31;i++)timer();await settle();
  assert.equal(f.render().snapshot,null);assert.match(f.render().profileNotice,/not confirmed/);assert.equal(f.render().profileBusy,false);
  assert.ok(!f.calls.some(c=>c.method==='POST'));
});

test('SecureStore session writes cannot finish out of order and restore old URL/token/scope',async()=>{
  const delayed=deferred(),writes=[];let first=true;
  const f=providerFixture({save:async(_key,value)=>{const data=JSON.parse(value);if(first){first=false;await delayed.promise;}writes.push(data);}});
  const a=scope(),b=scope('second',1);let current=a;
  f.respond(async call=>json(call.path==='/v1/session'?descriptor(current):snapshot(current)));
  await f.render().connect('http://first.synthetic','first-synthetic-token');const old=f.render().continueProfile();await settle();
  current=b;await f.render().connect('http://second.synthetic','second-synthetic-token');const next=f.render().continueProfile();await settle();
  assert.equal(writes.length,0);delayed.resolve();await old;await next;
  assert.equal(writes.at(-1).url,'http://second.synthetic');assert.equal(writes.at(-1).token,'second-synthetic-token');assert.equal(writes.at(-1).scope.profileId,'second');assert.equal(f.render().snapshot.accountId,b.accountId);
});

test('new scope revocation does not wait for a delayed readonly own-operation lookup',async()=>{
  const f=providerFixture(),a=scope(),b=scope('second',1);await f.connect(a);const old=f.render(),post=deferred(),lookup=deferred();
  f.respond(async call=>call.method==='POST'?post.promise:call.path==='/v1/session'?json(descriptor(b)):call.path.startsWith('/v1/profile-operations/')?lookup.promise:json(snapshot(b)));
  const transition=old.transitionProfile({requestId:'own-request',kind:'activate',confirm:true,profileId:'second'});
  const waiting=f.render().refresh();await settle();assert.equal(f.render().acceptedScope,null);assert.equal(f.render().snapshot,null);
  assert.throws(()=>old.client.assertActive(),/Connection changed/);
  lookup.resolve(json(operation(a,b)));await waiting;assert.equal(f.render().acceptedScope.revision,1);
  post.resolve(json({operation:operation(a,b,'activate','pending')},202));await transition;
  assert.equal(f.render().acceptedScope.revision,1);assert.equal(f.render().snapshot.accountId,b.accountId);
});

test('saved identical scope restores after discovery, changed saved scope needs visible Continue',async()=>{
  for(const changed of [false,true]){
    const a=scope(),b=changed?scope('second',1):a;
    const f=providerFixture({saved:JSON.stringify({url:'http://synthetic.local',token:'synthetic-token',scope:a})});
    f.respond(async call=>json(call.path==='/v1/session'?descriptor(b):snapshot(b)));
    f.render();f.h.flush();await settle();
    assert.equal(f.calls[0].path,'/v1/session');assert.equal(!!f.render().snapshot,!changed);
    if(changed)assert.equal(f.calls.length,1);
  }
});

test('root keys both draft provider and navigation by accepted scope epoch, and gates unacknowledged accounts',()=>{
  let app={acceptedScope:scope(),sessionKey:'1:original:0',dark:false};
  const root=load('app/_layout.tsx',{'expo-router':{Stack:'stack'},'expo-status-bar':{StatusBar:'status'},'react-native-safe-area-context':{SafeAreaView:'safe'},'./(tabs)/settings':'settings',
    'expo-font':{useFonts:()=>[true,null]},'@expo-google-fonts/inter/400Regular':{},'@expo-google-fonts/inter/500Medium':{},'@expo-google-fonts/inter/600SemiBold':{},'@expo-google-fonts/inter/700Bold':{},
    '../lib/app-state':{AppProvider:'app',useApp:()=>app},'../lib/local-drafts':{LocalDraftProvider:'drafts'},'../lib/theme':{fonts:{}}});
  const boundary=root.default().props.children.type;const first=boundary();assert.equal(first.type,'drafts');assert.equal(first.key,app.sessionKey);assert.equal(first.props.children.key,app.sessionKey);
  app={...app,acceptedScope:scope('original',2),sessionKey:'3:original:2'};const back=boundary();assert.notEqual(back.key,first.key);assert.notEqual(back.props.children.key,first.props.children.key);
  app={...app,acceptedScope:null};const gate=boundary();assert.equal(gate.type,'safe');assert.ok(nodes(gate).some(n=>n.type==='settings'));assert.ok(!nodes(gate).some(n=>n.type==='drafts'));
});

test('profile UI previews consequences and needs separate confirmation for create, return and same-owner repair',async()=>{
  for(const kind of ['create','activate','repair']){
    const h=hooks(),sent=[];const a=scope();
    const app={palette:{},client:{request:async()=>({profiles:[{profileId:'second',accountId:'whatsapp-second',label:'Preserved',active:false}]})},acceptedScope:a,discovery:descriptor(a),profileBusy:false,operation:null,status:'online',
      transitionProfile:async input=>sent.push(core.ProfileTransitionInput.parse(input)),reportError:assert.fail};
    const component=load('components/profile-controls.tsx',{'react':h.react,'react-native':{Text:'text',TextInput:'input',View:'view'},'@replybot/core/api':core,
      '../lib/app-state':{useApp:()=>app},'../lib/uuid':{randomUUID:()=> 'own-request'},'../lib/theme':{fonts:{}},'./ui':{Button:'button'}});
    const render=()=>h.render(component.ProfileControls);let tree=render();
    if(kind==='create'){label(tree,'Fresh profile label').props.onChangeText('Fresh');tree=render();nodes(tree).find(n=>n.props?.label==='Use another number').props.onPress();}
    else if(kind==='activate'){nodes(tree).find(n=>n.props?.label==='Return to preserved profile').props.onPress();await settle();nodes(render()).find(n=>n.props?.label==='Return to Preserved').props.onPress();}
    else nodes(tree).find(n=>n.props?.label==='Repair this number').props.onPress();
    tree=render();assert.equal(sent.length,0);assert.ok(nodes(tree).some(n=>JSON.stringify(n.props?.children ?? '').includes('Its data stays preserved. AI will be off.')));
    nodes(tree).find(n=>n.type==='button'&&n.props?.label==='Confirm account change').props.onPress();await settle();assert.equal(sent.length,1);assert.equal(sent[0].kind,kind);assert.equal(sent[0].confirm,true);
  }
});
