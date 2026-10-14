import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { automaticDecision } from '../src/policy.ts';
import { chat,message } from './fixtures.ts';

test('extended and unbounded allowances require exact owner risk acceptance and retain accounting',async()=>{
  for(const [maxUnits,expiresAt] of [[null,null],[null,100000],[3,null],[25,172801000]] as const){
    const store=new SqliteStore();store.saveConversation(chat());store.saveMessage(message());
    const flow=new Workflow(store,'a',()=>1000);
    try{
      const input={kind:'configure' as const,mode:'auto_reply' as const,maxUnits,expiresAt};
      assert.throws(()=>flow.propose('c1',input,'no-warning'),/delegation_warning_required/);
      const p=flow.propose('c1',{...input,acknowledgeRisk:true},'proposal');
      assert.equal(p.riskAccepted,true);flow.confirm(p.id,p.payloadHash,'confirm');
      const grant=store.grants('a')[0];assert.ok(grant);
      assert.equal(grant.maxUnits,maxUnits);assert.equal(grant.expiresAt,expiresAt);
      const c=flow.conversation('c1');assert.equal(automaticDecision(c,[c],'a',1000,'live',grant),'auto');
      const draft=flow.createDraft('c1',{kind:'text',text:'okay',reason:'synthetic'},c.workflowVersion,'draft');
      const queued=flow.autoSend(draft.id,'send');
      await flow.dispatch(queued.id,async()=>({state:'accepted',transportId:'synthetic'}));
      assert.equal(store.grants('a')[0]?.successfulUnits,1);assert.equal(store.grants('a')[0]?.reservedUnits,0);
      flow.quickControl('c1','indefinite','pause');flow.quickControl('c1','resume','resume');
      assert.equal(store.grants('a')[0]?.id,grant.id);assert.equal(store.grants('a')[0]?.successfulUnits,1);
    }finally{store.close();}
  }
});
test('invalid counts and past dates stay invalid even with risk acceptance',()=>{
  const store=new SqliteStore();store.saveConversation(chat());const flow=new Workflow(store,'a',()=>1000);
  try{for(const [maxUnits,expiresAt] of [[0,null],[-1,null],[1.5,null],[Infinity,null],[null,999]] as const)
    assert.throws(()=>flow.propose('c1',{kind:'configure',mode:'auto_reply',maxUnits,expiresAt,acknowledgeRisk:true},JSON.stringify([maxUnits,expiresAt])),/invalid_delegation/);
  }finally{store.close();}
});
test('owner sends do not imply that inbound messages were viewed in this app',async()=>{
  const store=new SqliteStore();store.saveConversation(chat());const flow=new Workflow(store,'a',()=>1000);
  try{
    flow.observe(message());assert.equal(store.unreadCounts('a').c1,1);
    flow.observe({...message('owner'),direction:'outbound',authorship:'owner_written',occurredAt:200},true);
    assert.equal(store.unreadCounts('a').c1,1);
    const queued=flow.manualSend('c1',{kind:'text',text:'quick reply',reason:'owner'},'manual');
    await flow.dispatch(queued.id,async()=>({state:'accepted',transportId:'owner-sent'}));
    assert.equal(store.unreadCounts('a').c1,1);
    store.markViewedPosition('a','c1',store.historyWatermark('a','c1',store.recentMessages('a','c1').map(m=>m.id)));
    assert.equal(store.unreadCounts('a').c1,undefined);
  }finally{store.close();}
});
