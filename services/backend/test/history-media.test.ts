import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import makeWASocket, { proto, type WAMessage } from '@whiskeysockets/baileys';
import { SqliteStore, Workflow, type Conversation, type ModelContext } from '@replybot/core';
import { MediaSource, SessionDiscovery } from '@replybot/core/api';
import { MediaService } from '../src/media.ts';
import { MediaDisplay } from '../src/media-display.ts';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { normalizeWhatsApp, inspectHistoryRaw } from '../src/whatsapp-normalize.ts';
import { createApp } from '../src/server.ts';
import { draftGenerator } from '../src/draft-model.ts';
const phone='15550000001@s.whatsapp.net',lid='15550000001@lid';
function conversation(id=phone):Conversation{return {id,accountId:'a',contactId:id,name:'Synthetic',kind:'direct',mode:null,excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null};}
function raw(id='photo',chat=phone):WAMessage{return {key:{remoteJid:chat,id,fromMe:false},messageTimestamp:1,message:{imageMessage:{
  fileSha256:Buffer.alloc(32,1),mediaKey:Buffer.alloc(32,2),fileLength:100,mimetype:'image/jpeg',width:32,height:64,url:'https://mmg.whatsapp.net/synthetic'}}};}
function serialized(value:WAMessage):string{return JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(value).finish()).toString('base64')});}
function fixture(value=raw()){
  const store=new SqliteStore();store.inspectHistoryRaw=inspectHistoryRaw;store.saveConversation(conversation(value.key.remoteJid ?? phone));
  const message=normalizeWhatsApp(value,'a',value.key.remoteJid ?? phone,'live');assert.ok(message);
  store.saveMessage(message);store.saveWaMessage('a',message.conversationId,message.transportId,serialized(value));
  const flow=new Workflow(store,'a',()=>1000);return {store,message,flow};
}

test('metadata validates offline with no binary loads, excludes CDN locations from versions and denies raw-media conflicts',async()=>{
  const {store,flow,message}=fixture();let loads=0;
  const media=new MediaService(async()=>{loads++;throw new Error('No metadata download');},()=>true,()=>1000);
  const display=new MediaDisplay(flow,media,()=>1000);
  try{
    const source=MediaSource.parse(display.source(phone,message.id,'image'));
    assert.equal(source.state,'available');assert.equal(source.mime,'image/jpeg');assert.equal(source.validUntil-source.validatedAt,30000);assert.equal(loads,0);
    assert.doesNotMatch(JSON.stringify(source),/mmg|mediaKey|protobuf|Synthetic/);
    const value=raw();assert.ok(value.message?.imageMessage);value.message.imageMessage.url='https://mmg.whatsapp.net/refreshed';
    const epoch=store.historyGroup('a',phone).sourceEpoch;store.saveWaMessage('a',phone,'photo',serialized(value));
    assert.equal(store.historyGroup('a',phone).sourceEpoch,epoch);assert.equal(display.source(phone,message.id,'image').sourceVersion,source.sourceVersion);
    store.saveConversation({...conversation(lid),kind:'unknown'});store.saveWaAlias('a',lid,phone);
    assert.notEqual(display.source(phone,message.id,'image').sourceVersion,source.sourceVersion);
    const copy=normalizeWhatsApp({...value,key:{...value.key,remoteJid:lid}},'a',lid,'live');assert.ok(copy);store.saveMessage(copy);
    value.message.imageMessage.mediaKey=Buffer.alloc(32,3);store.saveWaMessage('a',lid,'photo',serialized({...value,key:{...value.key,remoteJid:lid}}));
    assert.equal(display.source(phone,message.id,'image').state,'conflict');assert.equal(loads,0);
  }finally{store.close();}
});

