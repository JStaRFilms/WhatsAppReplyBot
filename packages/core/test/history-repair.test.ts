import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteStore, Workflow, automaticDecision, automaticTrigger, type Message } from '../src/index.ts';
import { HistoryPage } from '../src/api.ts';
import { chat, message } from './fixtures.ts';
const phone='15550000001@s.whatsapp.net', lid='15550000001@lid';
const action={kind:'text',text:'Synthetic reply',reason:'Synthetic'} as const;
function pair(store:SqliteStore){store.saveConversation(chat(phone));store.saveConversation({...chat(lid),kind:'unknown'});}
function row(id:string,conversationId=phone):Message{return {...message(id,conversationId),id:'wa:'+conversationId+':'+id,transportId:id};}

test('new exact mapping pauses atomically; normal canonical Resume resolves legacy kind without erasing member restrictions',()=>{
  const store=new SqliteStore();pair(store);const flow=new Workflow(store,'a',()=>1000);
  try{
    flow.observe(row('in',lid));const physical=store.message('a',row('in',lid).id);
    flow.verifyAlias(lid,phone);
    assert.equal(flow.effectiveConversation(phone).control,'manual');assert.equal(store.drafts('a').length,0);
    assert.deepEqual(store.message('a',row('in',lid).id),physical);
    assert.throws(()=>flow.quickControl(lid,'resume','retired'),/retired_alias_read_only/);
    flow.quickControl(phone,'resume','resume');
    const c=flow.effectiveConversation(phone);assert.equal(c.control,'assistant_allowed');assert.equal(c.kind,'direct');
    assert.equal(flow.conversation(lid).kind,'unknown');assert.equal(automaticDecision(c,flow.effectiveConversations(),'a',1000,'live',undefined),'draft');
    assert.equal(flow.createDraft(phone,action,flow.conversation(phone).workflowVersion,'draft').triggerMessageId,row('in',lid).id);
    store.saveConversation({...flow.conversation(lid),mode:'never_reply'});
    assert.throws(()=>flow.quickControl(phone,'resume','privacy'),/alias_policy_restricted/);
    assert.throws(()=>flow.propose(phone,{kind:'configure',mode:'auto_reply',maxUnits:2,expiresAt:2000},'relax'),/alias_policy_restricted/);
    assert.throws(()=>flow.context(phone),/ai_access_denied/);
    store.saveConversation({...flow.conversation(lid),mode:null,hours:{timezone:'invalid',start:1,end:2}});
    assert.throws(()=>flow.context(phone),/ai_access_denied/);
    store.saveConversation({...flow.conversation(lid),hours:null,pause:{until:null,indefinite:false,handover:false,composing:true,typingUntil:null,sending:false,catchUpMessageId:null}});
    assert.throws(()=>flow.quickControl(phone,'resume','held'),/composer_has_text/);
    assert.equal(flow.conversation(lid).pause?.composing,true);
  }finally{store.close();}
});

