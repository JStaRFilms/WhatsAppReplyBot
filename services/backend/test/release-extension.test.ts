import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { proto } from '@whiskeysockets/baileys';
import { SqliteStore, Workflow, type Action, type Conversation, type Message, type ModelContext } from '@replybot/core';
import { SessionDiscovery } from '@replybot/core/api';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { createApp } from '../src/server.ts';
import { draftGenerator } from '../src/draft-model.ts';
import { OpenRouterClient } from '../src/openrouter.ts';

const id = '15550000001@s.whatsapp.net'; const owner = '15559999999@s.whatsapp.net';
const action: Action = {kind:'text',text:'reply',reason:'test'};
const conversation = (chatId = id): Conversation => ({id:chatId,accountId:'a',contactId:chatId,name:'Legacy label',kind:'direct',mode:null,excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:100,hours:null});
const message = (messageId = 'incoming',chatId = id): Message => ({id:messageId,transportId:messageId,accountId:'a',conversationId:chatId,direction:'inbound',authorship:'contact_written',text:'Invented incoming',occurredAt:100,source:'live',quotedMessageId:null,statusReply:false,statusContext:null,media:null,reaction:null});
const headers = {authorization:'Bearer synthetic-token','x-otherme-profile':'original','x-otherme-revision':'7'};
function appFixture() {
  const store = new SqliteStore(); store.saveConversation(conversation()); store.saveMessage(message());
  const app = createApp({store,token:'synthetic-token',accountId:'a',profileScope:{profileId:'original',accountId:'a',revision:7},seed:false,now:() => 1000});
  return {store,app,post:(url:string,payload:Record<string,unknown>) => app.inject({method:'POST',url,headers,payload})};
}

test('strict scoped settings APIs, CAS/no-op, capabilities opt-in and exact lost-import-response reads', async () => {
  const {store,app,post} = appFixture();
  try {
    assert.equal((await app.inject({url:'/v1/owner-instructions'})).statusCode,401);
    assert.equal((await app.inject({url:'/v1/contact-names',headers:{authorization:headers.authorization}})).statusCode,426);
    assert.equal((await app.inject({url:'/v1/contact-names',headers:{...headers,'x-otherme-revision':'6'}})).statusCode,409);
    const discovery = SessionDiscovery.parse((await app.inject({url:'/v1/session',headers})).json()); assert.equal(discovery.capabilities,undefined);
    const capabilities = SessionDiscovery.parse((await app.inject({url:'/v1/session?capabilities=1',headers})).json()).capabilities;
    assert.equal(capabilities?.ownerInstructions,true); assert.equal(capabilities?.contactBookNames,true);
    assert.deepEqual((await app.inject({url:'/v1/owner-instructions',headers})).json(),{text:'',revision:0});
    assert.equal((await post('/v1/owner-instructions',{requestId:'save',expectedRevision:0,text:'  About me\u2014keep exact.\n'})).statusCode,200);
    const conflict = await post('/v1/owner-instructions',{requestId:'stale',expectedRevision:0,text:'new'});
    assert.equal(conflict.statusCode,409); assert.equal(conflict.json().error,'owner_instructions_changed');
    assert.equal((await post('/v1/owner-instructions',{requestId:'bad',expectedRevision:1,text:'a',extra:true})).statusCode,422);
    assert.equal((await post('/v1/contact-names',{requestId:'on',expectedRevision:0,enabled:true})).statusCode,200);
    assert.equal((await post('/v1/contact-names',{requestId:'noop',expectedRevision:1,enabled:true})).json().revision,1);
    const input = {requestId:'exact-import-request',expectedRevision:1,entries:[{conversationId:id,name:'Private invented name'}]};
    const imported = await post('/v1/contact-names/import',input); assert.equal(imported.statusCode,200);
    const read = await app.inject({url:'/v1/contact-names',headers});
    assert.equal(read.json().lastPhoneImportRequestId,input.requestId); assert.equal(read.headers['cache-control'],'no-store');
    assert.deepEqual((await post('/v1/contact-names/import',input)).json(),imported.json());
    assert.equal((await post('/v1/contact-names/import',{...input,entries:[]})).json().error,'request_id_conflict');
    const settings = store.contactNameSettings('a');
    assert.equal((await app.inject({method:'POST',url:'/v1/contact-names/import',headers:{...headers,'x-otherme-profile':'other'},payload:{...input,requestId:'wrong-scope',expectedRevision:2,entries:[]}})).statusCode,409);
    assert.deepEqual(store.contactNameSettings('a'),settings); assert.equal(store.conversation('a',id)?.name,'Private invented name');
    assert.equal(JSON.stringify((await app.inject({url:'/v1/health'})).json()).includes('Private'),false);
    assert.equal(JSON.stringify((await app.inject({url:'/v1/session?capabilities=1',headers})).json()).includes('About me'),false);
  } finally {await app.close();}
});