test('owner image output is oriented bounded JPEG; preview does not prepare model frames and both share bounded preparation',async()=>{
  const {store,flow,message}=fixture();let loads=0;
  const input=await sharp({create:{width:32,height:64,channels:3,background:'#448866'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const media=new MediaService(async()=>{loads++;return input;},()=>true,()=>1000);
  const display=new MediaDisplay(flow,media,()=>1000);
  try{
    const photo=display.source(phone,message.id,'image');const result=await display.content(phone,message.id,'image',photo.sourceVersion);
    assert.equal(result.mime,'image/jpeg');const metadata=await sharp(result.bytes).metadata();assert.equal(metadata.width,64);assert.equal(metadata.height,32);assert.equal(metadata.exif,undefined);assert.ok(result.bytes.length<=4*1024*1024);
    assert.equal(media['cache'].size,1);assert.ok([...media['cache'].values()].every(v=>v.frames===undefined));
    const preview=display.source(phone,message.id,'preview');const p=await display.content(phone,message.id,'preview',preview.sourceVersion);assert.equal(p.mime,'image/png');
    assert.ok([...media['cache'].values()].every(v=>v.frames===undefined));
    await display.content(phone,message.id,'image',photo.sourceVersion);assert.equal(loads,2);
    store.saveConversation({...flow.conversation(phone),mode:'never_reply',excluded:true});
    assert.equal(display.source(phone,message.id,'image').state,'available');assert.throws(()=>flow.context(phone),/ai_access_denied/);
  }finally{store.close();}
});

test('deletion, profile revocation and version changes during coalesced media preparation never publish stale bytes',async()=>{
  for(const change of ['delete','profile','version'] as const){
    const {store,flow,message}=fixture();let release:(value:Buffer)=>void=()=>{};let admitted=true;let loads=0;
    const media=new MediaService(async()=>{loads++;return new Promise<Buffer>(done=>{release=done;});},()=>true,()=>1000);
    const display=new MediaDisplay(flow,media,()=>1000,()=>admitted);
    const input=await sharp({create:{width:2,height:2,channels:3,background:'#112233'}}).png().toBuffer();
    try{
      const source=display.source(phone,message.id,'image');const first=display.content(phone,message.id,'image',source.sourceVersion);const second=display.content(phone,message.id,'image',source.sourceVersion);
      const rejected=Promise.all([assert.rejects(first,/media_source_changed/),assert.rejects(second,/media_source_changed/)]);
      if(change==='delete')flow.restrictSource(phone,message.transportId,'deleted');
      else if(change==='profile')admitted=false;
      else store.saveMessage({...message,text:'Changed source'});
      release(input);await rejected;assert.equal(loads,1);assert.equal(media['cache'].size,0);
    }finally{store.close();}
  }
});

test('queued owner work expires within its total deadline and cannot start later; pending admission stays bounded',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {store,flow,message}=fixture();let loads=0;const releases:Array<(bytes:Buffer)=>void>=[];
  const media=new MediaService(async()=>{loads++;return new Promise<Buffer>(done=>releases.push(done));},()=>true,()=>1000);
  const display=new MediaDisplay(flow,media,()=>1000);
  try{
    const a=display.source(phone,message.id,'image'),b=display.source(phone,message.id,'preview');
    const first=display.content(phone,message.id,'image',a.sourceVersion),second=display.content(phone,message.id,'preview',b.sourceVersion);
    const runningTimeouts=Promise.all([assert.rejects(first,/media_preparation_timeout/),assert.rejects(second,/media_preparation_timeout/)]);
    const third=media.display({...message,id:'third'},'image','third',()=>{});const expired=assert.rejects(third,/media_preparation_timeout/);
    assert.equal(loads,2);t.mock.timers.tick(45000);await expired;assert.equal(loads,2);assert.equal(media['waiting'].length,0);
    flow.restrictSource(phone,message.transportId,'deleted');
    for(const release of releases)release(Buffer.from('never decoded'));await runningTimeouts;assert.equal(loads,2);
  }finally{store.close();t.mock.timers.reset();}
});

test('ordinary owner video requires positive bounded MP4 metadata and ftyp, stays unsupported for AI and never samples frames',async()=>{
  const value:WAMessage={key:{remoteJid:phone,id:'video',fromMe:false},messageTimestamp:1,message:{videoMessage:{
    mimetype:'video/mp4',fileLength:20,seconds:10,width:1280,height:720,mediaKey:Buffer.alloc(32,1),fileSha256:Buffer.alloc(32,2)}}};
  const {store,flow,message}=fixture(value);let loads=0;
  const media=new MediaService(async(_m,video)=>{assert.equal(video,true);loads++;return Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,0,0,0,0]);},()=>true,()=>1000);
  const display=new MediaDisplay(flow,media,()=>1000);
  try{
    assert.equal(message.media?.access,'unsupported');const source=display.source(phone,message.id,'video');assert.equal(source.state,'available');
    assert.equal((await display.content(phone,message.id,'video',source.sourceVersion)).mime,'video/mp4');
    const context:ModelContext={instructions:'Synthetic',messages:[message],memories:[],styleExamples:[],limitations:[],worstCaseTextTokens:1};assert.deepEqual(await media.visuals(context),[]);assert.equal(loads,1);
    assert.ok(value.message?.videoMessage);
    for(const patch of [{seconds:0},{seconds:301},{fileLength:10485761},{width:1921},{height:1081},{mimetype:'video/webm'}]){
      const changed={...value,message:{videoMessage:{...value.message.videoMessage,...patch}}};store.saveWaMessage('a',phone,'video',serialized(changed));assert.equal(display.source(phone,message.id,'video').state,'unsupported');
    }
    store.saveWaMessage('a',phone,'video',serialized(value));
    const bad=new MediaDisplay(flow,new MediaService(async()=>Buffer.from('not mp4 data'),()=>true,()=>1000),()=>1000);
    const valid=bad.source(phone,message.id,'video');await assert.rejects(bad.content(phone,message.id,'video',valid.sourceVersion),/media_unsupported/);
  }finally{store.close();}
});