test('existing-mapping upgrade is once-only and preserves recorded manual identities, hashes, unknown units and pause state across reopen',()=>{
  const dir=mkdtempSync(join(tmpdir(),'otherme-synthetic-history-'));const path=join(dir,'test.sqlite');
  let store=new SqliteStore(path);pair(store);let flow=new Workflow(store,'a',()=>1000);
  try{
    const manual=flow.manualSend(lid,action,'recorded-manual');
    const c=flow.conversation(lid);store.saveConversation({...c,kind:'direct',control:'assistant_allowed',pause:null});
    store.saveMessage(row('in',lid));
    const d=flow.createDraft(lid,action,flow.conversation(lid).workflowVersion,'old-draft');
    const ai=flow.approve(d.id,1,'old-ai');
    const component=ai.components[0];assert.ok(component);
    store.saveOutbox({...ai,grantId:'old-grant',components:[{...component,id:'unknown',state:'unknown'},component]});
    store.saveGrant({id:'old-grant',accountId:'a',conversationId:lid,expiresAt:10000,maxUnits:10,successfulUnits:3,reservedUnits:2,state:'active'});
    store.saveWaAlias('a',lid,phone);
    // Simulate a baseline whose aliases predate the new projection migration.
    const namespace=store.mediaCacheId('a');const request=store.request('a','recorded-manual');
    store.close();store=new SqliteStore(path);
    // Reset only the synthetic migration marker in this disposable fixture.
    const db=new DatabaseSync(path);db.prepare('UPDATE account_settings SET history_projection_version=0').run();db.close();
    flow=new Workflow(store,'a',()=>1000);
    const recorded=store.outbox('a',manual.id);assert.deepEqual(recorded,manual);assert.deepEqual(store.request('a','recorded-manual'),request);
    assert.deepEqual(store.outbox('a',ai.id)?.components.map(p=>p.state),['unknown','cancelled']);
    assert.equal(store.grants('a')[0]?.reservedUnits,1);assert.equal(store.grants('a')[0]?.successfulUnits,3);
    assert.equal(store.mediaCacheId('a'),namespace);assert.equal(store.historyProjectionVersion('a'),1);
    assert.deepEqual(flow.manualSend(lid,action,'recorded-manual'),manual);
    assert.throws(()=>flow.manualSend(lid,action,'fresh-manual'),/retired_alias_read_only/);
    assert.throws(()=>flow.quickControl(phone,'resume','unknown-resume'),/delivery_unknown/);
    const version=store.historyGroup('a',phone);store.close();store=new SqliteStore(path);flow=new Workflow(store,'a',()=>1000);
    assert.deepEqual(store.historyGroup('a',phone),version);assert.deepEqual(store.outbox('a',manual.id),recorded);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});


test('equivalent copies keep the earliest physical representative; conflicts, view-once, earliest expiry and raw-only tombstones fail closed',()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);
  try{
    const first=row('event',lid),copy=row('event');store.saveMessage(first);store.saveMessage(copy);
    assert.deepEqual(store.historyPage('a',phone).messages.map(m=>m.id),[first.id]);
    assert.equal(store.historySource('a',phone,copy.id)?.messageId,first.id);
    assert.equal(store.unreadCounts('a')[phone],1);
    store.markViewedMessages('a',phone,[copy.id,copy.id]);assert.equal(store.unreadCounts('a')[phone],undefined);
    store.saveMessage({...copy,text:'Conflicting'});assert.equal(store.historySource('a',phone,first.id)?.state,'conflict');
    assert.deepEqual(store.historyPage('a',phone).unavailableSourceIds,[first.id]);
    assert.equal(store.contextMessages('a',phone).messages.length,0);
    store.saveMessage({...copy,media:{kind:'image',access:'available',viewOnce:true,expiresAt:null,fixture:null,description:'Synthetic'}});
    assert.equal(store.historySource('a',phone,first.id)?.state,'view_once');
    store.saveWaMessage('a',phone,'event',JSON.stringify({deleted:true}));assert.equal(store.historySource('a',phone,first.id)?.state,'deleted');
    const e=row('exp',lid);store.saveMessage({...e,media:{kind:'image',access:'available',viewOnce:false,expiresAt:500,fixture:null,description:'Synthetic'}});
    store.saveMessage({...row('exp'),media:{kind:'image',access:'available',viewOnce:false,expiresAt:2000,fixture:null,description:'Synthetic'}});
    assert.equal(store.historySource('a',phone,e.id,1000)?.state,'expired');
    assert.equal(store.historySource('b',phone,e.id),undefined);
    assert.equal(store.historySource('a',phone,'wa:other@lid:event'),undefined);
    assert.equal(store.historySource('a',phone,'suffix-event'),undefined);
  }finally{store.close();}
});