test('single import accepts up to 500 existing pairs beyond 16KiB; count, body and scope failures are atomic', async () => {
  const {store,app,post} = appFixture();
  try {
    const entries = Array.from({length:500},(_,index) => ({conversationId:`1555${String(index).padStart(7,'0')}@s.whatsapp.net`,name:'Name '+index+'x'.repeat(100)}));
    for (const entry of entries) store.saveConversation(conversation(entry.conversationId));
    await post('/v1/contact-names',{requestId:'on',expectedRevision:0,enabled:true});
    const imported = await post('/v1/contact-names/import',{requestId:'500',expectedRevision:1,entries});
    assert.equal(imported.statusCode,200); assert.equal(imported.json().settings.revision,2);
    assert.equal((await post('/v1/contact-names/import',{requestId:'501',expectedRevision:2,entries:[...entries,{conversationId:id,name:'Extra'}]})).statusCode,422);
    const oversized = await app.inject({method:'POST',url:'/v1/contact-names/import',headers:{...headers,'content-type':'application/json'},payload:JSON.stringify({requestId:'body',expectedRevision:2,entries:[]})+' '.repeat(512*1024)});
    assert.equal(oversized.statusCode,413);
    const ordinary = await post('/v1/owner-instructions',{requestId:'body-owner',expectedRevision:0,text:'x'.repeat(20000)});
    assert.notEqual(ordinary.statusCode,200); assert.equal(store.contactNameSettings('a').revision,2);
    assert.equal(store.contactNames('a',entries[0]?.conversationId ?? '').length,1);
    const empty = await post('/v1/contact-names/import',{requestId:'empty',expectedRevision:2,entries:[]});
    assert.equal(empty.statusCode,200); assert.equal(store.contactNames('a',entries[0]?.conversationId ?? '').length,0);
  } finally {await app.close();}
});

async function adapterFixture(send?: (chat:string,content:unknown,options:{messageId:string}) => Promise<unknown>, seed = true) {
  const auth = mkdtempSync(join(tmpdir(),'replybot-extension-adapter-'));
  writeFileSync(join(auth,'owner-identity.json'),JSON.stringify({owner}));
  const store = new SqliteStore(); const flow = new Workflow(store,'a',() => 1000);
  if (seed) {store.saveConversation(conversation()); store.saveMessage(message());}
  const incoming: Message[] = [];
  const adapter = new WhatsAppAdapter(flow,auth,async message => {incoming.push(message);},undefined,() => 1000,true);
  const ev = new EventEmitter(); let reads = 0;
  Object.defineProperties(adapter,{
    loadAuth:{value:async () => ({state:{creds:{me:{id:owner}},keys:{}},saveCreds:async () => {}})},
    makeSocket:{value:() => ({ev,user:{id:owner},end:() => {},readMessages:() => {reads++;},sendMessage:send})},
  });
  await adapter.start(); ev.emit('connection.update',{connection:'open'});
  return {store,flow,adapter,ev,incoming,reads:() => reads,dispose:async () => {await adapter.stop();store.close();rmSync(auth,{recursive:true,force:true});}};
}