test('session flags are opt-in twice; page/source/content routes retain auth, profile, no-store, version and Range guards',async()=>{
  const {store,message}=fixture();const app=createApp({store,token:'synthetic',accountId:'a',seed:false,profileScope:{profileId:'original',accountId:'a',revision:3},now:()=>1000});
  const auth={authorization:'Bearer synthetic'},headers={...auth,'x-otherme-profile':'original','x-otherme-revision':'3'};
  const base='/v1/conversations/'+encodeURIComponent(phone)+'/media/'+encodeURIComponent(message.id);
  try{
    const plain=(await app.inject({method:'GET',url:'/v1/session',headers:auth})).json();assert.equal(plain.capabilities,undefined);
    const legacy=(await app.inject({method:'GET',url:'/v1/session?capabilities=1',headers:auth})).json();assert.deepEqual(Object.keys(legacy.capabilities).sort(),['contactBookNames','desktopBrowser','ownerInstructions','pcQrDisplay']);
    const modern=SessionDiscovery.parse((await app.inject({method:'GET',url:'/v1/session?capabilities=1&historyMedia=1',headers:auth})).json());assert.equal(modern.capabilities?.historyPaging,true);assert.equal(modern.capabilities?.privateMediaCache,true);
    assert.equal(SessionDiscovery.parse(legacy).capabilities?.historyPaging,undefined);
    assert.equal((await app.inject({method:'GET',url:base+'/source?variant=image'})).statusCode,401);
    assert.equal((await app.inject({method:'GET',url:base+'/source?variant=image',headers:auth})).statusCode,426);
    assert.equal((await app.inject({method:'GET',url:base+'/source?variant=image',headers:{...headers,'x-otherme-revision':'2'}})).statusCode,409);
    const response=await app.inject({method:'GET',url:base+'/source?variant=image',headers});assert.equal(response.statusCode,200);assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.headers['x-content-type-options'],'nosniff');
    const source=MediaSource.parse(response.json());assert.equal(source.state,'available');
    assert.equal((await app.inject({method:'GET',url:base+'/content?variant=image&sourceVersion='+source.sourceVersion,headers:{...headers,range:'bytes=0-1'}})).statusCode,416);
    assert.equal((await app.inject({method:'GET',url:base+'/content?variant=image&sourceVersion='+'0'.repeat(64),headers})).json().error,'media_source_changed');
    const page=await app.inject({method:'GET',url:'/v1/conversations/'+encodeURIComponent(phone)+'/history-page',headers});assert.equal(page.statusCode,200);assert.equal(page.json().messages[0].id,message.id);
    const viewed=await app.inject({method:'POST',url:'/v1/conversations/'+encodeURIComponent(phone)+'/viewed-messages',headers,payload:{requestId:'view',messageIds:[message.id,message.id]}});assert.deepEqual(viewed.json(),{viewed:true});assert.equal(store.unreadCounts('a')[phone],undefined);
  }finally{await app.close();}
});