test('verified duplicate arrival classes retain content and physical provenance without treating unknown provenance as verified',()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);
  try{
    const first={...row('arrival',lid),source:'live' as const};
    const replay={...row('arrival'),source:'replay' as const};
    store.saveMessage(first);store.saveMessage(replay);
    assert.equal(store.historySource('a',phone,first.id)?.state,'available');
    assert.deepEqual(store.historyPage('a',phone).messages.map(m=>m.id),[first.id]);
    assert.equal(store.contextMessages('a',phone).messages[0]?.text,first.text);
    assert.equal(store.unreadCounts('a')[phone],1);
    assert.equal(store.message('a',first.id)?.source,'live');
    assert.equal(store.message('a',replay.id)?.source,'replay');
    store.saveMessage({...replay,source:'backfill'});
    assert.equal(store.historySource('a',phone,first.id)?.state,'available');
    assert.equal(store.unreadCounts('a')[phone],1);
    store.markViewedMessages('a',phone,[replay.id]);
    assert.equal(store.unreadCounts('a')[phone],undefined);
    store.saveMessage({...replay,source:'unknown'});
    assert.equal(store.historySource('a',phone,first.id)?.state,'conflict');
  }finally{store.close();}
});

test('stored keyset paging handles 151 tied rows, real anchors, both directions, late backfill, exact views, receipt revisions and source invalidation',()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);
  try{
    for(let i=0;i<151;i++)store.saveMessage({...row(String(i).padStart(3,'0'),i%2?lid:phone),occurredAt:Math.floor(i/3)});
    const first=HistoryPage.parse(store.historyPage('a',phone));assert.equal(first.messages.length,50);assert.equal(first.hasOlder,true);assert.equal(first.hasNewer,false);
    assert.ok(first.beforeCursor);const older=store.historyPage('a',phone,{before:first.beforeCursor});assert.equal(older.messages.length,50);
    assert.equal(new Set([...older.messages,...first.messages].map(m=>m.id)).size,100);
    assert.ok(older.afterCursor);assert.deepEqual(store.historyPage('a',phone,{after:older.afterCursor}).messages,first.messages);
    const old=store.historyPage('a',phone,{around:row('010').id});assert.ok(old.messages.some(m=>m.transportId==='010'));assert.ok(old.messages.length<=50);
    const bottom=old.messages.at(-1);assert.ok(bottom);store.markViewedMessages('a',phone,[bottom.id]);assert.equal(store.unreadCounts('a')[phone],150);
    const watermark=store.historyWatermark('a',phone,old.messages.map(m=>m.id));
    store.markViewedPosition('a',phone,watermark);assert.ok((store.unreadCounts('a')[phone] ?? 0)>70);
    const epoch=first.sourceEpoch;store.saveMessage({...row('late'),occurredAt:-1,source:'backfill'});
    assert.equal(store.historyGroup('a',phone).sourceEpoch,epoch);
    const fenced=store.historyPage('a',phone,{before:first.beforeCursor});assert.equal(fenced.messages.some(m=>m.transportId==='late'),false);assert.equal(fenced.hasNewer,true);
    const other={...chat('different'),accountId:'b'};store.saveConversation(other);
    assert.throws(()=>store.historyPage('b','different',{before:first.beforeCursor ?? ''}),/invalid_history_cursor/);
    assert.throws(()=>store.historyPage('a',phone,{before:'x'.repeat(2049)}),/invalid_history_cursor/);
    assert.throws(()=>store.historyPage('a',phone,{before:first.beforeCursor ?? '',around:bottom.id}),/invalid_history_page/);
    store.saveMessage({...row('000'),text:'changed'});
    assert.throws(()=>store.historyPage('a',phone,{before:first.beforeCursor ?? ''}),/history_cursor_stale/);
    assert.ok(store.historyPage('a',phone,{around:row('010').id}).messages.some(m=>m.transportId==='010'));
  }finally{store.close();}
});

