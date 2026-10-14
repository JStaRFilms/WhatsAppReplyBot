import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat,message } from './fixtures.ts';
function setup(){const store=new SqliteStore();store.saveConversation({...chat(),mode:'auto_reply'});store.saveMessage(message());let now=1000;const flow=new Workflow(store,'a',()=>now);const p=flow.propose('c1',{kind:'delegate',maxUnits:20,expiresAt:1000000},'grant');flow.confirm(p.id,p.payloadHash,'confirmed');return{store,flow,setNow:(n:number)=>{now=n;}};}
async function ownerReply(flow:Workflow,id:string){const o=flow.manualSend('c1',{kind:'text',text:'Owner answer',reason:'Test'},id);await flow.dispatch(o.id,async()=>({state:'accepted',transportId:id}));}
test('owner cooldown produces a catch-up draft job and preserves original grant limits',async()=>{
 const {store,flow,setNow}=setup();try{
 const g=store.grants('a')[0];await ownerReply(flow,'owner');
 assert.equal(flow.conversation('c1').pause?.until,301000);assert.equal(store.grants('a')[0]?.state,'active');
 setNow(10000);flow.observe({...message('new'),occurredAt:10000});setNow(300999);assert.deepEqual(flow.expirePauses(),[]);
 setNow(301000);const jobs=flow.expirePauses();assert.equal(jobs[0]?.conversationId,'c1');assert.equal(jobs[0]?.messageId,'new');assert.equal(flow.conversation('c1').control,'assistant_allowed');
 assert.equal(store.grants('a')[0]?.id,g?.id);assert.equal(store.grants('a')[0]?.maxUnits,20);
 flow.finishCatchUp('c1','new');assert.deepEqual(flow.expirePauses(),[]);
 }finally{store.close();}
});
test('replaying an accepted dispatch cannot extend its owner cooldown',async()=>{
 const {store,flow,setNow}=setup();try{
 const out=flow.manualSend('c1',{kind:'text',text:'Owner reply',reason:'Test'},'sent');let calls=0;
 await flow.dispatch(out.id,async()=>{calls++;return{state:'accepted',transportId:'sent'};});const until=flow.conversation('c1').pause?.until;
 setNow(90000);await flow.dispatch(out.id,async()=>{calls++;return{state:'accepted',transportId:'duplicate'};});
 assert.equal(calls,1);assert.equal(flow.conversation('c1').pause?.until,until);
 }finally{store.close();}
});
test('empty composer releases only its hold; unsent text and indefinite pause remain protected',async()=>{
 const {store,flow,setNow}=setup();try{
 await ownerReply(flow,'owner');flow.composer('c1',true,'type');flow.composer('c1',false,'clear');setNow(11001);flow.expirePauses();assert.equal(flow.conversation('c1').control,'manual');
 flow.composer('c1',true,'draft');setNow(400000);flow.expirePauses();assert.equal(flow.conversation('c1').control,'manual');assert.throws(()=>flow.quickControl('c1','resume','blocked'),/composer_has_text/);
 flow.quickControl('c1','indefinite','hold');flow.composer('c1',false,'empty');setNow(500000);flow.expirePauses();assert.equal(flow.conversation('c1').control,'manual');
 flow.quickControl('c1','resume','resume');assert.equal(flow.conversation('c1').control,'assistant_allowed');assert.equal(store.grants('a')[0]?.maxUnits,20);
 }finally{store.close();}
});
test('one device clearing its composer cannot release another device draft',()=>{
 const {store,flow,setNow}=setup();try{
 flow.composer('c1',true,'pc','desktop');flow.composer('c1',true,'phone','phone');
 flow.composer('c1',false,'clear-pc','desktop');setNow(20000);flow.expirePauses();
 assert.equal(flow.conversation('c1').pause?.composing,true);assert.equal(flow.conversation('c1').control,'manual');
 flow.composer('c1',false,'clear-phone','phone');setNow(30001);flow.expirePauses();assert.equal(flow.conversation('c1').control,'assistant_allowed');
 }finally{store.close();}
});
test('subsequent owner sends reset cooldown; handovers wait for an owner response',async()=>{
 const {store,flow,setNow}=setup();try{
 const d=flow.createDraft('c1',{kind:'handover',reason:'Confirm this.'},flow.conversation('c1').workflowVersion,'h');setNow(400000);assert.deepEqual(flow.expirePauses(),[]);assert.equal(flow.conversation('c1').control,'manual');
 await ownerReply(flow,'response');assert.equal(store.draft('a',d.id)?.state,'resolved');assert.equal(flow.conversation('c1').pause?.until,700000);
 setNow(500000);await ownerReply(flow,'followup');assert.equal(flow.conversation('c1').pause?.until,800000);
 flow.quickControl('c1','extend','extend');assert.equal(flow.conversation('c1').pause?.until,1100000);
 }finally{store.close();}
});