test('empty/full and legacy blank/full upserts repair original raw keys without historical jobs, replay writes or a second physical row',async()=>{
  const store=new SqliteStore();store.saveConversation({...conversation(lid),kind:'unknown'});store.saveConversation(conversation());const flow=new Workflow(store,'a',()=>1000);let jobs=0;
  const adapter=new WhatsAppAdapter(flow,'unused',async()=>{jobs++;},undefined,()=>1000);
  try{
    const blank:WAMessage={key:{remoteJid:lid,id:'partial',fromMe:false},messageTimestamp:1,message:{}};
    await adapter['receive'](blank,'live');const saved=store.messages('a',lid)[0];assert.ok(saved);assert.equal(saved.contentState,'partial');assert.equal(jobs,0);
    adapter['canonical'](lid,phone);const pause=flow.conversation(phone).pause;
    const full:WAMessage={...blank,key:{...blank.key,remoteJidAlt:phone},message:{conversation:'Recovered full text'}};
    await adapter['receive'](full,'live');assert.equal(jobs,0);assert.equal(store.messages('a',lid).length,1);assert.equal(store.messages('a',phone).length,0);
    const recovered=store.message('a',saved.id);assert.equal(recovered?.contentRecovered,true);assert.equal(recovered?.text,'Recovered full text');assert.deepEqual(flow.conversation(phone).pause,pause);assert.equal(store.unreadCounts('a')[phone],undefined);
    assert.equal(adapter['raw'](phone,'partial')?.key.remoteJid,lid);
    const epoch=store.historyGroup('a',phone).sourceEpoch;await adapter['receive'](full,'replay');assert.equal(store.historyGroup('a',phone).sourceEpoch,epoch);
    const version=flow.conversation(phone).workflowVersion;await adapter['receive']({...blank,key:{remoteJid:phone,id:'cipher'},message:null},'replay');assert.equal(flow.conversation(phone).workflowVersion,version);
    await adapter['receive']({...full,message:{conversation:'Conflicting full content'}},'replay');assert.equal(store.historySource('a',phone,saved.id)?.state,'conflict');assert.equal(adapter['raw'](phone,'partial'),undefined);
    adapter['erase'](phone,'partial');assert.equal(store.historySource('a',phone,saved.id)?.state,'deleted');await adapter['receive'](full,'replay');assert.equal(store.message('a',saved.id)?.text,'[Message deleted]');
  }finally{await adapter.stop();store.close();}
});

test('accepted owner upload metadata loads no bytes and authenticated complete JPEG content carries the expected version',async()=>{
  const {store,flow}=fixture();
  const input=await sharp({create:{width:20,height:10,channels:3,background:'#334455'}}).jpeg().toBuffer();
  const upload=flow.stageImage(phone,{mime:'image/jpeg',width:20,height:10,bytes:input},'upload');
  const box=flow.manualSend(phone,{kind:'image',uploadId:upload.id,caption:'Synthetic image',reason:'Synthetic'},'owner-photo');
  await flow.dispatch(box.id,async()=>({state:'accepted',transportId:'owner-photo'}));
  const m=store.messages('a',phone).find(m=>m.transportId==='owner-photo');assert.ok(m);
  let binaryLoads=0;const original=store.sentImageUpload.bind(store);
  store.sentImageUpload=(...args)=>{binaryLoads++;return original(...args);};
  const app=createApp({store,token:'synthetic',accountId:'a',seed:false,now:()=>1000});const headers={authorization:'Bearer synthetic'};
  const base='/v1/conversations/'+encodeURIComponent(phone)+'/media/'+encodeURIComponent(m.id);
  try{
    const descriptor=MediaSource.parse((await app.inject({method:'GET',url:base+'/source?variant=image',headers})).json());
    assert.equal(descriptor.state,'available');assert.equal(binaryLoads,0);
    const response=await app.inject({method:'GET',url:base+'/content?variant=image&sourceVersion='+descriptor.sourceVersion,headers});
    assert.equal(response.statusCode,200);assert.equal(response.headers['content-type'],'image/jpeg');assert.equal(response.headers['x-otherme-media-version'],descriptor.sourceVersion);
    assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.rawPayload[0],255);assert.equal(response.rawPayload[1],216);assert.equal(binaryLoads,1);
  }finally{await app.close();}
});