test('partial and legacy blank recovery preserves identity, ordering, provenance and pauses without unread, takeover, catch-up or repeat writes',()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);const flow=new Workflow(store,'a',()=>1000);
  try{
    const partial={...row('blank',lid),text:'',contentState:'partial' as const};flow.observe(partial);
    assert.equal(automaticTrigger(partial),false);assert.equal(store.unreadCounts('a')[phone],undefined);
    const c=flow.conversation(phone);store.saveConversation({...c,pause:{until:null,indefinite:false,handover:false,composing:false,typingUntil:null,sending:false,catchUpMessageId:partial.id}});
    const control=flow.conversation(phone).control;const sourceEpoch=store.historyGroup('a',phone).sourceEpoch;
    assert.equal(flow.recoverMessage(phone,{...partial,text:'Recovered supported text',contentState:'complete'},JSON.stringify({protobuf:'synthetic'})),true);
    const saved=store.message('a',partial.id);assert.ok(saved);assert.equal(saved.contentRecovered,true);assert.equal(saved.id,partial.id);assert.equal(saved.source,partial.source);assert.equal(saved.occurredAt,partial.occurredAt);assert.equal(saved.conversationId,lid);
    assert.equal(flow.conversation(phone).control,control);assert.equal(flow.conversation(phone).pause?.catchUpMessageId,null);assert.equal(store.unreadCounts('a')[phone],undefined);assert.equal(automaticTrigger(saved),false);
    assert.ok(store.historyGroup('a',phone).sourceEpoch>sourceEpoch);const revision=store.historyGroup('a',phone).revision;
    assert.equal(flow.recoverMessage(phone,{...partial,text:'Repeated',contentState:'complete'}),false);assert.equal(store.historyGroup('a',phone).revision,revision);
    const legacy={...row('legacy',lid),text:''};store.saveMessage(legacy);assert.equal(flow.recoverMessage(phone,{...legacy,text:'Legacy full'}),true);
    const deleted={...row('deleted',lid),text:'',contentState:'partial' as const};store.saveMessage(deleted);store.saveWaMessage('a',phone,'deleted',JSON.stringify({deleted:true}));
    assert.equal(flow.recoverMessage(phone,{...deleted,text:'No resurrection',contentState:'complete'}),false);
    assert.equal(store.messages('a',lid).length,3);assert.equal(store.outboxes('a').length,0);assert.equal(store.drafts('a').length,0);
  }finally{store.close();}
});

test('bounded model transcript includes real old quote evidence and queries owner examples independently of an inbound-only tail',()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);const flow=new Workflow(store,'a',()=>1000);
  try{
    const quote={...row('quote',lid),occurredAt:1};store.saveMessage(quote);
    store.saveMessage({...row('style'),direction:'outbound',authorship:'owner_written',text:'My synthetic style',occurredAt:2});
    for(let i=0;i<40;i++)store.saveMessage({...row('in-'+i,lid),occurredAt:10+i,
      quotedMessageId:i===39 ? 'wa:'+phone+':quote':null});
    const context=flow.context(phone);assert.ok(context.messages.length<=20);assert.ok(context.messages.some(m=>m.id===quote.id));assert.deepEqual(context.styleExamples,['My synthetic style']);
    assert.equal(context.messages.at(-1)?.quotedMessageId,quote.id);assert.equal(context.messages.at(-1)?.conversationId,lid);
    assert.ok(context.worstCaseTextTokens<=8000);
  }finally{store.close();}
});

test('member draft-only policy blocks automatic sends and a source-only change cancels queued AI without revoking its grant or unknown unit',async()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);const flow=new Workflow(store,'a',()=>1000);
  try{
    store.saveConversation({...flow.conversation(phone),mode:'auto_reply'});store.saveConversation({...flow.conversation(lid),mode:'draft_only'});
    store.saveMessage(row('trigger',lid));store.saveGrant({id:'grant',accountId:'a',conversationId:phone,expiresAt:5000,maxUnits:5,reservedUnits:0,successfulUnits:1,state:'active'});
    const draft=flow.createDraft(phone,action,flow.conversation(phone).workflowVersion,'draft');
    assert.throws(()=>flow.autoSend(draft.id,'not-auto'),/autonomy_denied/);
    const approved=flow.approve(draft.id,1,'owner-approval');const component=approved.components[0];assert.ok(component);
    store.saveOutbox({...approved,id:'uncertain',requestId:'uncertain',state:'unknown',components:[{...component,id:'uncertain-part',state:'unknown'}]});
    const grant=store.grants('a')[0];assert.ok(grant);store.saveGrant({...grant,reservedUnits:2});
    flow.restrictSource(phone,'trigger','conflict');assert.equal(store.grants('a')[0]?.reservedUnits,1);assert.equal(store.grants('a')[0]?.state,'active');
    assert.equal(store.outbox('a','uncertain')?.components[0]?.state,'unknown');assert.equal(store.outbox('a',approved.id)?.state,'cancelled');
    let sends=0;await flow.dispatch(approved.id,async()=>{sends++;return {state:'accepted',transportId:'never'};});assert.equal(sends,0);
    assert.equal(store.grants('a')[0]?.reservedUnits,1);assert.equal(store.grants('a')[0]?.successfulUnits,1);
  }finally{store.close();}
});

