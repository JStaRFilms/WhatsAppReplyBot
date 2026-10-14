import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat, message } from './fixtures.ts';
test('handover resolves after a verified owner reply, not typing, incoming or uncertain sends',async()=>{
 const store=new SqliteStore();store.saveConversation(chat());store.saveMessage(message());let now=1000;
 const flow=new Workflow(store,'a',()=>now);
 try{
  const d=flow.createDraft('c1',{kind:'handover',reason:'Confirm what you meant.'},1,'handover');
  flow.pause('c1','typing');assert.equal(store.draft('a',d.id)?.state,'needs_owner');
  flow.observe({...message('in2'),occurredAt:1100});assert.equal(store.draft('a',d.id)?.state,'needs_owner');
  now=1200;const o=flow.manualSend('c1',{kind:'text',text:'I meant tomorrow',reason:'Owner reply'},'reply');
  await flow.dispatch(o.id,async()=>({state:'unknown'}));assert.equal(store.draft('a',d.id)?.state,'needs_owner');
  flow.observe({...message('phone'),direction:'outbound',occurredAt:1300,text:'Let me explain'},true);
  assert.equal(store.draft('a',d.id)?.state,'resolved');assert.equal(flow.conversation('c1').control,'manual');
 }finally{store.close();}
});
test('recovery does not resolve from backfill or a reply predating an edited handover',()=>{
 const store=new SqliteStore();store.saveConversation(chat());store.saveMessage(message());let now=1000;const flow=new Workflow(store,'a',()=>now);
 try{
  const d=flow.createDraft('c1',{kind:'text',text:'Draft',reason:'Test'},1,'draft');
  now=2000;flow.editDraft(d.id,{kind:'handover',reason:'Confirm this.'},1,'edit');
  flow.observe({...message('late'),direction:'outbound',occurredAt:1500,text:'Old reply'},true);
  assert.equal(store.draft('a',d.id)?.state,'needs_owner');
  flow.observe({...message('history'),direction:'outbound',source:'backfill',occurredAt:2500,text:'Historical reply'},true);
  flow.recover();assert.equal(store.draft('a',d.id)?.state,'needs_owner');
 }finally{store.close();}
});
test('acknowledged app reply and explicit resume clear handovers without automatic resumption',async()=>{
 const store=new SqliteStore();store.saveConversation(chat());store.saveMessage(message());const flow=new Workflow(store,'a',()=>1000);
 try{
  const d=flow.createDraft('c1',{kind:'handover',reason:'Confirm this.'},1,'h');
  const o=flow.manualSend('c1',{kind:'text',text:'Here is my answer',reason:'Owner reply'},'m');
  await flow.dispatch(o.id,async()=>({state:'accepted',transportId:'sent'}));
  assert.equal(store.draft('a',d.id)?.state,'resolved');assert.equal(flow.conversation('c1').control,'manual');
  store.saveDraft({...d,state:'needs_owner'});
  const p=flow.propose('c1',{kind:'resume'},'r');flow.confirm(p.id,p.payloadHash,'c');
  assert.equal(store.draft('a',d.id)?.state,'resolved');
 }finally{store.close();}
});
