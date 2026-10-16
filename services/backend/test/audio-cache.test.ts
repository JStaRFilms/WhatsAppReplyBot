import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { proto, type WAMessage } from '@whiskeysockets/baileys';
import { SqliteStore, Workflow, DomainError, historyDigest, aiAccess, type AsrSource, type Message, type AudioTranscript } from '@replybot/core';
import { AudioService, AUDIO_NORMALIZER, type Transcriber } from '../src/audio.ts';
import { ASR_PROVENANCE, OpenRouterClient } from '../src/openrouter.ts';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { normalizeWhatsApp, inspectHistoryRaw } from '../src/whatsapp-normalize.ts';
import { draftGenerator } from '../src/draft-model.ts';

const phone='15550000001@s.whatsapp.net',lid='15550000001@lid';
function raw(chat=phone,id='voice',version=1):WAMessage {
  return {key:{remoteJid:chat,id,fromMe:false},messageTimestamp:1,message:{audioMessage:{
    fileSha256:Buffer.alloc(32,version),mediaKey:Buffer.alloc(32,2),fileLength:100,seconds:2,mimetype:'audio/ogg',
    url:'https://mmg.whatsapp.net/synthetic'}}};
}
function serialized(value:WAMessage):string{return JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(value).finish()).toString('base64')});}
function fixture(path=':memory:') {
  const store=new SqliteStore(path);store.inspectHistoryRaw=inspectHistoryRaw;
  const flow=new Workflow(store,'synthetic-asr',()=>state.now);
  const state={now:1000,loads:0,normalizations:0,version:1,admitted:true};
  const adapter=new WhatsAppAdapter(flow,'synthetic-unused-auth',async()=>{},undefined,()=>state.now);
  function add(chat=phone,id='voice',version=1) {
    if(!store.conversation(flow.accountId,chat))store.saveConversation({id:chat,accountId:flow.accountId,contactId:chat,
      name:'Synthetic',kind:'direct',mode:'draft_only',excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
    const value=raw(chat,id,version),message=normalizeWhatsApp(value,flow.accountId,chat,'live');assert.ok(message);
    store.saveMessage(message);store.saveWaMessage(flow.accountId,chat,id,serialized(value));return message;
  }
  const message=store.message(flow.accountId,'wa:'+phone+':voice') ?? add();
  if(!store.modelConsent(flow.accountId))store.saveModelConsent(flow.accountId,true);
  const source=(m:Message)=>{
    const ref=store.historySource(flow.accountId,m.conversationId,m.id,state.now);
    if(ref?.state!=='available')return undefined;
    const contentId=adapter.audioIdentity(ref.message);if(!contentId)return undefined;
    return {message:ref.message,contentId,equivalents:ref.candidateIds.flatMap(id=>{
      const copy=store.message(flow.accountId,id);return copy && copy.id!==ref.messageId ? [copy] : [];
    })};
  };
  const identity=(m=message):AsrSource=>{
    const ref=source(m);assert.ok(ref);
    return {accountId:m.accountId,profileId:'synthetic-profile',conversationId:ref.message.conversationId,
      messageId:ref.message.id,transportId:ref.message.transportId,contentId:ref.contentId};
  };
  const service=()=>new AudioService(async()=>{state.loads++;return Buffer.from('synthetic-v'+state.version);},m=>state.admitted && adapter.mediaCurrent(source(m)?.message ?? m),()=>state.now,{
    store,profileId:'synthetic-profile',source,normalize:async input=>{state.normalizations++;return {bytes:Buffer.from('mp3:'+input.toString()),duration:2};},
  });
  const guard=()=>{
    if(!state.admitted)throw new DomainError('profile_revoked',403);
    if(!store.modelConsent(flow.accountId) || !aiAccess(flow.effectiveConversation(phone),flow.accountId))throw new DomainError('ai_access_denied',403);
  };
  return {store,flow,state,adapter,message,add,source,identity,service,guard};
}
function deferred<T>() {
  let resolve:(value:T)=>void=()=>{};
  const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};
}
const words:AudioTranscript={text:'No wahala — original.',uncertain:true};

test('same-source entry paths share one request; text survives byte TTL, byte eviction, service and database restart and default-model changes',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'replybot-asr-'));
  try {
    const path=join(dir,'synthetic.sqlite'),f=fixture(path);let calls=0;
    const model:Transcriber={asrProvenance:{adapter:'previous-adapter',model:'previous-model'},transcribe:async(_bytes,guard)=>{calls++;guard();await Promise.resolve();return words;}};
    let audio=f.service();
    try {
      const [first,second]=await Promise.all([audio.transcript(f.message,model,f.guard),audio.transcript(f.message,model,f.guard)]);
      assert.deepEqual(first,words);assert.deepEqual(second,words);assert.equal(calls,1);assert.equal(f.state.loads,1);
      f.state.now+=300001;
      await audio.transcript(f.message,model,f.guard);assert.equal(f.state.loads,1);
      for(let i=0;i<11;i++)await audio.preview(f.add(phone,'eviction-'+i));
      const loads=f.state.loads;assert.ok(audio['cache'].size<=10);
      await audio.transcript(f.message,model,f.guard);assert.equal(f.state.loads,loads);assert.equal(calls,1);
      audio.close();audio=f.service();
      await audio.transcript(f.message,{asrProvenance:ASR_PROVENANCE,transcribe:async()=>{throw new Error('cached text must be read before bytes or new-model dispatch');}},f.guard);
      const saved=f.store.asrAttempt(f.identity(),f.state.now);assert.equal(saved?.provenance?.model,'previous-model');
      assert.equal(saved?.provenance?.normalizer,AUDIO_NORMALIZER);
    }finally{audio.close();f.store.close();}
    const reopened=fixture(path),fresh=reopened.service();
    try {
      assert.equal(reopened.state.loads,0);reopened.store.historyPage(reopened.flow.accountId,phone);reopened.flow.context(phone);
      assert.equal(reopened.state.loads,0);
      assert.deepEqual(await fresh.transcript(reopened.message,model,reopened.guard),words);
      assert.equal(reopened.state.loads,0);assert.equal(calls,1);
    }finally{fresh.close();reopened.store.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('verified alias equivalents reuse original stored IDs, even when the current representative was not the previously transcribed copy',async()=>{
  const f=fixture();const older=f.message,other=f.add(lid),audio=f.service();let calls=0;
  const model={transcribe:async()=>{calls++;return words;}};
  try {
    const originalId=f.identity(other);await audio.transcript(other,model,()=>{});
    f.store.saveWaAlias(f.flow.accountId,lid,phone);
    assert.equal(f.source(other)?.message.id,older.id);
    const loads=f.state.loads;assert.deepEqual(await audio.transcript(older,model,f.guard),words);
    assert.deepEqual(await audio.transcript(other,model,f.guard),words);assert.equal(calls,1);assert.equal(f.state.loads,loads);
    assert.equal(f.store.asrAttempt(originalId,f.state.now)?.state,'complete');
    assert.equal(f.store.asrAttempt(f.identity(older),f.state.now),undefined);
    const c=f.flow.conversation(phone);f.store.saveConversation({...c,name:'Another synthetic name',nameRevision:3});
    f.flow.setOwnerInstructions({text:'Synthetic instructions',expectedRevision:0,requestId:'instructions'});
    await audio.transcript(older,model,f.guard);assert.equal(calls,1);
    const value=raw();assert.ok(value.message?.audioMessage);value.message.audioMessage.url='https://mmg.whatsapp.net/synthetic-refreshed';
    f.store.saveWaMessage(f.flow.accountId,phone,'voice',serialized(value));await audio.transcript(older,model,f.guard);assert.equal(calls,1);
  }finally{audio.close();f.store.close();}
});

test('an unknown alias attempt cannot become payable when verified mapping changes the representative',async()=>{
  const f=fixture(),other=f.add(lid),audio=f.service();let calls=0;
  try {
    const identity=f.identity(other),attempt=f.store.reserveAsr(identity,null,f.state.now);f.store.unknownAsr(f.flow.accountId,attempt);
    f.store.saveWaAlias(f.flow.accountId,lid,phone);
    await assert.rejects(audio.transcript(f.message,{transcribe:async()=>{calls++;return words;}},f.guard),/audio_attempt_unavailable/);
    assert.equal(calls,0);assert.equal(f.state.loads,0);assert.equal(f.store.asrAttempt(identity,1000)?.state,'unknown');
  }finally{audio.close();f.store.close();}
});

test('audio content changes cannot use old normalized bytes or late text, and unrelated identical audio is not authority',async()=>{
  const f=fixture(),audio=f.service();const seen:string[]=[];
  const model={transcribe:async(bytes:Buffer)=>{seen.push(bytes.toString());return words;}};
  try {
    const firstId=f.identity();await audio.transcript(f.message,model,f.guard);
    f.state.version=2;f.store.saveWaMessage(f.flow.accountId,phone,'voice',serialized(raw(phone,'voice',2)));
    await audio.transcript(f.message,model,f.guard);
    assert.deepEqual(seen,['mp3:synthetic-v1','mp3:synthetic-v2']);assert.equal(f.store.asrAttempt(firstId,f.state.now)?.state,'suppressed');
    assert.equal(audio['cache'].size,1);
    const unrelated=f.add(phone,'unrelated',2);await audio.transcript(unrelated,model,f.guard);assert.equal(seen.length,3);
    const otherChat=f.add('15550000002@s.whatsapp.net','voice',2);await audio.transcript(otherChat,model,()=>{});assert.equal(seen.length,4);
    assert.notEqual(historyDigest(f.identity(unrelated)),historyDigest(f.identity(otherChat)));
  }finally{audio.close();f.store.close();}
});

test('silence reuses durable text before bytes; definite preparation failures do not reserve a paid attempt',async()=>{
  const f=fixture(),audio=f.service();let calls=0;
  try {
    const model={transcribe:async()=>{calls++;return {text:'',uncertain:true};}};
    assert.deepEqual(await audio.transcript(f.message,model,f.guard),{text:'',uncertain:true});
    f.state.now+=300001;await audio.transcript(f.message,model,f.guard);assert.equal(calls,1);assert.equal(f.state.loads,1);
  }finally{audio.close();f.store.close();}
  const failed=fixture();let loads=0;
  const broken=new AudioService(async()=>{loads++;throw new DomainError('media_unavailable',404);},()=>true,()=>1000,
    {store:failed.store,profileId:'synthetic-profile',source:failed.source});
  try {
    for(let i=0;i<2;i++)await assert.rejects(broken.transcript(failed.message,{transcribe:async()=>{throw new Error('must not export');}},failed.guard),/media_unavailable/);
    assert.equal(loads,2);assert.equal(failed.store.asrAttempt(failed.identity(),1000),undefined);
  }finally{broken.close();failed.store.close();}
});

test('text eviction and exhausted marker capacity never dispatch another paid request',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'replybot-asr-capacity-'));
  try {
    const path=join(dir,'synthetic.sqlite'),f=fixture(path),audio=f.service(),db=new DatabaseSync(path);let calls=0;
    const model={transcribe:async()=>{calls++;return words;}};
    try {
      await audio.transcript(f.message,model,f.guard);const initial=f.identity();
      db.prepare(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<9998)
        INSERT INTO asr_attempts(account_id,profile_id,source_key,content_id,conversation_id,message_id,transport_id,attempt_id,state,transcript,last_used)
        SELECT ?,?,printf('%064x',i),?,'synthetic-seed-chat','seed-'||i,'seed-'||i,'seed-'||i,
          CASE WHEN i<=1000 THEN 'complete' ELSE 'suppressed' END,CASE WHEN i<=1000 THEN ? ELSE NULL END,2000+i FROM n`)
        .run(f.flow.accountId,'synthetic-profile',initial.contentId,JSON.stringify(words));
      const tail={...initial,messageId:'tail',transportId:'tail'};
      f.store.completeAsr(tail,f.store.reserveAsr(tail,null,30000),words,{...ASR_PROVENANCE,normalizer:AUDIO_NORMALIZER},30000);
      assert.equal(f.store.asrAttempt(initial,30001)?.state,'suppressed');
      const loads=f.state.loads;await assert.rejects(audio.transcript(f.message,model,f.guard),/audio_attempt_unavailable/);assert.equal(f.state.loads,loads);
      await assert.rejects(audio.transcript(f.add(phone,'new-source'),model,f.guard),/audio_attempt_capacity/);assert.equal(calls,1);
    }finally{db.close();audio.close();f.store.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('untrusted missing attachment metadata cannot download, normalize or export',async()=>{
  const f=fixture(),audio=f.service();let calls=0;
  try {
    const value=raw();assert.ok(value.message?.audioMessage);value.message.audioMessage.fileSha256=null;
    f.store.saveWaMessage(f.flow.accountId,phone,'voice',serialized(value));
    await assert.rejects(audio.transcript(f.message,{transcribe:async()=>{calls++;return words;}},f.guard),/media_unavailable/);
    assert.equal(calls,0);assert.equal(f.state.loads,0);assert.equal(f.state.normalizations,0);
  }finally{audio.close();f.store.close();}
});

test('network, timeout, malformed and non-OK results leave unknown markers that block new requests after service/DB restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'replybot-asr-unknown-'));
  try {
    for(const failure of ['network','timeout','malformed','http'] as const){
      const path=join(dir,failure+'.sqlite'),f=fixture(path),identity=f.identity();let calls=0;
      const client=new OpenRouterClient({apiKey:'synthetic-key',ownerConsent:true,allowRemote:true,fetcher:async()=>{
        calls++;if(failure==='network' || failure==='timeout')throw new Error('synthetic-private-provider-detail');
        return failure==='http' ? new Response('synthetic-private-provider-detail',{status:503}) : Response.json({wrong:'synthetic-private-provider-detail'});
      }});
      const model={asrProvenance:ASR_PROVENANCE,transcribe:(bytes:Buffer,guard:()=>void)=>client.transcribe(bytes,guard)};
      let audio=f.service();
      try {
        await assert.rejects(audio.transcript(f.message,model,f.guard),error=>error instanceof Error && !error.message.includes('synthetic-private-provider-detail'));
        assert.equal(f.store.asrAttempt(identity,f.state.now)?.state,'unknown');
        await assert.rejects(audio.transcript(f.message,model,f.guard),/audio_attempt_unavailable/);
        audio.close();audio=f.service();await assert.rejects(audio.transcript(f.message,model,f.guard),/audio_attempt_unavailable/);
        assert.equal(calls,1);
      }finally{audio.close();f.store.close();}
      const reopened=fixture(path),fresh=reopened.service();
      try{await assert.rejects(fresh.transcript(reopened.message,model,reopened.guard),/audio_attempt_unavailable/);assert.equal(calls,1);assert.equal(reopened.state.loads,0);}
      finally{fresh.close();reopened.store.close();}
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('orphan reservation reopens as unknown and reads never start model work',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'replybot-asr-crash-'));
  try {
    const path=join(dir,'synthetic.sqlite'),f=fixture(path),identity=f.identity();f.store.reserveAsr(identity,null,f.state.now);f.store.close();
    const reopened=fixture(path),audio=reopened.service();let calls=0;
    try {
      assert.equal(reopened.store.asrAttempt(identity,1000)?.state,'unknown');
      await assert.rejects(audio.transcript(reopened.message,{transcribe:async()=>{calls++;return words;}},reopened.guard),/audio_attempt_unavailable/);
      assert.equal(calls,0);assert.equal(reopened.state.loads,0);
    }finally{audio.close();reopened.store.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('delete/view-once/noAI/consent/expiry/profile guards block reuse and exports and remove retained text where applicable',async()=>{
  for(const change of ['delete','view_once','noAI','unknown_kind','consent','expiry','profile','manual'] as const){
    const f=fixture(),audio=f.service(),identity=f.identity();let calls=0;
    const model={transcribe:async()=>{calls++;return words;}};
    try {
      await audio.transcript(f.message,model,f.guard);const loads=f.state.loads;
      if(change==='delete' || change==='view_once')f.flow.restrictSource(phone,'voice',change==='delete'?'deleted':'view_once');
      else if(change==='noAI')f.store.saveConversation({...f.flow.conversation(phone),mode:'never_reply'});
      else if(change==='unknown_kind')f.store.saveConversation({...f.flow.conversation(phone),kind:'unknown'});
      else if(change==='consent')f.flow.setModelConsent(false,'revoke');
      else if(change==='expiry')f.flow.restrictSource(phone,'voice','expiry',999);
      else if(change==='profile')f.state.admitted=false;
      else f.flow.composer(phone,true,'hold');
      const guard=()=>{f.guard();if(f.flow.effectiveConversation(phone).control==='manual')throw new DomainError('manual_control',403);};
      await assert.rejects(audio.transcript(f.message,model,guard));assert.equal(calls,1);assert.equal(f.state.loads,loads);
      if(change!=='manual' && change!=='profile')assert.equal(f.store.asrAttempt(identity,f.state.now)?.transcript,null);
      if(change==='consent'){
        f.flow.setModelConsent(true,'restore');await assert.rejects(audio.transcript(f.message,model,f.guard),/audio_attempt_unavailable/);assert.equal(calls,1);
      }
    }finally{audio.close();f.store.close();}
  }
});

test('late responses cannot overwrite suppression or publish across source/content/workflow/profile changes',async()=>{
  for(const change of ['delete','noAI','consent','content','workflow','profile'] as const){
    const f=fixture(),audio=f.service(),identity=f.identity(),started=deferred<void>(),reply=deferred<AudioTranscript>();let calls=0,valid=true;
    const model={transcribe:async()=>{calls++;started.resolve();return reply.promise;}};
    const guard=()=>{f.guard();if(!valid)throw new DomainError('stale_workflow');};
    try {
      const job=audio.transcript(f.message,model,guard);const rejected=assert.rejects(job);await started.promise;
      if(change==='delete')f.flow.restrictSource(phone,'voice','deleted');
      else if(change==='noAI')f.store.saveConversation({...f.flow.conversation(phone),mode:'never_reply'});
      else if(change==='consent')f.flow.setModelConsent(false,'revoke');
      else if(change==='content')f.store.saveWaMessage(f.flow.accountId,phone,'voice',serialized(raw(phone,'voice',2)));
      else if(change==='profile')f.state.admitted=false;
      else valid=false;
      reply.resolve(words);await rejected;
      const saved=f.store.asrAttempt(identity,f.state.now);assert.equal(saved?.transcript,null);assert.notEqual(saved?.state,'complete');
      if(change==='workflow'){
        await assert.rejects(audio.transcript(f.message,model,f.guard),/audio_attempt_unavailable/);assert.equal(calls,1);
      }
    }finally{audio.close();f.store.close();}
  }
});

test('two active ASR jobs are the limit and shared callers retain their own permission guards',async()=>{
  const f=fixture(),audio=f.service(),started=deferred<void>(),reply=deferred<AudioTranscript>();let calls=0;
  const model={transcribe:async()=>{calls++;if(calls===2)started.resolve();return reply.promise;}};
  try {
    const other=f.add(phone,'second'),third=f.add(phone,'third');
    const first=audio.transcript(f.message,model,f.guard),second=audio.transcript(other,model,f.guard);await started.promise;
    await assert.rejects(audio.transcript(third,model,f.guard),/audio_busy/);
    await assert.rejects(audio.transcript(f.message,model,()=>{throw new DomainError('caller_denied',403);}),/caller_denied/);
    reply.resolve(words);await Promise.all([first,second]);assert.equal(calls,2);
  }finally{audio.close();f.store.close();}
});

test('UI draft and assistant share one ASR job; unknown audio hands over without a reply or paid replay',async()=>{
  const f=fixture(),audio=f.service();let asr=0,replies=0;
  const generate=draftGenerator(f.flow,{transcribe:async()=>{asr++;throw new DomainError('transcription_unknown',502);},generate:async()=>{
    replies++;assert.fail('Missing required audio must not reach the reply model');
  }},undefined,audio,()=>f.state.now);
  try {
    const [first,shared]=await Promise.all([generate(phone,'ui'),generate(phone,'assistant')]);
    assert.equal(first.id,shared.id);assert.equal(first.action.kind,'handover');assert.equal(first.state,'needs_owner');assert.equal(asr,1);assert.equal(replies,0);
    assert.equal(f.store.asrAttempt(f.identity(),f.state.now)?.state,'unknown');
    f.flow.dismissDraft(first.id,'dismiss');f.flow.quickControl(phone,'resume','explicit-owner-resume');
    const next=await generate(phone,'new-draft');assert.equal(next.action.kind,'handover');assert.equal(next.state,'needs_owner');
    assert.equal(asr,1);assert.equal(replies,0);assert.equal(f.store.asrAttempt(f.identity(),f.state.now)?.state,'unknown');
  }finally{audio.close();f.store.close();}
});
