import test from 'node:test';
import assert from 'node:assert/strict';
import { proto, type WAMessage } from '@whiskeysockets/baileys';
import { z } from 'zod';
import { AudioTranscript, SqliteStore, Workflow, type Message } from '@replybot/core';
import { AudioService } from '../src/audio.ts';
import { draftGenerator } from '../src/draft-model.ts';
import { ASR_PROVENANCE, OpenRouterClient } from '../src/openrouter.ts';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { normalizeWhatsApp } from '../src/whatsapp-normalize.ts';

const chat='15550000059@s.whatsapp.net';
function fixture() {
  const store=new SqliteStore(),flow=new Workflow(store,'ui59-synthetic',()=>10000);
  store.saveConversation({id:chat,accountId:flow.accountId,contactId:chat,name:'Synthetic',kind:'direct',mode:'draft_only',
    excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
  store.saveModelConsent(flow.accountId,true);
  const adapter=new WhatsAppAdapter(flow,'unused-ui59-auth',async()=>{},undefined,()=>10000);
  const state={loads:0,messages:0};
  const add=(id='voice',fromMe=false,media:Partial<NonNullable<Message['media']>>={})=>{
    const raw:WAMessage={key:{remoteJid:chat,id,fromMe},messageTimestamp:++state.messages,message:{audioMessage:{seconds:2,mimetype:'audio/ogg',
      fileSha256:Buffer.alloc(32,1),mediaKey:Buffer.alloc(32,2),fileLength:12}}};
    const normalized=normalizeWhatsApp(raw,flow.accountId,chat,'live');assert.ok(normalized?.media);
    const message={...normalized,media:{...normalized.media,...media}};
    store.saveMessage(message);store.saveWaMessage(flow.accountId,chat,id,JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(raw).finish()).toString('base64')}));
    return message;
  };
  const source=(m:Message)=>{
    const ref=store.historySource(flow.accountId,chat,m.id,10000);
    if(ref?.state!=='available')return undefined;
    const contentId=adapter.audioIdentity(ref.message);
    return contentId ? {message:ref.message,contentId} : undefined;
  };
  const service=()=>new AudioService(async()=>{state.loads++;return Buffer.from('synthetic-ogg');},m=>adapter.mediaCurrent(m),()=>10000,
    {store,profileId:'ui59-profile',source,normalize:async()=>({bytes:Buffer.from('synthetic-mp3'),duration:2})});
  const identity=(message:Message)=>{
    const ref=source(message);assert.ok(ref);
    return {accountId:flow.accountId,profileId:'ui59-profile',conversationId:chat,messageId:message.id,
      transportId:message.transportId,contentId:ref.contentId};
  };
  const resume=()=>flow.quickControl(chat,'resume','resume-'+flow.conversation(chat).workflowVersion);
  return {store,flow,state,add,source,service,identity,resume};
}
const Request=z.object({messages:z.array(z.object({role:z.string(),content:z.string()}))});
const Transcript=z.object({messages:z.array(z.object({id:z.string(),audioTranscript:AudioTranscript.extend({actor:z.string(),source:z.literal('decoded_audio')}).optional()}))});
function remote(fetcher:typeof fetch) {
  const client=new OpenRouterClient({apiKey:'ui59-invented-key',allowRemote:true,ownerConsent:true,fetcher});
  return {asrProvenance:ASR_PROVENANCE,transcribe:client.transcribe.bind(client),generate:client.generate.bind(client)};
}

test('ui59 full fake STT pipeline reaches the serialized reply request and durable reuse avoids another export',async()=>{
  const f=fixture(),message=f.add();let asr=0,replies=0;let audio=f.service();
  const model=remote(async(url,init)=>{
    if(String(url).endsWith('/audio/transcriptions')){
      asr++;assert.equal(z.object({input_audio:z.object({data:z.string()})}).parse(JSON.parse(String(init?.body))).input_audio.data,Buffer.from('synthetic-mp3').toString('base64'));
      return Response.json({text:'Meet at six, abeg.',language:'en',confidence:0.95});
    }
    replies++;
    const request=Request.parse(JSON.parse(String(init?.body))),content=request.messages.find(m=>m.role==='user')?.content;assert.ok(content);
    const received=Transcript.parse(JSON.parse(content)).messages.find(m=>m.id===message.id);
    assert.deepEqual(received?.audioTranscript,{text:'Meet at six, abeg.',uncertain:false,actor:'contact_written',source:'decoded_audio'});
    assert.equal(String(init?.body).includes('input_audio'),false);
    return Response.json({choices:[{message:{content:JSON.stringify({action:{kind:'text',text:'Six works.',reason:'Respond to the note'}})}}]});
  });
  try {
    let generate=draftGenerator(f.flow,model,undefined,audio,()=>10000);
    const first=await generate(chat,'first');assert.deepEqual(first.audioSourceIds,[message.id]);
    f.flow.dismissDraft(first.id,'dismiss');audio.close();audio=f.service();
    generate=draftGenerator(f.flow,model,undefined,audio,()=>10000);await generate(chat,'after-service-restart');
    assert.equal(asr,1);assert.equal(replies,2);assert.equal(f.state.loads,1);
    assert.equal(f.store.asrAttempt(f.identity(message),10000)?.state,'complete');
  }finally{audio.close();f.store.close();}
});

