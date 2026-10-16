import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat, message } from './fixtures.ts';

const phone='15550000001@s.whatsapp.net',lid='123@lid';
const action={kind:'text',text:'Invented owner text',reason:'Fixture'} as const;

test('read-local groups and last projections match standalone reads without changing physical work or policy', () => {
  const store=new SqliteStore();
  try {
    store.saveConversation(chat(phone));store.saveConversation({...chat(lid),kind:'unknown'});
    const flow=new Workflow(store,'a',()=>1000);
    const manual=flow.manualSend(lid,action,'physical-manual');
    const part=manual.components[0];assert.ok(part);
    store.saveOutbox({...manual,state:'unknown',components:[{...part,state:'unknown'}]});
    store.saveWaAlias('a',lid,phone);
    store.saveConversation({...chat(lid),kind:'unknown',mode:'draft_only',control:'manual',hours:{timezone:'invalid',start:0,end:0}});
    for(let i=0;i<6;i++) {
      const id='1555000000'+(i+2)+'@s.whatsapp.net';store.saveConversation(chat(id));
      const media=i===1 || i===2 ? {kind:'image' as const,access:'available' as const,viewOnce:i===1,expiresAt:i===2?500:null,fixture:null,description:'Invented'}:null;
      store.saveMessage({...message('source-'+i,id),media});
      if(i===3)store.saveWaMessage('a',id,'source-'+i,JSON.stringify({deleted:true}));
    }
    store.saveMessage({...message('physical-first',lid),transportId:'same-event',occurredAt:200});
    store.saveMessage({...message('physical-copy',phone),transportId:'same-event',occurredAt:200});
    store.saveMessage({...message('quoted',lid),occurredAt:1});
    store.saveMessage({...message('latest',phone),quotedMessageId:'wa:'+phone+':quoted',occurredAt:300});
    store.saveConversation(chat('empty-legacy'));
    store.saveConversation(chat('not-a-lid'));store.saveWaAlias('a','not-a-lid',phone);
    store.saveConversation({...chat('foreign'),accountId:'b'});
    // Exercise member fallback revisions as well as persisted group state.
    store['db'].prepare('DELETE FROM history_group_state WHERE account_id=? AND conversation_id=?').run('a',phone);
    const physical=flow.snapshot();
    const assertEquivalent=()=>{
      const read=store.historyRead('a');
      for(const c of store.conversations('a')) {
        assert.deepEqual(store.historyGroup('a',c.id,read),store.historyGroup('a',c.id));
        assert.deepEqual(flow.effectiveConversation(c.id,read),flow.effectiveConversation(c.id));
      }
      assert.deepEqual(store.lastMessages('a',1000,read),store.lastMessages('a',1000));
      assert.deepEqual(store.historyVersions('a',read),store.historyVersions('a'));
      assert.deepEqual(store.unreadCounts('a',read),store.unreadCounts('a'));
      const legacy=store.conversations('a').filter(c=>store.historyGroup('a',c.id).id===c.id).map(c=>{
        const effective=flow.effectiveConversation(c.id);
        return flow.groupUnknown(c.id)?{...effective,control:'manual' as const}:effective;
      });
      assert.deepEqual(flow.effectiveConversations(read),legacy);
      assert.throws(()=>store.historyGroup('b',phone,read),/record_scope_conflict/);
      assert.equal(read.conversations.has('foreign'),false);
      return store.lastMessages('a',1000,read);
    };
    const last=assertEquivalent();
    assert.equal(last.find(m=>m.id==='source-1')?.text,'[Source unavailable]');
    assert.equal(last.find(m=>m.id==='source-2')?.media,null);
    assert.equal(last.find(m=>m.id==='source-3')?.text,'[Message deleted]');
    assert.equal(last.find(m=>m.id==='latest')?.quotedMessageId,'quoted');
    assert.deepEqual(flow.snapshot(),physical,'read projection must not mutate manual or unknown work');
    store.saveMessage({...message('physical-copy',phone),transportId:'same-event',text:'Conflicting copy',occurredAt:400});
    assertEquivalent();
    store.saveConversation({...flow.conversation(lid),excluded:true,mode:'never_reply'});
    assert.equal(flow.effectiveConversations().find(c=>c.id===phone)?.excluded,true);
    assertEquivalent();
    assert.equal(store.outbox('a',manual.id)?.conversationId,lid);
    assert.equal(store.outbox('a',manual.id)?.components[0]?.state,'unknown');
    assert.throws(()=>flow.manualSend(lid,action,'fresh-retired'),/retired_alias_read_only/);
    assert.throws(()=>flow.quickControl(phone,'resume','restricted'),/alias_policy_restricted/);
  } finally {store.close();}
});
