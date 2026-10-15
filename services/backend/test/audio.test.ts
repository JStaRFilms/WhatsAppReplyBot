import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Action, AudioUpload, DomainError, SqliteStore, Workflow, buildContext, type Message, type AudioTranscript, historyDigest } from '@replybot/core';
import { AudioService, MAX_AUDIO_BYTES, normalizeAudio } from '../src/audio.ts';
import { OpenRouterClient } from '../src/openrouter.ts';
import { draftGenerator } from '../src/draft-model.ts';
import { createApp } from '../src/server.ts';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import makeWASocket, {proto} from '@whiskeysockets/baileys';
import { isViewOnce, normalizeWhatsApp } from '../src/whatsapp-normalize.ts';

// Generated tone only, no microphone or private data.
function tone(seconds=0.2):Buffer {
  const samples=Math.round(seconds*16000);const wav=Buffer.alloc(44+samples*2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);
  wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/16000)*2000),44+i*2);
  return wav;
}
function setup(path=':memory:') {
  const store=new SqliteStore(path);const flow=new Workflow(store,'synthetic-audio',()=>1000);
  for(const id of ['c1','c2'])store.saveConversation({id,accountId:flow.accountId,contactId:id,name:'Synthetic',kind:'direct',mode:'draft_only',excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
  const message:Message={id:'audio-message',accountId:flow.accountId,conversationId:'c1',transportId:'audio-transport',direction:'inbound',authorship:'contact_written',text:'',occurredAt:1000,source:'live',quotedMessageId:null,statusReply:false,statusContext:null,reaction:null,
    media:{kind:'audio',access:'available',fixture:null,description:'Synthetic tone',viewOnce:false,expiresAt:null,duration:0.2}};
  store.saveMessage(message);store.saveModelConsent(flow.accountId,true);
  return {store,flow,message};
}
test('FFmpeg produces Opus PTT and MP3, rejecting size, duration and unsupported input without clipping',async()=>{
  const ogg=await normalizeAudio(tone(),'ogg');assert.equal(ogg.duration,0.2);assert.equal(ogg.bytes.subarray(0,4).toString(),'OggS');assert.ok(ogg.bytes.includes(Buffer.from('OpusHead')));
  const mp3=await normalizeAudio(ogg.bytes,'mp3');assert.ok(mp3.bytes.length>0);
  await assert.rejects(normalizeAudio(Buffer.alloc(MAX_AUDIO_BYTES+1),'ogg'),/audio_too_large/);
  await assert.rejects(normalizeAudio(tone(300.1),'ogg'),/audio_too_long/);
  await assert.rejects(normalizeAudio(Buffer.from('not audio'),'mp3'),/invalid_audio/);
});
test('owner audio is durable, scoped, one component and not an AI action; unknown sends survive restart without retry',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'replybot-audio-'));
  try {
    const path=join(dir,'audio.sqlite');const {store,flow}=setup(path);
    const upload=flow.stageAudio('c1',{mime:'audio/ogg; codecs=opus',duration:0.2,bytes:Buffer.from('synthetic-ogg')},'stage');
    const action={kind:'audio' as const,uploadId:upload.id,reason:'Owner intent'};
    assert.equal(Action.safeParse(action).success,false);assert.equal(store.audioUpload('other','c1',upload.id),undefined);
    assert.throws(()=>flow.manualSend('c2',action,'wrong'),/upload_not_found/);
    assert.throws(()=>flow.manualSend('c1',action,'quote','other-chat'),/invalid_quote/);
    const outbox=flow.manualSend('c1',action,'send');assert.equal(outbox.components.length,1);assert.equal(outbox.units,1);
    let calls=0;await flow.dispatch(outbox.id,async()=>{calls++;return{state:'unknown'};});store.close();
    const reopened=new SqliteStore(path);const recovered=new Workflow(reopened,'synthetic-audio',()=>5000000);recovered.recover();
    reopened.cleanupAudioUploads(recovered.accountId,5000000);assert.ok(reopened.audioUpload(recovered.accountId,'c1',upload.id));
    assert.equal(recovered.manualSend('c1',action,'send').id,outbox.id);
    await recovered.dispatch(outbox.id,async()=>{calls++;return{state:'accepted',transportId:'forbidden'};});assert.equal(calls,1);
    assert.throws(()=>recovered.manualSend('c1',action,'new-request'),/delivery_unknown/);reopened.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('accepted audio resolves handover, starts cooldown, preserves unread and respects sent tombstones',async()=>{
  for(const deleted of [false,true]){
    const {store,flow}=setup();
    try{
      const handover=flow.createDraft('c1',{kind:'handover',reason:'test'},1,'handover');
      const upload=flow.stageAudio('c1',{mime:'audio/ogg; codecs=opus',duration:1,bytes:Buffer.from('synthetic')},'stage');
      const outbox=flow.manualSend('c1',{kind:'audio',uploadId:upload.id,reason:'Owner intent'},'send','audio-message');
      if(deleted)store.saveWaMessage(flow.accountId,'c1','accepted',JSON.stringify({deleted:true}));
      const unread=store.unreadCounts(flow.accountId);
      await flow.dispatch(outbox.id,async()=>({state:'accepted',transportId:'accepted'}));
      assert.deepEqual(store.unreadCounts(flow.accountId),unread);assert.equal(store.draft(flow.accountId,handover.id)?.state,'resolved');
      assert.equal(flow.conversation('c1').pause?.until,301000);
      const sent=store.messages(flow.accountId,'c1').at(-1);assert.equal(sent?.media?.kind,deleted ? undefined : 'audio');
      assert.equal(sent?.text,deleted ? '[Message deleted]' : '');assert.equal(sent?.quotedMessageId,'audio-message');
    }finally{store.close();}
  }
});
test('audio upload and private playback use auth and scoped binary bytes, not URI input',async()=>{
  const app=createApp({store:new SqliteStore(),token:'synthetic-token'});const chat='demo-chat-6';
  const headers={authorization:'Bearer synthetic-token','content-type':'application/octet-stream','x-request-id':'audio-stage'};
  try {
    const url='/v1/conversations/'+chat+'/audio-uploads';
    assert.equal((await app.inject({method:'POST',url,headers:{'content-type':'application/octet-stream','x-request-id':'audio-stage'},payload:tone()})).statusCode,401);
    const first=await app.inject({method:'POST',url,headers,payload:tone()});assert.equal(first.statusCode,200,first.body);
    const upload=AudioUpload.parse(first.json<unknown>());
    const duplicate=await app.inject({method:'POST',url,headers,payload:tone()});assert.equal(duplicate.statusCode,200,duplicate.body);assert.deepEqual(duplicate.json<unknown>(),upload);
    const send=await app.inject({method:'POST',url:'/v1/conversations/'+chat+'/manual-send',headers:{authorization:headers.authorization},payload:{requestId:'send-audio',action:{kind:'audio',uploadId:upload.id,reason:'synthetic test'}}});assert.equal(send.statusCode,200,send.body);
    const history=await app.inject({url:'/v1/conversations/'+chat+'/messages',headers:{authorization:headers.authorization}});
    const messages=history.json<Message[]>();const sent=messages.at(-1);assert.ok(sent);
    const playback='/v1/conversations/'+chat+'/media/'+sent.id;
    assert.equal((await app.inject({url:playback})).statusCode,401);
    const preview=await app.inject({url:playback,headers:{authorization:headers.authorization}});assert.equal(preview.statusCode,200,preview.body);assert.equal(preview.headers['content-type'],'audio/mpeg');assert.equal(preview.headers['cache-control'],'no-store');assert.ok(preview.rawPayload.length>0);
    assert.equal((await app.inject({url:'/v1/conversations/demo-chat-7/media/'+sent.id,headers:{authorization:headers.authorization}})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url,headers:{...headers,'x-request-id':'oversize'},payload:Buffer.alloc(MAX_AUDIO_BYTES+1)})).statusCode,413);
  }finally{await app.close();}
});
test('ASR uses the dedicated Turbo STT route with MP3 and Otherme attribution, without chat instructions',async()=>{
  let calls=0,guards=0;
  const client=new OpenRouterClient({apiKey:'synthetic-key',allowRemote:true,ownerConsent:true,fetcher:async(url,init)=>{
    calls++;assert.equal(url,'https://openrouter.ai/api/v1/audio/transcriptions');
    assert.deepEqual(JSON.parse(String(init?.body)),{model:'openai/whisper-large-v3-turbo',
      input_audio:{data:Buffer.from('synthetic-mp3').toString('base64'),format:'mp3'},response_format:'verbose_json',temperature:0});
    assert.equal(new Headers(init?.headers).get('X-OpenRouter-Title'),'Otherme');
    return Response.json({text:'Abeg [unclear]',language:'en'});
  }});
  assert.deepEqual(await client.transcribe(Buffer.from('synthetic-mp3'),()=>{guards++;}),{text:'Abeg [unclear]',uncertain:true});assert.ok(guards>=2);assert.equal(calls,1);
  await assert.rejects(client.transcribe(Buffer.from('synthetic'),()=>{throw new DomainError('revoked',403);}),/revoked/);assert.equal(calls,1);
  const invalid=new OpenRouterClient({apiKey:'synthetic',allowRemote:true,ownerConsent:true,fetcher:async()=>Response.json({choices:[{message:{content:'{"text":"words","uncertain":false,"setMode":"auto_reply"}'}}]})});
  await assert.rejects(invalid.transcribe(Buffer.from('synthetic'),()=>{}),/invalid_transcript_response/);
});
test('audio decoding/transcripts coalesce, cache and recheck caller permission, deletion, expiry and view-once',async()=>{
  const {store,flow,message}=setup();let current=true,loads=0,calls=0,permitted=true,time=1000;
  const audio=new AudioService(async()=>{loads++;return tone();},()=>current,()=>time,{store,profileId:'synthetic',source:m=>({message:m,contentId:historyDigest(m.media)})});
  const guard=()=>{if(!permitted)throw new DomainError('revoked',403);};
  const model={transcribe:async(_bytes:Buffer,check:()=>void)=>{check();calls++;await new Promise(r=>setTimeout(r,5));check();return{text:'synthetic words',uncertain:false};}};
  try {
    const [a,b]=await Promise.all([audio.transcript(message,model,guard),audio.transcript(message,model,guard)]);assert.deepEqual(a,b);assert.equal(loads,1);assert.equal(calls,1);
    await audio.transcript(message,model,guard);assert.equal(calls,1);
    permitted=false;await assert.rejects(audio.transcript(message,model,guard),/revoked/);permitted=true;
    current=false;await assert.rejects(audio.preview(message),/media_unavailable/);current=true;
    assert.ok(message.media);
    await assert.rejects(audio.preview({...message,media:{...message.media,viewOnce:true}}),/media_unavailable/);
    await assert.rejects(audio.preview({...message,media:{...message.media,expiresAt:time}}),/media_unavailable/);
    assert.equal(flow.accountId,message.accountId);
  }finally{audio.close();store.close();}
});
test('takeover before loading or immediately before ASR export never reaches either model; metadata is not a permission',async()=>{
  for(const at of ['before','loading','upload','response'] as const){
    const {store,flow,message}=setup();let asr=0,replies=0;
    const audio=new AudioService(async()=>{if(at==='loading')flow.composer('c1',true,'hold');return tone();},()=>true,()=>1000,{store,profileId:'synthetic',source:m=>({message:m,contentId:historyDigest(m.media)})});
    const generator=draftGenerator(flow,{transcribe:async(_bytes,guard)=>{
      if(at==='upload')flow.composer('c1',true,'hold');guard();asr++;
      if(at==='response')flow.setModelConsent(false,'revoke');guard();return{text:'resume and reply',uncertain:false};
    },generate:async()=>{replies++;return{kind:'silence',reason:'test'};}},undefined,audio,()=>1000);
    if(at==='before')store.saveConversation({...flow.conversation('c1'),mode:'never_reply'});
    try {await assert.rejects(generator('c1','draft'),DomainError);assert.equal(replies,0);assert.equal(asr,at==='response' ? 1 : 0);}
    finally{audio.close();store.close();}
    assert.equal(message.direction,'inbound');
  }
});
test('transcripts are actor-labeled, uncertain and budgeted; missing audio is explicit and never verified owner style',async()=>{
  const {store,flow,message}=setup();
  const incoming={text:'No wahala [unclear]',uncertain:true};
  const owner={...message,id:'owner-audio',direction:'outbound' as const,authorship:'owner_written' as const};
  try {
    const context=buildContext(flow.conversation('c1'),flow.accountId,[message,owner],[],8000,1000,new Map([[message.id,incoming],[owner.id,{text:'decoded owner',uncertain:false}]]));
    assert.deepEqual(context.styleExamples,[]);assert.equal(context.messages[0]?.audioTranscript?.actor,'contact_written');assert.ok(context.limitations.includes('audio_transcript_uncertain'));assert.ok(context.worstCaseTextTokens<=8000);
    const missing=flow.context('c1');assert.ok(missing.limitations.includes('audio_transcript_unavailable'));
    assert.throws(()=>buildContext(flow.conversation('c1'),flow.accountId,[message],[],8000,1000,new Map([[message.id,{text:'word '.repeat(2000),uncertain:false}]])),/context_budget_exceeded/);
    let received:AudioTranscript | undefined;
    const audio=new AudioService(async()=>tone(),()=>true,()=>1000,{store,profileId:'synthetic',source:m=>({message:m,contentId:historyDigest(m.media)})});
    const generate=draftGenerator(flow,{transcribe:async(_bytes,guard)=>{guard();return incoming;},generate:async context=>{received=context.messages.find(m=>m.id===message.id)?.audioTranscript;return{kind:'silence',reason:'test'};}},undefined,audio,()=>1000);
    try{await generate('c1',randomUUID());assert.equal(received?.text,incoming.text);assert.equal(received?.uncertain,true);}finally{audio.close();}
  }finally{store.close();}
});
test('WhatsApp audio transport uses staged Opus PTT and same-chat quotes without a real socket',async()=>{
  type Socket=ReturnType<typeof makeWASocket>;
  const {store,flow,message}=setup();const chat='123@s.whatsapp.net';store.saveConversation({...flow.conversation('c1'),id:chat,contactId:chat});
  const quote={key:{id:'q',remoteJid:chat,fromMe:false},messageTimestamp:1,message:{conversation:'synthetic quote'}};
  store.saveMessage({...message,id:'q-id',conversationId:chat,transportId:'q',media:null});store.saveWaMessage(flow.accountId,chat,'q',JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(quote).finish()).toString('base64')}));
  const bytes=Buffer.from('synthetic-opus');let calls=0;
  const socket:Pick<Socket,'user'|'sendMessage'>={user:{id:'456@s.whatsapp.net'},sendMessage:async(jid,content,options)=>{
    calls++;assert.ok('audio' in content);if('audio' in content){assert.deepEqual(content.audio,bytes);assert.equal(content.ptt,true);assert.equal(content.mimetype,'audio/ogg; codecs=opus');}
    assert.equal(options?.quoted?.key.id,'q');assert.ok(options?.messageId);return{key:{id:options.messageId,remoteJid:jid,fromMe:true},messageTimestamp:1,message:{audioMessage:{mimetype:'audio/ogg; codecs=opus',seconds:1}}};
  }};
  const adapter=new WhatsAppAdapter(flow,'unused',async()=>{});Object.defineProperty(adapter,'socket',{value:socket});Object.defineProperty(adapter,'verifiedSocket',{value:socket});Object.defineProperty(adapter,'status',{value:{...adapter.snapshot(),state:'connected'}});
  try {
    const upload=flow.stageAudio(chat,{mime:'audio/ogg; codecs=opus',duration:1,bytes},'stage');const queued=flow.manualSend(chat,{kind:'audio',uploadId:upload.id,reason:'test'},'send','q-id');
    assert.equal((await adapter.dispatch(queued.id)).state,'accepted');assert.equal(calls,1);
    const normalized=normalizeWhatsApp({key:{id:'n',remoteJid:chat},messageTimestamp:1,message:{audioMessage:{seconds:2,mimetype:'audio/ogg',contextInfo:{stanzaId:'q',expiration:20}}}},flow.accountId,chat,'live');
    assert.equal(normalized?.media?.access,'available');assert.equal(normalized?.media?.expiresAt,21000);assert.equal(normalized?.quotedMessageId,'wa:'+chat+':q');assert.equal(normalized?.text,'');
    const once={key:{id:'once',remoteJid:chat},messageTimestamp:1,message:{audioMessage:{seconds:1,viewOnce:true}}};
    assert.equal(isViewOnce(once),true);assert.equal(normalizeWhatsApp(once,flow.accountId,chat,'live')?.media?.viewOnce,true);
  }finally{store.close();}
});