test('verified direct status events before HTTP/Message completion are monotonic and never transmit reads', async () => {
  let attempted = ''; let complete: (value:unknown) => void = () => {}; let started: () => void = () => {};
  const sending = new Promise<void>(resolve => {started = resolve;});
  const f = await adapterFixture(async (_chat,_content,options) => {attempted = options.messageId;started();return new Promise(resolve => {complete = resolve;});});
  try {
    const queued = f.flow.manualSend(id,action,'send'); const pending = f.adapter.dispatch(queued.id); await sending;
    const before = f.flow.conversation(id); const unread = f.store.unreadCounts('a');
    const update = (status:number) => f.ev.emit('messages.update',[{key:{remoteJid:id,id:attempted,fromMe:true},update:{status}}]);
    update(proto.WebMessageInfo.Status.READ); update(proto.WebMessageInfo.Status.SERVER_ACK); update(proto.WebMessageInfo.Status.DELIVERY_ACK); update(proto.WebMessageInfo.Status.READ);
    await f.adapter['events'];
    assert.equal(f.store.outbox('a',queued.id)?.components[0]?.outgoingReceipt?.level,'read');
    assert.equal(f.store.outbox('a',queued.id)?.state,'dispatching'); assert.deepEqual(f.flow.conversation(id),before);
    assert.deepEqual(f.store.unreadCounts('a'),unread); assert.equal(f.reads(),0);
    complete({key:{id:attempted,remoteJid:id,fromMe:true}}); const result = await pending;
    assert.equal(result.state,'accepted'); assert.equal(result.components[0]?.outgoingReceipt?.level,'read');
    assert.equal(f.store.messages('a',id).find(m => m.transportId === attempted)?.outgoingReceipt?.level,'read');
    assert.equal(f.reads(),0);
  } finally {complete(undefined);await f.dispose();}
});

test('receipt guards exclude wrong chats, identities, unsupported status, missing/own-device keys and stale sockets', async () => {
  const f = await adapterFixture();
  try {
    const queued = f.flow.manualSend(id,action,'unknown'); const part = queued.components[0]; assert.ok(part);
    f.store.saveOutbox({...queued,state:'unknown',components:[{...part,state:'unknown',transportId:'known'}]});
    const keys = [
      {remoteJid:id,id:'known',fromMe:false},{remoteJid:id,id:'known'},
      {remoteJid:'15550000002@s.whatsapp.net',id:'known',fromMe:true},{remoteJid:owner,id:'known',fromMe:true},
      {remoteJid:id,id:'missing',fromMe:true},{id:'known',fromMe:true},
      {remoteJid:'x@g.us',id:'known',fromMe:true},{remoteJid:'status@broadcast',id:'known',fromMe:true},
      {remoteJid:id,id:'known',fromMe:true,participant:owner},{remoteJid:id,id:'known',fromMe:true,remoteJidAlt:'999@lid'},
      {remoteJid:'15550000001:1@s.whatsapp.net',id:'known',fromMe:true},
    ];
    for (const key of keys) f.ev.emit('messages.update',[{key,update:{status:proto.WebMessageInfo.Status.READ}}]);
    for (const status of [proto.WebMessageInfo.Status.PENDING,proto.WebMessageInfo.Status.ERROR,proto.WebMessageInfo.Status.PLAYED,99])
      f.ev.emit('messages.update',[{key:{remoteJid:id,id:'known',fromMe:true},update:{status}}]);
    f.ev.emit('message-receipt.update',[{key:{remoteJid:id,id:'known',fromMe:true},receipt:{userJid:owner,readTimestamp:1}}]);
    await f.adapter['events']; assert.equal(f.store.outbox('a',queued.id)?.components[0]?.outgoingReceipt,undefined);
    f.store.saveWaAlias('a','123@lid',id);
    f.ev.emit('messages.update',[{key:{remoteJid:'123@lid',remoteJidAlt:id,id:'known',fromMe:true},update:{status:proto.WebMessageInfo.Status.SERVER_ACK}}]);
    await f.adapter['events']; assert.equal(f.store.outbox('a',queued.id)?.components[0]?.outgoingReceipt?.level,'sent');
    f.ev.emit('message-receipt.update',[{key:{remoteJid:id,id:'known',fromMe:true},receipt:{userJid:'123@lid',receiptTimestamp:2}}]);
    await f.adapter['events']; assert.equal(f.store.outbox('a',queued.id)?.components[0]?.outgoingReceipt?.level,'delivered');
    const version = f.store.historyVersions('a'); await f.adapter.stop();
    f.ev.emit('messages.update',[{key:{remoteJid:id,id:'known',fromMe:true},update:{status:proto.WebMessageInfo.Status.READ}}]);
    await f.adapter['events']; assert.deepEqual(f.store.historyVersions('a'),version); assert.equal(f.reads(),0);
    assert.equal(f.store.outbox('a',queued.id)?.state,'unknown');
  } finally {await f.dispose();}
});

