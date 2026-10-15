const test=require('node:test');
const assert=require('node:assert/strict');
const {deferred}=require('./render-harness.cjs');
const {apiFixture,json}=require('./profile-fixture.cjs');
const {pendingModule,memoryStorage,scope,outbox,lease}=require('./pending-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const capture=(revision=1,extra={})=>({conversationId:'chat',composerIdentity:'composer-a',revision,text:'Same intentional text',quotedMessageId:'source-a',...extra});
function fixture({storage=memoryStorage(),send,upload}={}) {
  const api=apiFixture(()=>assert.fail('No real API'));
  const calls=[];
  const client={baseUrl:'http://synthetic.local',scope:scope(),request:async(path,schema,payload)=>{calls.push({path,payload});return send?send(payload):{simulated:false,outbox:outbox(payload.requestId)};},
    uploadImage:async(...args)=>{calls.push({upload:args});return upload?upload(...args):{id:'11111111-1111-4111-8111-111111111111'};},
    uploadAudio:async(...args)=>{calls.push({audio:args});return upload?upload(...args):{id:'11111111-1111-4111-8111-111111111111'};}};
  const module=pendingModule(api,storage),manager=new module.PendingIntents(client,scope(),1);
  return{api,module,manager,client,calls,storage};
}
test('Preparing is synchronous; durable journal precedes clear/network; same revision cannot enqueue twice, identical intentional sends can',async()=>{
  const write=deferred(),storage=memoryStorage();storage.setItem=async(key,value)=>{await write.promise;storage.values.set(key,value);};
  const f=fixture({storage});let cleared=0;
  const first=f.manager.enqueue(capture(),()=>cleared++);
  assert.equal(f.manager.get()[0].phase,'preparing');assert.equal(cleared,0);assert.equal(f.calls.length,0);
  await f.manager.enqueue(capture(),()=>cleared++);write.resolve();await first;await settle();
  assert.equal(cleared,1);assert.equal(f.calls.length,1);
  await f.manager.enqueue(capture(2),()=>cleared++);await settle();assert.equal(f.calls.length,2);
  assert.notEqual(f.calls[0].payload.requestId,f.calls[1].payload.requestId);
  assert.deepEqual(Array.from(f.manager.get(),row=>row.order),[1,2]);
  assert.equal(f.calls[0].payload.quotedMessageId,'source-a');
});
test('earlier media captures caption/quote and orders upload before send; other chats progress independently',async()=>{
  const uploading=deferred(),sending=deferred();
  const f=fixture({upload:()=>uploading.promise,send:payload=>payload.action.kind==='image'?sending.promise:{simulated:false,outbox:outbox(payload.requestId,'accepted',payload.action.text==='Other chat'?'other':'chat')}});
  const image={base64:'synthetic-base64',uri:'synthetic',width:1,height:1};
  await f.manager.enqueue(capture(1,{image,text:'Original caption'}),()=>{});
  await f.manager.enqueue(capture(2,{text:'Later'}),()=>{});
  await f.manager.enqueue(capture(3,{conversationId:'other',text:'Other chat'}),()=>{});await settle();
  assert.equal(f.calls.filter(call=>call.payload).length,1);assert.match(f.calls.find(call=>call.payload).path,/other/);
  uploading.resolve({id:'11111111-1111-4111-8111-111111111111'});await settle();
  const first=f.calls.filter(call=>call.payload)[1];assert.equal(first.payload.action.caption,'Original caption');assert.equal(first.payload.quotedMessageId,'source-a');
  assert.equal(f.manager.get().find(row=>row.revision===2).phase,'waiting');
  sending.resolve({simulated:false,outbox:outbox(first.payload.requestId)});await settle();
  assert.equal(f.calls.filter(call=>call.payload).length,3);
});
test('pending audio lease survives composer unmount and is released exactly once after upload and send',async()=>{
  const bytes=deferred(),response=deferred();let releases=0;
  const clip={uri:'synthetic',bytes:()=>bytes.promise,release:()=>releases++};
  const f=fixture({send:()=>response.promise});await f.manager.enqueue(capture(1,{clip}),()=>{});
  lease.releaseMedia(clip,()=>clip.release());assert.equal(releases,0);
  bytes.resolve(new Uint8Array([1]));await settle();assert.equal(releases,0);
  response.resolve({simulated:false,outbox:outbox(f.manager.get()[0].requestId)});await settle();assert.equal(releases,1);
  f.manager.stop();assert.equal(releases,1);
});
test('unknown, partial and missing acknowledgments stop successors without removing their captured content',async()=>{
  for(const state of ['unknown','partial','timeout']){
    const response=deferred();const f=fixture({send:()=>response.promise});
    await f.manager.enqueue(capture(),()=>{});await f.manager.enqueue(capture(2,{text:'Next'}),()=>{});
    if(state==='timeout')response.reject(new f.api.UnconfirmedMutationError());else response.resolve({simulated:false,outbox:outbox(f.manager.get()[0].requestId,state)});
    await settle();assert.equal(f.calls.length,1);assert.equal(f.manager.get()[0].phase,'uncertain');assert.equal(f.manager.get()[1].phase,'waiting');
    await f.manager.restore(f.manager.get()[0].requestId,()=>assert.fail('Unknown cannot be restored as unsent'));
    assert.equal(f.manager.get().length,2);
  }
});
test('journal write failure/full/corrupt reads preserve composition and perform no network',async()=>{
  const storage=memoryStorage();storage.setItem=async()=>{throw new Error('Disk full');};
  const f=fixture({storage});let cleared=0;
  await assert.rejects(f.manager.enqueue(capture(),()=>cleared++));assert.equal(cleared,0);assert.equal(f.calls.length,0);assert.equal(f.manager.get().length,0);
  const full=fixture({send:()=>new Promise(()=>{})});
  for(let revision=1;revision<=20;revision++)await full.manager.enqueue(capture(revision),()=>{});
  await assert.rejects(full.manager.enqueue(capture(21),()=>cleared++),/20 pending/);assert.equal(cleared,0);assert.equal(full.manager.get().length,20);
  const broken=fixture();broken.storage.values.set(broken.manager.key,'not json');
  await assert.rejects(broken.manager.enqueue(capture(),()=>cleared++),/could not be read/);assert.equal(broken.calls.length,0);
});
test('restart retains IDs/text/quote/upload UUID without media bytes or credentials and never resumes a mutation',async()=>{
  const f=fixture({send:()=>new Promise(()=>{})});
  await f.manager.enqueue(capture(1),()=>{});await f.manager.enqueue(capture(2,{image:{uri:'blob:synthetic',base64:'PRIVATE-BYTES',width:1,height:1}}),()=>{});await settle();
  const saved=JSON.parse(f.storage.values.get(f.manager.key));assert.equal(saved.length,2);
  assert.equal(saved[0].quotedMessageId,'source-a');assert.ok(saved[1].uploadRequestId);assert.doesNotMatch(JSON.stringify(saved),/PRIVATE-BYTES|blob:|token/);
  const restarted=new f.module.PendingIntents(f.client,scope(),2);await restarted.load();await settle();
  assert.equal(f.calls.length,1);assert.equal(restarted.get()[0].phase,'uncertain');assert.equal(restarted.get()[1].phase,'stopped');assert.match(restarted.get()[1].detail,/reattach/);
  assert.equal(restarted.get()[0].requestId,saved[0].requestId);
});
test('read reconciliation requires account/chat/request identity; absence and equal text prove nothing; receipts do not resolve unknown accounting',async()=>{
  const f=fixture({send:()=>{throw new Error('Lost response');}});await f.manager.enqueue(capture(),()=>{});await settle();
  const request=f.manager.get()[0].requestId;
  f.manager.reconcile([outbox(request,'accepted','other'),outbox(request,'accepted','chat','another-account'),outbox('other-request')]);assert.equal(f.manager.get()[0].phase,'uncertain');
  f.manager.reconcile([]);assert.equal(f.manager.get()[0].phase,'uncertain');
  const unknown=outbox(request,'unknown');unknown.components[0].outgoingReceipt={level:'read',observedAt:10,source:'wa_status'};
  f.manager.reconcile([unknown]);assert.equal(f.manager.get()[0].phase,'uncertain');
  f.manager.reconcile([outbox(request)]);assert.equal(f.manager.get()[0].phase,'accepted');assert.equal(f.calls.length,1);
});
test('mismatched mutation identities remain unconfirmed and never advance a successor',async()=>{
  for(const field of ['accountId','conversationId','requestId']){
    const response=deferred(),f=fixture({send:()=>response.promise});await f.manager.enqueue(capture(),()=>{});await f.manager.enqueue(capture(2),()=>{});
    response.resolve({simulated:false,outbox:{...outbox(f.manager.get()[0].requestId),[field]:'wrong-scope-or-request'}});await settle();
    assert.equal(f.manager.get()[0].phase,'uncertain');assert.equal(f.calls.length,1);assert.equal(f.manager.get()[1].phase,'waiting');
  }
});
test('definitive stale-quote rejection preserves the original capture and requires explicit empty-composer restoration',async()=>{
  const f=fixture({send:async()=>{throw new f.api.ApiError('invalid_quote');}});
  await f.manager.enqueue(capture(),()=>{});await settle();const row=f.manager.get()[0];
  assert.equal(row.phase,'failed');assert.equal(row.quotedMessageId,'source-a');assert.equal(row.text,'Same intentional text');
  await assert.rejects(f.manager.restore(row.requestId,()=>false),/newer work/);
  let restored;await f.manager.restore(row.requestId,value=>{restored=value;return true;});assert.equal(restored.quotedMessageId,'source-a');assert.equal(f.calls.length,1);
});
test('scope/background stop upload-to-send and successors; foreground never resumes; explicit restore cannot overwrite newer composition',async()=>{
  for(const mode of ['scope','background']){
    const uploading=deferred();const f=fixture({upload:()=>uploading.promise});
    await f.manager.enqueue(capture(1,{image:{base64:'synthetic',uri:'synthetic'}}),()=>{});
    await f.manager.enqueue(capture(2,{text:'Recoverable'}),()=>{});
    if(mode==='scope')f.manager.stop();else {f.manager.setForeground(false);f.manager.setForeground(true);}
    uploading.resolve({id:'11111111-1111-4111-8111-111111111111'});await settle();f.manager.setForeground(true);await settle();
    assert.equal(f.calls.filter(call=>call.payload).length,0);
    if(mode==='background'){
      const row=f.manager.get().find(row=>row.revision===2);
      await assert.rejects(f.manager.restore(row.requestId,()=>false),/newer work/);
      let restored;await f.manager.restore(row.requestId,value=>{restored=value.text;return true;});assert.equal(restored,'Recoverable');
    }
  }
});
test('background/return during journal persistence never clears or submits the captured composition',async()=>{
  const stored=deferred(),storage=memoryStorage();storage.setItem=async(key,value)=>{await stored.promise;storage.values.set(key,value);};
  const f=fixture({storage});let clears=0;const queued=f.manager.enqueue(capture(),()=>clears++);await settle();
  f.manager.setForeground(false);f.manager.setForeground(true);stored.resolve();await queued;await settle();
  assert.equal(clears,0);assert.equal(f.calls.length,0);assert.equal(f.manager.get()[0].phase,'stopped');
});
test('new binding waits for an old in-progress journal capture without sending or overwriting its recoverable row',async()=>{
  const read=deferred(),storage=memoryStorage();let reads=0;
  storage.getItem=async key=>++reads===1?read.promise:storage.values.get(key)??null;
  const f=fixture({storage});const queued=f.manager.enqueue(capture(),()=>assert.fail('Old scope cannot clear composition'));f.manager.stop();
  const next=new f.module.PendingIntents(f.client,scope('original',2),2);let loaded=false;
  const loading=next.load().then(()=>{loaded=true;});await settle();assert.equal(loaded,false);
  read.resolve(null);await queued;await loading;assert.equal(next.get().length,1);assert.equal(next.get()[0].text,'Same intentional text');assert.equal(f.calls.length,0);
});
test('unknown media keeps its lease until exact read reconciliation resolves it, not merely receipt evidence',async()=>{
  let released=0;const clip={uri:'synthetic',bytes:async()=>new Uint8Array([1]),release:()=>released++};
  const f=fixture({send:payload=>({simulated:false,outbox:outbox(payload.requestId,'unknown')})});
  await f.manager.enqueue(capture(1,{clip}),()=>{});lease.releaseMedia(clip,()=>clip.release());await settle();assert.equal(released,0);
  const request=f.manager.get()[0].requestId,unknown=outbox(request,'unknown');unknown.components[0].outgoingReceipt={level:'read',observedAt:1,source:'wa_status'};
  f.manager.reconcile([unknown]);assert.equal(released,0);f.manager.reconcile([outbox(request)]);assert.equal(released,1);
  f.manager.reconcile([outbox(request,'queued')]);assert.equal(f.manager.get()[0].phase,'accepted');
});
test('accepted mutation is not changed to failure by a later journal write failure',async()=>{
  const storage=memoryStorage(),response=deferred();const f=fixture({storage,send:()=>response.promise});
  await f.manager.enqueue(capture(),()=>{});await settle();storage.setItem=async()=>{throw new Error('Disk full after acceptance');};
  response.resolve({simulated:false,outbox:outbox(f.manager.get()[0].requestId)});await settle();assert.equal(f.manager.get()[0].phase,'accepted');
});
test('mutation timeout/parse/network failure are structured unconfirmed errors and never replay',async()=>{
  for(const response of [()=>{throw new Error('Network');},()=>new Response('not json'),()=>json({unexpected:true})]){
    let calls=0;const api=apiFixture(async()=>{calls++;return response();});const client=new api.ApiClient('http://synthetic.local','synthetic-token',scope());
    await assert.rejects(client.request('/send',api.SendResult,{}),api.UnconfirmedMutationError);assert.equal(calls,1);
  }
});
