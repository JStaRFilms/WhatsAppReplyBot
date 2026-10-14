import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { SqliteStore,Workflow,type ModelContext,type Message } from '@replybot/core';
import { MediaService } from '../src/media.ts';
import { OpenRouterClient } from '../src/openrouter.ts';
import { draftGenerator } from '../src/draft-model.ts';
import { normalizeWhatsApp } from '../src/whatsapp-normalize.ts';
import { createApp } from '../src/server.ts';
function attachment(id='image',kind:'image'|'animated_sticker'|'gif'='image'):Message & {media:NonNullable<Message['media']>} {
  const m=normalizeWhatsApp({key:{id,remoteJid:'123@s.whatsapp.net'},messageTimestamp:1700000000,message:{imageMessage:{caption:'what is in this image?'}}},'owner','123@s.whatsapp.net','live');
  assert.ok(m?.media);return {...m,media:{...m.media,kind}};
}
const context=(messages:Message[]):ModelContext=>({instructions:'Reply as the account holder.',messages,memories:[],styleExamples:[],limitations:[],worstCaseTextTokens:500});

test('media previews and vision frames are real pixels, bounded, cached and revocable',async()=>{
  const bytes=await sharp({create:{width:160,height:120,channels:3,background:'#ff0000'}}).png().toBuffer();
  let loads=0;let current=true;
  const media=new MediaService(async()=>{loads++;return bytes;},m=>current && m.accountId==='owner');
  const m=attachment();const preview=await media.preview(m);
  assert.equal(preview.mime,'image/png');assert.equal((await sharp(preview.bytes).metadata()).width,160);
  const frames=await media.visuals(context([m]));assert.equal(frames.length,1);assert.match(frames[0]?.dataUrl ?? '',/^data:image\/jpeg;base64,/);assert.equal(loads,1);
  current=false;await assert.rejects(media.preview(m),/media_unavailable/);assert.equal(loads,1);
  current=true;
  for(const blocked of [{...m,accountId:'other'}, {...m,media:{...m.media,viewOnce:true}}, {...m,media:{...m.media,expiresAt:1}}])
    await assert.rejects(media.preview(blocked),/media_unavailable/);
  assert.equal(loads,1);
});
test('animated stickers and GIFs retain animation and provide labeled sampled frames',async()=>{
  const gif=await readFile(new URL('../../../apps/mobile/assets/demo-clock.gif',import.meta.url));
  const animatedWebp=await sharp(gif,{animated:true}).webp().toBuffer();
  for(const [kind,bytes] of [['animated_sticker',animatedWebp],['gif',gif]] as const){
    const media=new MediaService(async()=>bytes,()=>true);
    const m=attachment(kind,kind);const preview=await media.preview(m);
    assert.equal(preview.mime,'image/gif');assert.match(preview.bytes.subarray(0,6).toString(),/^GIF8[79]a$/);
    const frames=await media.visuals(context([m]));assert.ok(frames.length>=1 && frames.length<=2);assert.ok(frames.every(f=>f.sampled));
  }
});
test('OpenRouter includes attribution, participant labels and scoped visual content, never attachment URLs',async()=>{
  const m=attachment();const frame={messageId:m.id,dataUrl:'data:image/jpeg;base64,/9j/2Q==',sampled:false};
  const action={kind:'text',text:'red',reason:'Synthetic image'};
  let calls=0;
  const fetcher:typeof fetch=async(_url,init)=>{
    calls++;const headers=new Headers(init?.headers);assert.equal(headers.get('X-OpenRouter-Title'),'Otherme');
    assert.equal(headers.get('HTTP-Referer'),'http://localhost:8081');assert.equal(headers.get('X-OpenRouter-App-Visibility'),'hidden');
    const body=JSON.parse(String(init?.body));const content=body.messages[1].content;
    assert.ok(Array.isArray(content));assert.equal(JSON.parse(content[0].text).messages[0].speaker,'contact');
    assert.equal(content.at(-1).image_url.url,frame.dataUrl);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({action})}}]}));
  };
  const remote=new OpenRouterClient({apiKey:'synthetic',allowRemote:true,ownerConsent:true,fetcher});
  assert.deepEqual(await remote.generate(context([m]),[frame]),action);
  await assert.rejects(remote.generate(context([{...m,media:{...m.media,viewOnce:true}}]),[frame]),/invalid_media_input/);
  await assert.rejects(remote.generate(context([]),[frame]),/invalid_media_input/);assert.equal(calls,1);
});
test('never-reply and revoked consent block visual preparation or transmission',async()=>{
  const store=new SqliteStore();const m=attachment();store.saveConversation({id:m.conversationId,accountId:'owner',contactId:m.conversationId,name:'Synthetic',kind:'direct',mode:'never_reply',excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});store.saveMessage(m);
  const flow=new Workflow(store,'owner');let prepared=0;let calls=0;
  const generate=draftGenerator(flow,{generate:async()=>{calls++;return {kind:'silence',reason:'test'};}},{visuals:async()=>{prepared++;flow.setModelConsent(false,'revoke');return [];}});
  try{
    flow.setModelConsent(true,'enable');await assert.rejects(generate(m.conversationId,'denied'),/ai_access_denied/);assert.equal(prepared,0);
    store.saveConversation({...flow.conversation(m.conversationId),mode:'draft_only'});
    await assert.rejects(generate(m.conversationId,'revoke-during-media'),/stale_workflow|model_consent_revoked/);assert.equal(prepared,1);assert.equal(calls,0);
  }finally{store.close();}
});
test('media endpoint requires owner auth and rejects other-chat message IDs',async()=>{
  const store=new SqliteStore();const app=createApp({store,token:'test-owner-token',whatsapp:{authDir:'.runtime/not-opened-media-test'}});
  const m=attachment();store.saveConversation({id:m.conversationId,accountId:'whatsapp-owner',contactId:m.conversationId,name:'Synthetic',kind:'direct',mode:'draft_only',excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
  const c=store.conversation('whatsapp-owner',m.conversationId);assert.ok(c);
  store.saveConversation({...c,id:'456@s.whatsapp.net',contactId:'456@s.whatsapp.net'});
  store.saveMessage({...m,accountId:'whatsapp-owner',conversationId:'456@s.whatsapp.net'});
  try{
    const url='/v1/conversations/'+encodeURIComponent(m.conversationId)+'/media/'+encodeURIComponent(m.id);
    assert.equal((await app.inject({method:'GET',url})).statusCode,401);
    assert.equal((await app.inject({method:'GET',url,headers:{authorization:'Bearer test-owner-token'}})).statusCode,404);
  }finally{await app.close();}
});