test('contacts updates preserve saved source over push names, omissions do not clear and name-only events create no inbox', async () => {
  const f = await adapterFixture();
  try {
    f.flow.setContactNames({requestId:'on',expectedRevision:0,enabled:true});
    f.ev.emit('contacts.upsert',[{id,name:'Saved',notify:'Push',verifiedName:'Verified'},{id:'15551111111@s.whatsapp.net',name:'Not a chat'}]);
    await f.adapter['events']; assert.equal(f.flow.conversation(id).name,'Saved'); assert.equal(f.store.conversations('a').length,1);
    f.ev.emit('contacts.update',[{id,notify:'Updated push'}]);
    f.ev.emit('messages.upsert',{type:'notify',messages:[{key:{remoteJid:id,id:'new',fromMe:false},pushName:'Incoming push',messageTimestamp:1,message:{conversation:'Invented'}}]});
    await f.adapter['events']; assert.equal(f.flow.conversation(id).name,'Saved');
    f.ev.emit('contacts.update',[{id,name:''}]); await f.adapter['events']; assert.equal(f.flow.conversation(id).name,'Incoming push');
    const historyChat = '15550000003@s.whatsapp.net';
    f.ev.emit('messaging-history.set',{contacts:[{id:historyChat,name:'History saved'},{id:'15550000004@s.whatsapp.net',name:'No messages'}],
      messages:[{key:{remoteJid:historyChat,id:'history',fromMe:false},pushName:'History push',messageTimestamp:1,message:{conversation:'Invented backfill'}}]});
    await f.adapter['events']; assert.equal(f.flow.conversation(historyChat).name,'History saved'); assert.equal(f.store.conversations('a').length,2);
    f.flow.setContactNames({requestId:'off',expectedRevision:1,enabled:false});
    f.ev.emit('contacts.update',[{id,name:'Ignored while off'}]); await f.adapter['events']; assert.equal(f.flow.conversation(id).name,'Incoming push');
  } finally {await f.dispose();}
});