test('cached retired-alias manual requests reconcile their original result and hash without dispatch; fresh actions cannot redirect',async()=>{
  const store=new SqliteStore();store.saveConversation(conversation());store.saveConversation({...conversation(lid),kind:'unknown'});
  const flow=new Workflow(store,'a',()=>1000);const action={kind:'text',text:'Recorded owner text',reason:'Synthetic'} as const;
  const old=flow.manualSend(lid,action,'old');const request=store.request('a','old');store.saveWaAlias('a',lid,phone);
  const app=createApp({store,token:'synthetic',accountId:'a',seed:false,now:()=>1000});
  const headers={authorization:'Bearer synthetic'},url='/v1/conversations/'+encodeURIComponent(lid)+'/manual-send';
  try{
    const replay=await app.inject({method:'POST',url,headers,payload:{requestId:'old',action}});
    assert.equal(replay.statusCode,200);assert.deepEqual(replay.json().outbox,old);assert.equal(store.outbox('a',old.id)?.state,'queued');assert.deepEqual(store.request('a','old'),request);
    const fresh=await app.inject({method:'POST',url,headers,payload:{requestId:'fresh',action}});assert.equal(fresh.statusCode,409);assert.equal(fresh.json().error,'retired_alias_read_only');
    const mismatch=await app.inject({method:'POST',url,headers,payload:{requestId:'old',action:{...action,text:'Changed'}}});assert.equal(mismatch.json().error,'request_id_conflict');
    assert.equal(store.outboxes('a').length,1);assert.equal(store.outbox('a',old.id)?.conversationId,lid);
  }finally{await app.close();}
});

test('canonical owner quotes use the real physical LID envelope without rebinding the source or send destination',async()=>{
  const value:WAMessage={key:{remoteJid:lid,id:'old-source',fromMe:false},messageTimestamp:1,message:{conversation:'Old real source'}};
  const {store,flow,message}=fixture(value);store.saveConversation(conversation());store.saveConversation({...conversation(lid),kind:'unknown'});store.saveWaAlias('a',lid,phone);
  const box=flow.manualSend(phone,{kind:'text',text:'Owner reply',quotedMessageId:'wa:'+phone+':old-source',reason:'Synthetic'},'quoted');
  let calls=0;
  type Socket=ReturnType<typeof makeWASocket>;
  const socket:Pick<Socket,'user'|'sendMessage'|'end'>={user:{id:'15550000999@s.whatsapp.net'},end:async()=>{},sendMessage:async(jid,_content,options)=>{
    calls++;assert.equal(jid,phone);assert.equal(options?.quoted?.key.remoteJid,lid);assert.equal(options?.quoted?.key.id,'old-source');
    return {key:{remoteJid:phone,fromMe:true,id:options?.messageId ?? 'missing'},message:{conversation:'Owner reply'},messageTimestamp:1};
  }};
  const adapter=new WhatsAppAdapter(flow,'unused',async()=>{},undefined,()=>1000);
  Object.defineProperties(adapter,{socket:{value:socket,writable:true},verifiedSocket:{value:socket,writable:true},status:{value:{...adapter.snapshot(),state:'connected'},writable:true}});
  try{
    assert.equal((await adapter.dispatch(box.id)).state,'accepted');assert.equal(calls,1);assert.equal(store.message('a',message.id)?.conversationId,lid);
    assert.equal(store.outbox('a',box.id)?.quotedMessageId,'wa:'+phone+':old-source');assert.equal(store.outbox('a',box.id)?.conversationId,phone);
    adapter['erase'](phone,'old-source');assert.equal(adapter['raw'](phone,'old-source'),undefined);
    assert.throws(()=>flow.manualSend(phone,{kind:'text',text:'Not allowed',quotedMessageId:message.id,reason:'Synthetic'},'deleted-quote'),/invalid_quote/);
  }finally{await adapter.stop();store.close();}
});

test('source-only changes during visual preparation invalidate both context builds before model export without a replacement job',async()=>{
  const {store,flow,message}=fixture();flow.setModelConsent(true,'consent');let modelCalls=0;
  const generate=draftGenerator(flow,{generate:async()=>{modelCalls++;return {kind:'silence',reason:'Synthetic'};}},{visuals:async()=>{
    flow.restrictSource(phone,message.transportId,'conflict');return [];
  }});
  try{
    await assert.rejects(generate(phone,'source-change'),/stale_workflow/);assert.equal(modelCalls,0);assert.equal(store.drafts('a').length,0);assert.equal(store.outboxes('a').length,0);
  }finally{store.close();}
});
