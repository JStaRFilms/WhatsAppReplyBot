import test from 'node:test';
import assert from 'node:assert/strict';
import type { Message } from '@replybot/core';
import { ReplyWindow } from '../src/reply-window.ts';
import { SqliteStore,Workflow } from '@replybot/core';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
const incoming=(id:string):Message=>({id,accountId:'test',conversationId:'test-chat',transportId:id,direction:'inbound',authorship:'contact_written',text:id,occurredAt:1000,source:'live',quotedMessageId:null,statusReply:false,statusContext:null,media:null,reaction:null});
test('five-second quiet window resets on each contact message and never queues replay',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const calls:string[]=[];
  const window=new ReplyWindow(async m=>{calls.push(m.id);});
  const first=window.enqueue(incoming('one'));t.mock.timers.tick(4999);assert.equal(calls.length,0);
  const latest=window.enqueue(incoming('two'));await first;t.mock.timers.tick(4999);assert.equal(calls.length,0);
  t.mock.timers.tick(1);await latest;assert.deepEqual(calls,['two']);
  await window.enqueue({...incoming('history'),source:'backfill'});t.mock.timers.tick(5000);assert.deepEqual(calls,['two']);await window.close();
});
test('replacement and disconnect invalidate an in-flight reply before its send',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let release:()=>void=()=>{};const sent:string[]=[];
  const window=new ReplyWindow(async(m,current)=>{await new Promise<void>(resolve=>{release=resolve;});if(current())sent.push(m.id);});
  const first=window.enqueue(incoming('one'));t.mock.timers.tick(5000);await Promise.resolve();
  const next=window.enqueue(incoming('two'));release();await first;assert.deepEqual(sent,[]);
  const store=new SqliteStore();const adapter=new WhatsAppAdapter(new Workflow(store,'test'),'unused-auth',async()=>{},()=>window.clear());
  await adapter.stop();await next;t.mock.timers.tick(5000);assert.deepEqual(sent,[]);await window.close();store.close();
});