for (const enabled of [false,true]) {
  test(`review38 paired contact observations remember aliases without inbox chats, names ${enabled ? 'on' : 'off'}`, async () => {
    for (const event of ['contacts.upsert','contacts.update','messaging-history.set','lid-mapping.update']) {
      const f = await adapterFixture(undefined,false);
      const phone = '15550000050@s.whatsapp.net', lid = '50050@lid';
      try {
        if (enabled) f.flow.setContactNames({requestId:'on',expectedRevision:0,enabled:true});
        const contact = {id:lid,phoneNumber:phone,name:'Invented saved name',notify:'Invented push name'};
        const payload = event === 'messaging-history.set' ? {contacts:[contact],messages:[]}
          : event === 'lid-mapping.update' ? {lid,pn:phone} : [contact];
        f.ev.emit(event,payload); await f.adapter['events'];
        assert.equal(f.adapter.snapshot().error,null,event);
        assert.equal(f.store.waCanonical('a',lid),phone,event);
        assert.equal(f.store.waCanonical('other',lid),lid);
        assert.deepEqual(f.store.conversations('a'),[],event);
        assert.deepEqual(f.store.contactNames('a',phone),[]);
        assert.equal(f.incoming.length,0);
        // A later genuine message with only the LID must use the persisted pair.
        f.ev.emit('messages.upsert',{type:'notify',messages:[{key:{remoteJid:lid,id:'later',fromMe:false},
          pushName:'Later push',messageTimestamp:1,message:{conversation:'Invented later message'}}]});
        await f.adapter['events'];
        assert.equal(f.adapter.snapshot().error,null);
        assert.deepEqual(f.store.conversations('a').map(c => c.id),[phone]);
        assert.equal(f.store.messages('a',phone)[0]?.transportId,'later');
        assert.equal(f.store.messages('a',lid).length,0);
        assert.equal(f.incoming.length,1); assert.equal(f.incoming[0]?.conversationId,phone);
        assert.equal(f.flow.conversation(phone).control,'assistant_allowed');
        assert.equal(f.flow.conversation(phone).name,'Later push');
        await f.adapter.stop();
        f.ev.emit('contacts.upsert',[{id:'50051@lid',phoneNumber:'15550000051@s.whatsapp.net',name:'Stale socket'}]);
        await f.adapter['events'];
        assert.equal(f.store.waCanonical('a','50051@lid'),'50051@lid');
        assert.equal(f.store.conversations('a').length,1);
      } finally {await f.dispose();}
    }
  });
  test(`review38 contact mapping joins existing physical LID history with policy and unknown holds, names ${enabled ? 'on' : 'off'}`, async () => {
    for (const event of ['contacts.upsert','contacts.update','messaging-history.set','lid-mapping.update']) {
      const f = await adapterFixture(undefined,false);
      const phone = '15550000050@s.whatsapp.net', lid = '50050@lid';
      try {
        if (enabled) f.flow.setContactNames({requestId:'on',expectedRevision:0,enabled:true});
        f.ev.emit('messaging-history.set',{contacts:[],messages:[{key:{remoteJid:lid,id:'history',fromMe:false},
          messageTimestamp:1,message:{conversation:'Invented physical LID history'}}]});
        await f.adapter['events'];
        const physical = f.store.messages('a',lid)[0]; assert.ok(physical);
        const raw = f.store.waMessage('a',lid,'history'), epoch = f.store.historyGroup('a',lid).sourceEpoch;
        const queued = f.flow.manualSend(lid,action,'retired-queued');
        const unknown = f.flow.manualSend(lid,action,'retired-unknown');
        f.store.saveOutbox({...unknown,state:'unknown',components:unknown.components.map(part => ({...part,state:'unknown'}))});
        const durableUnknown = f.store.outbox('a',unknown.id), request = f.store.request('a','retired-unknown');
        f.store.saveConversation({...f.flow.conversation(lid),mode:'never_reply'});
        const contact = {id:phone,lid,name:'Invented saved name'};
        const payload = event === 'messaging-history.set' ? {contacts:[contact],messages:[]}
          : event === 'lid-mapping.update' ? {lid,pn:phone} : [contact];
        f.ev.emit(event,payload); await f.adapter['events'];
        assert.equal(f.adapter.snapshot().error,null,event);
        assert.equal(f.store.waCanonical('a',lid),phone);
        const group = f.store.historyGroup('a',phone);
        assert.deepEqual(new Set(group.memberIds),new Set([phone,lid])); assert.ok(group.sourceEpoch > epoch);
        assert.equal(f.store.conversations('a').length,2);
        assert.deepEqual(f.store.messages('a',lid),[physical]); assert.deepEqual(f.store.messages('a',phone),[]);
        assert.equal(f.store.waMessage('a',lid,'history'),raw);
        assert.equal(f.store.historySource('a',phone,physical.id)?.conversationId,lid);
        assert.equal(f.store.outbox('a',queued.id)?.state,'cancelled');
        assert.deepEqual(f.store.outbox('a',unknown.id),durableUnknown);
        assert.deepEqual(f.store.request('a','retired-unknown'),request);
        for (const chat of [phone,lid]) {
          assert.equal(f.flow.conversation(chat).control,'manual');
          assert.equal(f.flow.conversation(chat).pause?.indefinite,true);
        }
        assert.equal(f.flow.conversation(phone).name,enabled && event !== 'lid-mapping.update' ? 'Invented saved name' : phone.split('@')[0]);
        assert.throws(() => f.flow.quickControl(phone,'resume','restricted'),/alias_policy_restricted/);
        f.store.saveConversation({...f.flow.conversation(lid),mode:null});
        assert.throws(() => f.flow.quickControl(phone,'resume','unknown'),/delivery_unknown/);
        assert.throws(() => f.flow.manualSend(lid,action,'fresh-retired'),/retired_alias_read_only/);
        const unchangedEpoch = f.store.historyGroup('a',phone).sourceEpoch;
        f.ev.emit(event,payload); await f.adapter['events'];
        assert.equal(f.store.historyGroup('a',phone).sourceEpoch,unchangedEpoch);
        assert.deepEqual(f.store.outbox('a',unknown.id),durableUnknown);
        assert.deepEqual(f.incoming,[]); assert.deepEqual(f.store.drafts('a'),[]);
      } finally {await f.dispose();}
    }
  });
}

