import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as flush } from 'node:timers/promises';
import makeWASocket, { cleanMessage, proto, type WAMessage } from '@whiskeysockets/baileys';
import { SqliteStore, Workflow, type Action } from '@replybot/core';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { ReplyWindow } from '../src/reply-window.ts';
import { normalizeWhatsApp } from '../src/whatsapp-normalize.ts';

const chat='123@s.whatsapp.net';
const owner='456@s.whatsapp.net';
function setup(maxUnits=5) {
  let now=1000;const store=new SqliteStore();
  store.saveConversation({id:chat,accountId:'a',contactId:chat,name:'Synthetic',kind:'direct',mode:'auto_reply',excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
  const raw:WAMessage={key:{remoteJid:chat,id:'target',fromMe:true},messageTimestamp:1,message:{conversation:'Synthetic owner target'}};
  const target=normalizeWhatsApp(raw,'a',chat,'live');assert.ok(target);store.saveMessage(target);
  store.saveWaMessage('a',chat,'target',JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(raw).finish()).toString('base64')}));
  const inbound=normalizeWhatsApp({...raw,key:{...raw.key,id:'input',fromMe:false}},'a',chat,'live');assert.ok(inbound);store.saveMessage(inbound);
  const flow=new Workflow(store,'a',()=>now,async ms=>{now+=ms;});flow.setModelConsent(true,'consent');
  const grant=flow.propose(chat,{kind:'delegate',maxUnits,expiresAt:100000},'grant');flow.confirm(grant.id,grant.payloadHash,'confirm');
  const presence:string[]=[];const sent:{text:string;quote:string | null}[]=[];
  type Socket=ReturnType<typeof makeWASocket>;
  const socket:Pick<Socket,'user'|'sendPresenceUpdate'|'sendMessage'|'end'>={
    user:{id:owner},end:async()=>{},sendPresenceUpdate:async state=>{presence.push(state);},
    sendMessage:async(jid,content,options)=>{
      const text='text' in content ? content.text : 'reaction';sent.push({text,quote:options?.quoted?.key.id ?? null});
      return {key:{remoteJid:jid,id:options?.messageId ?? 'sent',fromMe:true},messageTimestamp:1,message:{conversation:text}};
    },
  };
  const adapter=new WhatsAppAdapter(flow,'unused',async()=>{},undefined,()=>now);
  Object.defineProperties(adapter,{socket:{value:socket,writable:true},verifiedSocket:{value:socket,writable:true},status:{value:{...adapter.snapshot(),state:'connected'},writable:true}});
  return {store,flow,adapter,socket,target,inbound,presence,sent,advance:(ms:number)=>{now+=ms;}};
}
function queue(flow:Workflow,action:Action) {
  const draft=flow.createDraft(chat,action,flow.conversation(chat).workflowVersion,'draft');return flow.autoSend(draft.id,'send');
}

