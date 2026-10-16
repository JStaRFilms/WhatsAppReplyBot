import test from 'node:test';
import assert from 'node:assert/strict';
import {SqliteStore} from '../src/store.ts';
import {Workflow} from '../src/workflow.ts';
import {chat} from './fixtures.ts';
const phone='15550000001@s.whatsapp.net',lid='123@lid';
for(const setting of ['consent','instructions'] as const)test(`account-wide ${setting} change invalidates physical aliases once and preserves unknown manual work`,()=>{
 const store=new SqliteStore();
 try{
  store.saveConversation(chat(phone));store.saveConversation({...chat(lid),kind:'unknown'});
  const flow=new Workflow(store,'a',()=>1000);
  const manual=flow.manualSend(lid,{kind:'text',text:'Invented manual text',reason:'Fixture'},'physical-manual');
  const part=manual.components[0];assert.ok(part);
  store.saveOutbox({...manual,state:'unknown',components:[{...part,state:'unknown'}]});
  store.saveWaAlias('a',lid,phone);
  const before=new Map(store.conversations('a').map(c=>[c.id,c.workflowVersion]));
  const saved=store.outbox('a',manual.id);
  if(setting==='consent')flow.setModelConsent(true,'global-consent');
  else flow.setOwnerInstructions({requestId:'global-instructions',expectedRevision:0,text:'Invented preference.'});
  for(const c of store.conversations('a'))assert.equal(c.workflowVersion,(before.get(c.id)??0)+1,c.id);
  assert.deepEqual(store.outbox('a',manual.id),saved);
  assert.equal(flow.groupUnknown(phone),true);
  assert.equal(store.waCanonical('a',lid),phone);
 }finally{store.close();}
});