test('returned transport ID conflict keeps durable attempted ID and unknown accounting', async () => {
  const f = await adapterFixture(async () => ({key:{id:'conflict',remoteJid:id,fromMe:true}}));
  try {
    const queued = f.flow.manualSend(id,action,'send'); const result = await f.adapter.dispatch(queued.id);
    assert.equal(result.state,'unknown'); assert.notEqual(result.components[0]?.transportId,'conflict');
    assert.equal(f.store.messages('a',id).some(m => m.transportId === 'conflict'),false);
  } finally {await f.dispose();}
});

test('both generation context paths gate consent and export only current selected name/instructions', async () => {
  const store = new SqliteStore(); const flow = new Workflow(store,'a'); store.saveConversation(conversation()); store.saveMessage(message());
  let calls = 0;
  const generate = draftGenerator(flow,{generate:async context => {
    calls++; assert.equal(context.ownerInstructions?.text,'I am Invented.'); assert.equal(context.recipient?.displayName,'Current recipient');
    assert.equal(JSON.stringify(context).includes('Other secret'),false); return action;
  }});
  try {
    flow.setOwnerInstructions({requestId:'prefs',expectedRevision:0,text:'I am Invented.'}); flow.observeContactNames(id,{wa_notify:'Current recipient'});
    store.saveConversation({...conversation('15550000002@s.whatsapp.net'),name:'Other secret',nameSource:'wa_saved'});
    await assert.rejects(generate(id,'denied'),/model_consent_required/); assert.equal(calls,0);
    flow.setModelConsent(true,'consent'); await generate(id,'allowed'); assert.equal(calls,1);
    store.saveConversation({...flow.conversation(id),mode:'never_reply'}); await assert.rejects(generate(id,'never'),/ai_access_denied/); assert.equal(calls,1);
  } finally {store.close();}
});

test('instructions and effective-name revisions invalidate in-flight generations without automatic redraft', async () => {
  for (const change of ['instructions','name'] as const) {
    const store = new SqliteStore(); const flow = new Workflow(store,'a'); store.saveConversation(conversation()); store.saveMessage(message()); flow.setModelConsent(true,'consent');
    let release: (value:Action) => void = () => {}; let started: () => void = () => {}; let calls = 0;
    const entered = new Promise<void>(resolve => {started = resolve;});
    const generate = draftGenerator(flow,{generate:async () => {calls++;started();return new Promise(resolve => {release = resolve;});}});
    try {
      const pending = generate(id,'pending'); await entered;
      if (change === 'instructions') flow.setOwnerInstructions({requestId:'edit',expectedRevision:0,text:'Changed'});
      else flow.observeContactNames(id,{wa_notify:'Changed recipient'});
      release(action); await assert.rejects(pending,/stale_workflow/); assert.equal(calls,1); assert.deepEqual(store.drafts('a'),[]);
    } finally {release(action);store.close();}
  }
});