test('installed Baileys owner target normalization permits an omitted target remoteJid, then live upsert upgrades its observation',async()=>{
  const {store,flow,adapter,target}=setup();
  // This is cleanMessage plus the exact processMessage messages.reaction projection.
  const raw:WAMessage={key:{remoteJid:chat,id:'owner-reaction',fromMe:true},messageTimestamp:2,
    message:{reactionMessage:{key:{id:'target',fromMe:true},text:'🔥',senderTimestampMs:2000}}};
  cleanMessage(raw,owner,'456@lid');const reaction=raw.message?.reactionMessage;assert.ok(reaction?.key);
  assert.equal(reaction.key.remoteJid,undefined);
  try{
    const version=flow.conversation(chat).workflowVersion;
    adapter['receiveReaction'](reaction.key,{...reaction,key:raw.key},'unknown');
    assert.equal(store.message('a',target.id)?.observedReactions?.[0]?.actor,'owner');assert.equal(flow.conversation(chat).workflowVersion,version);
    await adapter['receive'](raw,'live');
    assert.equal(store.message('a',target.id)?.observedReactions?.[0]?.source,'live');assert.equal(flow.conversation(chat).control,'manual');
    assert.equal(flow.conversation(chat).pause?.until,2000+5*60*1000);
  }finally{await adapter.stop();store.close();}
});
test('native reaction envelopes without a chat resolve only within their target and never infer owner from target.fromMe',async()=>{
  const {store,flow,adapter,target}=setup();
  try{
    adapter['receiveReaction']({remoteJid:chat,id:'target',fromMe:true},{key:{id:'contact-react',fromMe:false},text:'🔥',senderTimestampMs:2000},'unknown');
    assert.equal(store.message('a',target.id)?.observedReactions?.[0]?.actor,'contact');assert.equal(flow.conversation(chat).control,'assistant_allowed');
    adapter['receiveReaction']({remoteJid:chat,id:'target',fromMe:true},{key:{id:'unknown-react'},text:'😂',senderTimestampMs:3000},'unknown');
    assert.equal(store.message('a',target.id)?.observedReactions?.at(-1)?.actor,'unknown');assert.equal(flow.conversation(chat).control,'assistant_allowed');
    const before=store.message('a',target.id);
    adapter['receiveReaction']({id:'target'},{key:{id:'unscoped',fromMe:true},text:'❤️',senderTimestampMs:4000},'live');
    adapter['receiveReaction']({remoteJid:chat,id:'target'},{key:{remoteJid:'999@s.whatsapp.net',id:'foreign',fromMe:true},text:'❤️',senderTimestampMs:4000},'live');
    assert.deepEqual(store.message('a',target.id),before);
  }finally{await adapter.stop();store.close();}
});
test('PN/LID alternate envelope keys reconcile before lookup, preserve actors and record contact removals',async()=>{
  const {store,flow,adapter,target}=setup();
  try{
    adapter['receiveReaction']({remoteJid:'123@lid',id:'target',fromMe:true},{key:{remoteJid:'123@lid',remoteJidAlt:chat,id:'contact-fire',fromMe:false},text:'🔥',senderTimestampMs:2000},'unknown');
    assert.equal(store.message('a',target.id)?.observedReactions?.[0]?.emoji,'🔥');assert.equal(store.waCanonical('a','123@lid'),chat);assert.equal(store.waCanonical('another-account','123@lid'),'123@lid');
    adapter['receiveReaction']({remoteJid:chat,id:'target'},{key:{id:'owner-heart',fromMe:true},text:'❤️',senderTimestampMs:3000},'backfill');
    adapter['receiveReaction']({remoteJid:'123@lid',id:'target'},{key:{remoteJid:chat,id:'contact-remove',fromMe:false},text:'',senderTimestampMs:4000},'replay');
    const observations=store.message('a',target.id)?.observedReactions;
    assert.equal(observations?.find(r=>r.actor==='owner')?.emoji,'❤️');assert.equal(observations?.find(r=>r.actor==='contact')?.emoji,null);
    assert.equal(flow.conversation(chat).control,'assistant_allowed');
  }finally{await adapter.stop();store.close();}
});
test('reaction event processing still requires the current account-verified socket',async()=>{
  const {store,adapter,target}=setup();const socket=adapter['socket'];assert.ok(socket);
  try{
    adapter['verifiedSocket']=undefined;
    adapter['enqueueData'](socket,async()=>adapter['receiveReaction']({remoteJid:chat,id:'target'},{key:{id:'blocked',fromMe:true},text:'🔥',senderTimestampMs:2000},'live'));
    await adapter['events'];assert.equal(store.message('a',target.id)?.observedReactions,undefined);
    adapter['verifiedSocket']=socket;adapter['socket']=undefined;
    adapter['enqueueData'](socket,async()=>adapter['receiveReaction']({remoteJid:chat,id:'target'},{key:{id:'old-socket',fromMe:true},text:'🔥',senderTimestampMs:2000},'live'));
    await adapter['events'];assert.equal(store.message('a',target.id)?.observedReactions,undefined);
  }finally{await adapter.stop();store.close();}
});
test('source-shaped assistant reaction echoes never take over and late acceptance preserves a newer human reaction',async()=>{
  const {store,flow,adapter,socket,target}=setup();
  const queued=queue(flow,{kind:'reaction',reaction:{targetMessageId:target.id,emoji:'🔥'},reason:'test'});
  const send=socket.sendMessage;
  socket.sendMessage=async(jid,content,options)=>{
    assert.ok('react' in content);assert.ok(content.react.key);assert.ok(options?.messageId);
    adapter['receiveReaction'](content.react.key,{key:{id:options.messageId,fromMe:true},text:'🔥',senderTimestampMs:2000},'live');
    assert.equal(flow.conversation(chat).control,'assistant_allowed');assert.equal(store.message('a',target.id)?.observedReactions?.[0]?.actor,'assistant');
    adapter['receiveReaction'](content.react.key,{key:{id:'human-reaction',fromMe:true},text:'❤️',senderTimestampMs:3000},'live');
    return send(jid,content,options);
  };
  try{
    assert.equal((await adapter.dispatch(queued.id)).state,'accepted');assert.equal(flow.conversation(chat).control,'manual');
    assert.equal(store.message('a',target.id)?.observedReactions?.[0]?.actor,'owner');assert.equal(store.message('a',target.id)?.reaction,'❤️');
  }finally{await adapter.stop();store.close();}
});
test('mock sequence transport uses each component quote and accepted assistant echoes do not take over',async()=>{
  const {store,flow,adapter,socket,target,inbound,sent}=setup(3);
  const queued=queue(flow,{kind:'text_sequence',messages:[{text:'one',quotedMessageId:target.id},{text:'two'},{text:'three',quotedMessageId:inbound.id}],reason:'test'});
  const raw:WAMessage={key:{remoteJid:chat,id:'input',fromMe:false},messageTimestamp:1,message:{conversation:'input'}};
  store.saveWaMessage('a',chat,'input',JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(raw).finish()).toString('base64')}));
  const send=socket.sendMessage;
  socket.sendMessage=async(jid,content,options)=>{
    const result=await send(jid,content,options);assert.ok(result);await adapter['receive'](result,'live');return result;
  };
  try{
    assert.equal((await adapter.dispatch(queued.id)).state,'accepted');assert.deepEqual(sent.map(s=>s.quote),['target',null,'input']);
    assert.equal(flow.conversation(chat).control,'assistant_allowed');assert.equal(store.grants('a',chat)[0]?.successfulUnits,3);
  }finally{await adapter.stop();store.close();}
});
test('disconnect before the first handoff cancels a queued burst and releases its whole reservation',async()=>{
  const {store,flow,adapter,sent}=setup();const queued=queue(flow,{kind:'text_sequence',messages:[{text:'one'},{text:'two'}],reason:'test'});
  try{
    await adapter.stop();const result=await adapter.dispatch(queued.id);assert.equal(result.state,'cancelled');assert.deepEqual(sent,[]);
    assert.equal(store.grants('a',chat)[0]?.reservedUnits,0);assert.equal(store.grants('a',chat)[0]?.successfulUnits,0);
  }finally{store.close();}
});
test('socket loss during an accepted burst cancels only its unsent parts',async()=>{
  const {store,flow,adapter,socket}=setup();
  const queued=queue(flow,{kind:'text_sequence',messages:[{text:'one'},{text:'two'}],reason:'test'});
  const send=socket.sendMessage;socket.sendMessage=async(jid,content,options)=>{
    const result=await send(jid,content,options);adapter['connectionLife'].abort();return result;
  };
  try{
    const result=await adapter.dispatch(queued.id);assert.deepEqual(result.components.map(p=>p.state),['accepted','cancelled']);
    assert.equal(store.grants('a',chat)[0]?.successfulUnits,1);assert.equal(store.grants('a',chat)[0]?.reservedUnits,0);
  }finally{await adapter.stop();store.close();}
});
test('presence spans the quiet window and generation, and an old cleanup cannot clear a new turn',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});const {store,adapter,inbound,presence}=setup();
  let release:()=>void=()=>{};
  const window=new ReplyWindow(async()=>{await new Promise<void>(resolve=>{release=resolve;});},5000,(message,current)=>adapter.beginPresence(message.conversationId,current));
  try{
    const first=window.enqueue(inbound);await flush();assert.deepEqual(presence,['composing']);
    t.mock.timers.tick(5000);await flush();assert.equal(presence.at(-1),'composing');
    const cleanup=adapter.beginPresence(chat,()=>true);await flush();const nextCleanup=adapter.beginPresence(chat,()=>true);await flush();
    const length=presence.length;cleanup();await flush();assert.equal(presence.length,length);
    release();await first;await flush();assert.equal(presence.length,length);
    nextCleanup();await flush();assert.equal(presence.at(-1),'paused');
    const before=presence.length;await window.enqueue({...inbound,id:'backfill',source:'backfill'});assert.equal(presence.length,before);
  }finally{await window.close();await adapter.stop();store.close();}
});
test('presence clears immediately on owner controls, new input and consent loss and never starts in ineligible chats',async()=>{
  for(const cause of ['pause','composer','owner','incoming','consent','draft','excluded','capacity','identity'] as const){
    const {store,flow,adapter,presence,inbound}=setup();
    try{
      if(cause==='draft')store.saveConversation({...flow.conversation(chat),mode:'draft_only'});
      if(cause==='excluded')store.saveConversation({...flow.conversation(chat),excluded:true});
      if(cause==='capacity'){const grant=store.grants('a',chat)[0];assert.ok(grant);store.saveGrant({...grant,successfulUnits:5});}
      if(cause==='identity')adapter['verifiedSocket']=undefined;
      const cleanup=adapter.beginPresence(chat,()=>true);await flush();
      if(['draft','excluded','capacity','identity'].includes(cause)){assert.deepEqual(presence,[],cause);cleanup();continue;}
      assert.deepEqual(presence,['composing']);
      if(cause==='pause')flow.pause(chat,'pause');
      if(cause==='composer')flow.composer(chat,true,'typing');
      if(cause==='owner')flow.observe({...inbound,id:'human',transportId:'human',direction:'outbound'},true);
      if(cause==='incoming')flow.observe({...inbound,id:'new',transportId:'new'});
      if(cause==='consent')flow.setModelConsent(false,'revoke');
      await flush();assert.equal(presence.at(-1),'paused',cause);cleanup();
    }finally{await adapter.stop();store.close();}
  }
});
test('grant expiry and source-window cancellation clear presence, while presence errors cannot make sends unknown',async t=>{
  t.mock.timers.enable({apis:['setInterval']});const {store,flow,adapter,presence,advance,socket}=setup(2);
  try{
    adapter.beginPresence(chat,()=>true);await flush();advance(100000);t.mock.timers.tick(1000);await flush();assert.equal(presence.at(-1),'paused');
    advance(-100000);let current=true;adapter.beginPresence(chat,()=>current);await flush();current=false;t.mock.timers.tick(1000);await flush();assert.equal(presence.at(-1),'paused');
    socket.sendPresenceUpdate=async()=>{throw new Error('Synthetic presence failure');};
    const queued=queue(flow,{kind:'text_sequence',messages:[{text:'one'},{text:'two'}],reason:'test'});
    const result=await adapter.dispatch(queued.id);await flush();assert.equal(result.state,'accepted');assert.equal(store.grants('a',chat)[0]?.successfulUnits,2);
  }finally{await adapter.stop();store.close();}
});