test('verified equivalent partial copies recover only the original representative and retain the other physical blank row',()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);const flow=new Workflow(store,'a',()=>1000);
  try{
    const first={...row('partial-copy',lid),text:'',contentState:'partial' as const},copy={...row('partial-copy'),text:'',contentState:'partial' as const};
    store.saveMessage(first);store.saveMessage(copy);
    assert.equal(flow.recoverMessage(phone,{...copy,text:'Verified full content',contentState:'complete'}),true);
    const source=store.historySource('a',phone,copy.id);assert.equal(source?.state,'available');assert.equal(source?.messageId,first.id);assert.equal(source?.message.text,'Verified full content');
    assert.equal(store.message('a',copy.id)?.text,'');assert.equal(store.message('a',copy.id)?.contentState,'partial');assert.equal(store.unreadCounts('a')[phone],undefined);
    assert.equal(store.historyPage('a',phone).messages.length,1);assert.equal(store.messages('a',lid).length,1);assert.equal(store.messages('a',phone).length,1);
    store.saveMessage({...copy,text:'Contradicting full record',contentState:'complete'});assert.equal(store.historySource('a',phone,first.id)?.state,'conflict');
  }finally{store.close();}
});

test('clearing catch-up bookkeeping does not stale the draft just created for that real source',()=>{
  const store=new SqliteStore();pair(store);store.saveWaAlias('a',lid,phone);const flow=new Workflow(store,'a',()=>1000);
  try{
    const m=row('catch-up',lid);store.saveMessage(m);flow.quickControl(phone,'resume','resume');
    assert.equal(flow.conversation(phone).pause?.catchUpMessageId,m.id);
    const draft=flow.createDraft(phone,action,flow.conversation(phone).workflowVersion,'draft');const epoch=store.historyGroup('a',phone).sourceEpoch;
    flow.finishCatchUp(phone,m.id);assert.equal(store.historyGroup('a',phone).sourceEpoch,epoch);assert.equal(flow.approve(draft.id,1,'approve').state,'queued');
  }finally{store.close();}
});

test('new mapping cancels retired-alias queued manual intent, not unrelated canonical owner work, and does not retain its cancelled sending hold',async()=>{
  const store=new SqliteStore();pair(store);const flow=new Workflow(store,'a',()=>1000);
  try{
    const safe=flow.manualSend(phone,action,'safe'),retired=flow.manualSend(lid,action,'retired');flow.verifyAlias(lid,phone);
    assert.equal(store.outbox('a',safe.id)?.state,'queued');assert.equal(store.outbox('a',retired.id)?.state,'cancelled');assert.equal(flow.conversation(lid).pause?.sending,false);
    await flow.dispatch(safe.id,async()=>({state:'accepted',transportId:'safe-send'}));
    flow.quickControl(phone,'resume','resume');assert.equal(flow.effectiveConversation(phone).control,'assistant_allowed');
    assert.deepEqual(flow.manualSend(lid,action,'retired'),retired);let sends=0;await flow.dispatch(retired.id,async()=>{sends++;return {state:'accepted',transportId:'never'};});assert.equal(sends,0);
  }finally{store.close();}
});