test('revision changes during media preparation stop before the reply provider', async () => {
  const store = new SqliteStore(); const flow = new Workflow(store,'a'); store.saveConversation(conversation()); store.saveMessage(message()); flow.setModelConsent(true,'consent');
  let release: () => void = () => {}; let entered: () => void = () => {}; let calls = 0;
  const preparing = new Promise<void>(resolve => {entered = resolve;}); const media = new Promise<void>(resolve => {release = resolve;});
  const generate = draftGenerator(flow,{generate:async () => {calls++;return action;}},{visuals:async () => {entered();await media;return [];}});
  try {
    const pending = generate(id,'media-pending'); await preparing;
    flow.setOwnerInstructions({requestId:'change',expectedRevision:0,text:'Different preferences'});
    release(); await assert.rejects(pending,/stale_workflow/); assert.equal(calls,0); assert.deepEqual(store.drafts('a'),[]);
  } finally {release();store.close();}
});

const minimalContext = (): ModelContext => ({instructions:'Fixed policy.',messages:[message()],memories:[],styleExamples:[],limitations:[],worstCaseTextTokens:100});
const success = () => new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({action})}}]}));
test('final serialized budget counts schema, roles, owner preferences, recipient identity and framing; optional content is pruned', async () => {
  let calls = 0;
  const client = new OpenRouterClient({apiKey:'synthetic-key',allowRemote:true,ownerConsent:true,fetcher:async (_url,init) => {
    calls++; assert.equal(typeof init?.body,'string'); const body = JSON.parse(String(init?.body));
    assert.ok(Buffer.byteLength(JSON.stringify(body),'utf8')+512 <= 8000);
    assert.equal(body.max_tokens,1000); assert.ok(body.response_format.json_schema.schema);
    assert.ok(body.messages[0].content.includes('<owner_preferences>')); assert.ok(body.messages[0].content.includes('I am Invented.'));
    const transcript = JSON.parse(body.messages[1].content); assert.equal(transcript.recipient.displayName,'Current recipient');
    assert.ok(transcript.messages.some((m: {id:string}) => m.id === 'incoming')); assert.ok(transcript.messages.some((m: {id:string}) => m.id === 'quote'));
    assert.ok(transcript.messages.length < 20); return success();
  }});
  const context = minimalContext();
  context.ownerInstructions = {text:'I am Invented.',revision:1}; context.recipient = {displayName:'Current recipient',source:'wa_notify',revision:1};
  context.messages = [{...message('quote'),text:'Required quote'},...Array.from({length:19},(_,i) => ({...message('old-'+i),text:'optional '.repeat(150)})),{...message(),quotedMessageId:'quote'}];
  await client.generate(context); assert.equal(calls,1);
});

test('visual-label and message metadata bytes count without claiming base64 image-token accounting', async () => {
  let calls = 0;
  const client = new OpenRouterClient({apiKey:'synthetic-key',allowRemote:true,ownerConsent:true,fetcher:async () => {calls++;return success();}});
  const context = minimalContext(); const visualId = 'v'.repeat(2600);
  context.messages = [{...message(),id:visualId,media:{kind:'image',access:'available',fixture:null,description:'Invented image',viewOnce:false,expiresAt:null}}];
  await client.generate(context); assert.equal(calls,1);
  await assert.rejects(client.generate(context,[{messageId:visualId,dataUrl:'data:image/jpeg;base64,AA==',sampled:false}]),/context_budget_exceeded/);
  assert.equal(calls,1);
});

test('mandatory serialized overflow rejects before fake fetch without removing latest trigger or quote evidence', async () => {
  let calls = 0;
  const client = new OpenRouterClient({apiKey:'synthetic-key',allowRemote:true,ownerConsent:true,fetcher:async () => {calls++;return success();}});
  for (const field of ['instructions','owner','trigger','quote'] as const) {
    const context = minimalContext();
    if (field === 'instructions') context.instructions = 'é'.repeat(3500);
    if (field === 'owner') context.ownerInstructions = {text:'a'.repeat(4000),revision:1};
    if (field === 'trigger') context.messages = [{...message(),text:'a'.repeat(7000)}];
    if (field === 'quote') context.messages = [{...message('quote'),text:'a'.repeat(7000)},{...message(),quotedMessageId:'quote'}];
    await assert.rejects(client.generate(context),/context_budget_exceeded/);
  }
  assert.equal(calls,0);
});
