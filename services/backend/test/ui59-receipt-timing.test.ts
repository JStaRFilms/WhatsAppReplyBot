import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { proto, type WAMessage } from '@whiskeysockets/baileys';
import { SqliteStore, Workflow } from '@replybot/core';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { normalizeWhatsApp } from '../src/whatsapp-normalize.ts';

const chat='15550000059@s.whatsapp.net',owner='15550000999@s.whatsapp.net';
function deferred<T>(){let resolve:(value:T)=>void=()=>{};const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
async function fixture(send:(jid:string,content:unknown,options:{messageId:string})=>Promise<unknown>){
  const root=fileURLToPath(new URL('../../../.runtime/ui-task59/synthetic-fixtures',import.meta.url));mkdirSync(root,{recursive:true});
  const auth=mkdtempSync(join(root,'receipt-'));writeFileSync(join(auth,'owner-identity.json'),JSON.stringify({owner}));
  const store=new SqliteStore(),flow=new Workflow(store,'ui59-receipt',()=>10000),ev=new EventEmitter();let reads=0;
  store.saveConversation({id:chat,accountId:flow.accountId,contactId:chat,name:'Synthetic',kind:'direct',mode:'draft_only',excluded:false,
    control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
  const target:WAMessage={key:{remoteJid:chat,id:'target',fromMe:false},messageTimestamp:1,message:{conversation:'Synthetic message'}};
  const message=normalizeWhatsApp(target,flow.accountId,chat,'live');assert.ok(message);
  store.saveMessage(message);store.saveWaMessage(flow.accountId,chat,'target',JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(target).finish()).toString('base64')}));
  const adapter=new WhatsAppAdapter(flow,auth,async()=>{},undefined,()=>10000,true);
  Object.defineProperties(adapter,{
    loadAuth:{value:async()=>({state:{creds:{me:{id:owner}},keys:{}},saveCreds:async()=>{}})},
    makeSocket:{value:()=>({ev,user:{id:owner},end:()=>{},readMessages:()=>{reads++;},sendMessage:send})},
  });
  await adapter.start();ev.emit('connection.update',{connection:'open'});
  return {adapter,ev,store,flow,message,reads:()=>reads,dispose:async()=>{await adapter.stop();store.close();rmSync(auth,{recursive:true,force:true});}};
}

for(const event of ['status','recipient'] as const){
  test(`ui59 known ${event} receipt is observed during an unrelated blocked history lane, before send resolution`,async()=>{
    const started=deferred<string>(),sent=deferred<unknown>(),backlog=deferred<void>();
    const f=await fixture(async(_jid,_content,options)=>{started.resolve(options.messageId);return sent.promise;});
    let pending:ReturnType<WhatsAppAdapter['dispatch']>|undefined;
    try {
      const queued=f.flow.manualSend(chat,{kind:'text',text:'Synthetic reply',reason:'Explicit owner action'},'send');
      pending=f.adapter.dispatch(queued.id);const id=await started.promise;
      const before=f.flow.conversation(chat),unread=f.store.unreadCounts(f.flow.accountId);
      // A cooperative history batch can yield to I/O while its event promise is still pending.
      f.adapter['events']=backlog.promise;
      const key={remoteJid:chat,id,fromMe:true};
      if(event==='status')f.ev.emit('messages.update',[{key,update:{status:proto.WebMessageInfo.Status.READ}}]);
      else f.ev.emit('message-receipt.update',[{key,receipt:{userJid:chat,readTimestamp:10}}]);
      await Promise.resolve();
      assert.equal(f.store.outbox(f.flow.accountId,queued.id)?.components[0]?.outgoingReceipt?.level,'read');
      assert.equal(f.store.outbox(f.flow.accountId,queued.id)?.state,'dispatching');
      assert.deepEqual(f.flow.conversation(chat),before);assert.deepEqual(f.store.unreadCounts(f.flow.accountId),unread);assert.equal(f.reads(),0);
      sent.resolve({key});await pending;
      assert.equal(f.store.messages(f.flow.accountId,chat).find(m=>m.transportId===id)?.outgoingReceipt?.level,'read');
    }finally{backlog.resolve();sent.resolve(undefined);await pending;await f.dispose();}
  });
}

test('ui59 reaction sends exactly a react payload with the physical target key and never an extra text message or invented receipt',async()=>{
  const payloads:unknown[]=[];
  const f=await fixture(async(jid,content,options)=>{payloads.push(content);return {key:{remoteJid:jid,id:options.messageId,fromMe:true}};});
  try {
    const queued=f.flow.manualSend(chat,{kind:'reaction',reaction:{targetMessageId:f.message.id,emoji:'👍'},reason:'Explicit owner reaction'},'react');
    const sent=await f.adapter.dispatch(queued.id);
    assert.equal(sent.state,'accepted');
    const payload=z.array(z.object({react:z.object({text:z.string(),key:z.object({remoteJid:z.string(),id:z.string(),fromMe:z.boolean()})}).strict()}).strict()).parse(payloads);
    assert.deepEqual(payload,[{react:{text:'👍',key:{remoteJid:chat,id:'target',fromMe:false}}}]);
    assert.equal(sent.components[0]?.outgoingReceipt,undefined);
    assert.equal(f.store.messages(f.flow.accountId,chat).length,1);assert.equal(f.store.messages(f.flow.accountId,chat)[0]?.reaction,'👍');assert.equal(f.reads(),0);
    await f.adapter.stop();
    f.ev.emit('messages.update',[{key:{remoteJid:chat,id:sent.components[0]?.transportId,fromMe:true},update:{status:proto.WebMessageInfo.Status.READ}}]);
    await f.adapter['events'];assert.equal(f.store.outbox(f.flow.accountId,queued.id)?.components[0]?.outgoingReceipt,undefined);
  }finally{await f.dispose();}
  assert.doesNotThrow(()=>f.ev.emit('message-receipt.update',[{key:{remoteJid:chat,id:'stale',fromMe:true},receipt:{userJid:chat,readTimestamp:1}}]));
});

test('ui59 receipt fallback retains ordered alias resolution without buffering orphan IDs',async()=>{
  const f=await fixture(async(jid,_content,options)=>({key:{remoteJid:jid,id:options.messageId,fromMe:true}}));
  const backlog=deferred<void>();
  try {
    const queued=f.flow.manualSend(chat,{kind:'text',text:'Synthetic',reason:'Owner intent'},'send');
    const sent=await f.adapter.dispatch(queued.id),id=sent.components[0]?.transportId;assert.ok(id);
    f.adapter['events']=backlog.promise;
    f.ev.emit('lid-mapping.update',{lid:'59000@lid',pn:chat});
    const update=(transportId:string)=>f.ev.emit('messages.update',[{key:{remoteJid:'59000@lid',id:transportId,fromMe:true},update:{status:proto.WebMessageInfo.Status.READ}}]);
    update(id);update('unbound-orphan');
    assert.equal(f.store.outgoingReceipt(f.flow.accountId,chat,id),undefined);
    backlog.resolve();await f.adapter['events'];
    assert.equal(f.store.outgoingReceipt(f.flow.accountId,chat,id)?.level,'read');
    assert.equal(f.store.outgoingReceipt(f.flow.accountId,chat,'unbound-orphan'),undefined);assert.equal(f.reads(),0);
  }finally{backlog.resolve();await f.dispose();}
});