for(const mode of ['network','http','malformed','suppressed'] as const) {
  test(`ui59 ${mode} ASR cannot produce a normal reply or automatically repeat a paid attempt`,async()=>{
    const f=fixture(),message=f.add(),audio=f.service();let asr=0,replies=0;
    const identity=f.identity(message);
    if(mode==='suppressed'){const attempt=f.store.reserveAsr(identity,null,10000);f.store.unknownAsr(f.flow.accountId,attempt);f.store.suppressAsr(f.flow.accountId,chat,message.transportId);}
    const model=remote(async url=>{
      if(String(url).endsWith('/audio/transcriptions')){
        asr++;
        if(mode==='network')throw new Error('synthetic network loss');
        return mode==='http' ? new Response('synthetic error',{status:503}) : Response.json({choices:[]});
      }
      replies++;return Response.json({choices:[{message:{content:JSON.stringify({action:{kind:'text',text:'Please listen and interpret the attached audio.',reason:'No transcript'}})}}]});
    });
    const generate=draftGenerator(f.flow,model,undefined,audio,()=>10000);
    try {
      const draft=await generate(chat,'first');assert.equal(draft.action.kind,'handover');assert.equal(draft.state,'needs_owner');
      assert.equal(replies,0);assert.equal(asr,mode==='suppressed' ? 0 : 1);
      assert.equal(f.store.asrAttempt(identity,10000)?.state,mode==='suppressed' ? 'suppressed' : 'unknown');
      assert.equal(f.store.outboxes(f.flow.accountId).length,0);
      f.resume();const second=await generate(chat,'explicit-second');assert.equal(second.action.kind,'handover');
      assert.equal(replies,0);assert.equal(asr,mode==='suppressed' ? 0 : 1);
    }finally{audio.close();f.store.close();}
  });
}

test('ui59 unavailable required audio hands over without export; uncertain and silent successful transcripts stay distinct',async()=>{
  for(const mode of ['expired','viewOnce','tooLong','unsupported','missing-adapter','uncertain','silence'] as const){
    const f=fixture(),message=f.add('voice',false,mode==='expired' ? {expiresAt:9000} : mode==='viewOnce' ? {viewOnce:true}
      : mode==='tooLong' ? {duration:301} : mode==='unsupported' ? {access:'unsupported'} : {});
    const audio=f.service();let asr=0,replies=0;
    const model=remote(async url=>{
      if(String(url).endsWith('/audio/transcriptions')){asr++;return Response.json({text:mode==='silence' ? '' : 'Maybe six'});}
      replies++;return Response.json({choices:[{message:{content:JSON.stringify({action:{kind:'silence',reason:'No confident answer'}})}}]});
    });
    try {
      const result=draftGenerator(f.flow,mode==='missing-adapter' ? {generate:model.generate} : model,undefined,audio,()=>10000)(chat,'draft');
      if(mode==='expired' || mode==='viewOnce'){
        await assert.rejects(result,/no_inbound_message/);assert.equal(asr,0);assert.equal(f.state.loads,0);continue;
      }
      const draft=await result;
      if(mode==='uncertain' || mode==='silence'){
        assert.equal(draft.action.kind,'silence');assert.equal(asr,1);assert.equal(replies,1);
        assert.equal(f.store.asrAttempt(f.identity(message),10000)?.transcript?.uncertain,true);
      }else{assert.equal(draft.action.kind,'handover',mode);assert.equal(asr,0);assert.equal(replies,0);}
    }finally{audio.close();f.store.close();}
  }
});

test('ui59 only two recent eligible incoming notes are exported; consent and no-AI remain gates',async()=>{
  for(const gate of ['allowed','consent','noAI'] as const){
    const f=fixture();const incoming=[f.add('old'),f.add('middle'),f.add('latest')];f.add('outgoing',true);
    if(gate==='consent')f.store.saveModelConsent(f.flow.accountId,false);
    if(gate==='noAI')f.store.saveConversation({...f.flow.conversation(chat),mode:'never_reply'});
    const audio=f.service();let asr=0,replies=0;
    const model={transcribe:async()=>{asr++;return {text:'Synthetic words',uncertain:false};},generate:async()=>{replies++;return {kind:'silence' as const,reason:'Synthetic'};}};
    try {
      const result=draftGenerator(f.flow,model,undefined,audio,()=>10000)(chat,'draft');
      if(gate==='allowed'){
        await result;assert.equal(asr,2);assert.equal(replies,1);
        const oldest=incoming[0];assert.ok(oldest);assert.equal(f.store.asrAttempt(f.identity(oldest),10000),undefined);
      }else{await assert.rejects(result,/model_consent_required|ai_access_denied/);assert.equal(asr,0);assert.equal(replies,0);assert.equal(f.state.loads,0);}
    }finally{audio.close();f.store.close();}
  }
});
