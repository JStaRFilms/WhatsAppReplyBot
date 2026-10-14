import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Action, OwnerAction, type OwnerImageAction, type Outbox, type ReactionObservation } from '../src/contracts.ts';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat, message } from './fixtures.ts';

const image = {mime:'image/jpeg' as const,width:2,height:3,bytes:Buffer.from('synthetic-normalized-image')};
const text = {kind:'text' as const,text:'reply',reason:'test',quotedMessageId:'m1'};
function setup(path = ':memory:') {
  const store = new SqliteStore(path);
  store.saveConversation({...chat(),mode:'draft_only'}); store.saveConversation(chat('c2'));
  store.saveMessage(message()); store.saveMessage(message('m2','c2'));
  return {store,flow:new Workflow(store,'a',() => 1000)};
}
function stage(flow: Workflow, requestId = 'upload'): OwnerImageAction {
  return {kind:'image',uploadId:flow.stageImage('c1',image,requestId).id,caption:'owner caption',reason:'owner selected image'};
}
test('uploads are scoped, bounded and request-idempotent; model Action cannot send images', () => {
  const {store,flow} = setup(); const action = stage(flow);
  assert.equal(OwnerAction.safeParse(action).success,true);
  assert.equal(Action.safeParse(action).success,false);
  assert.equal(flow.stageImage('c1',image,'upload').id,action.uploadId);
  assert.throws(() => flow.stageImage('c1',{...image,bytes:Buffer.from('different')},'upload'),/request_id_conflict/);
  assert.throws(() => flow.stageImage('c1',{...image,bytes:Buffer.alloc(10*1024*1024+1)},'large'),/image_too_large/);
  assert.equal(store.imageUpload('other-account','c1',action.uploadId),undefined);
  assert.equal(store.imageUpload('a','c2',action.uploadId),undefined);
  assert.throws(() => flow.manualSend('c2',action,'wrong-chat'),/upload_not_found/);
  assert.throws(() => flow.manualSend('c1',action,'bad-quote','m2'),/invalid_quote/);
  assert.throws(() => flow.createDraft('c1',Action.parse(action),1,'model-image'));
  store.close();
});
test('accepted owner image is one caption component, resolves handover and starts cooldown', async () => {
  const {store,flow} = setup();
  const handover = flow.createDraft('c1',{kind:'handover',reason:'owner needed'},1,'handover');
  const action = {...stage(flow),caption:''}; const queued = flow.manualSend('c1',action,'send','m1');
  assert.equal(queued.components.length,1); assert.equal(queued.components[0]?.kind,'image'); assert.equal(queued.units,1);
  assert.equal(flow.manualSend('c1',action,'send','m1').id,queued.id);
  const result = await flow.dispatch(queued.id,async component => {
    assert.equal(component.uploadId,action.uploadId); return {state:'accepted',transportId:'owner-image'};
  });
  assert.equal(result.state,'accepted'); assert.equal(store.draft('a',handover.id)?.state,'resolved');
  const sent = store.messages('a','c1').at(-1);
  assert.equal(sent?.text,''); assert.equal(sent?.quotedMessageId,'m1'); assert.equal(sent?.authorship,'owner_written');
  assert.equal(sent?.media?.kind,'image'); assert.equal(sent?.media?.mime,'image/jpeg'); assert.equal(sent?.media?.width,2);
  assert.equal(flow.conversation('c1').pause?.until,301000); assert.equal(flow.conversation('c1').pause?.sending,false);
  store.close();
});
test('unknown image bytes survive restart and cleanup; uncertain handoff never retries', async () => {
  const dir = mkdtempSync(join(tmpdir(),'replybot-image-'));
  try {
    const path = join(dir,'db.sqlite'); const initial = setup(path); const action = stage(initial.flow);
    const queued = initial.flow.manualSend('c1',action,'send');
    let calls = 0;
    const unknown = await initial.flow.dispatch(queued.id,async () => {calls++;return {state:'unknown'};});
    assert.equal(unknown.state,'unknown'); initial.store.close();
    const store = new SqliteStore(path); const flow = new Workflow(store,'a',() => 5000000); flow.recover();
    store.cleanupImageUploads('a',5000000);
    assert.deepEqual(Buffer.from(store.imageUpload('a','c1',action.uploadId)?.bytes ?? []),image.bytes);
    assert.equal(flow.manualSend('c1',action,'send').id,queued.id);
    await flow.dispatch(queued.id,async () => {calls++;return {state:'accepted',transportId:'must-not-send'};});
    assert.equal(calls,1); assert.equal(flow.conversation('c1').pause?.sending,true); store.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('cleanup keeps queued, dispatching, unknown and partial outboxes, not unreferenced bytes', () => {
  const {store,flow} = setup();
  for (const state of ['queued','dispatching','unknown','partial'] as const) {
    const action = stage(flow,'upload-'+state); const out = flow.manualSend('c1',action,'send-'+state);
    const componentState = state === 'partial' ? 'accepted' : state;
    store.saveOutbox({...out,state,components:out.components.map(p => ({...p,state:componentState}))});
    store.cleanupImageUploads('a',1001);
    assert.ok(store.imageUpload('a','c1',action.uploadId),state);
  }
  const orphan = stage(flow,'orphan'); store.cleanupImageUploads('a',1001);
  assert.equal(store.imageUpload('a','c1',orphan.uploadId),undefined); store.close();
});
test('AI quotes validate within the chat and reach approval and automatic transport', () => {
  const {store,flow} = setup();
  assert.throws(() => flow.createDraft('c1',{...text,quotedMessageId:'m2'},1,'wrong'),/invalid_quote/);
  const draft = flow.createDraft('c1',text,1,'draft');
  assert.equal(flow.approve(draft.id,1,'approve').quotedMessageId,'m1');
  assert.throws(() => flow.manualSend('c1',text,'conflict','m2'),/quote_conflict/);
  const current = flow.conversation('c1'); store.saveConversation({...current,mode:'auto_reply'});
  const proposal = flow.propose('c1',{kind:'delegate',maxUnits:2,expiresAt:100000},'grant'); flow.confirm(proposal.id,proposal.payloadHash,'grant-confirm');
  const both = flow.createDraft('c1',{kind:'reaction_plus_text',text:'yes',reason:'test',quotedMessageId:'m1',reaction:{targetMessageId:'m1',emoji:'👍'}},flow.conversation('c1').workflowVersion,'both');
  const auto = flow.autoSend(both.id,'auto'); assert.equal(auto.quotedMessageId,'m1'); assert.equal(store.grants('a')[0]?.reservedUnits,2);
  store.close();
});
const contact: ReactionObservation = {actor:'contact',actorId:'contact-c1',transportId:'reactor-id',emoji:'❤️',occurredAt:1000,source:'live'};
test('contact reactions stale in-flight work without takeover; removals only replace that actor', () => {
  const {store,flow} = setup(); const draft = flow.createDraft('c1',text,1,'draft');
  assert.equal(flow.observeReaction('c1','m1',contact),true);
  assert.equal(flow.conversation('c1').control,'assistant_allowed'); assert.equal(flow.conversation('c1').pause?.until,null);
  assert.equal(store.draft('a',draft.id)?.state,'stale'); assert.throws(() => flow.approve(draft.id,1,'approve'),/stale_draft/);
  const version = flow.conversation('c1').workflowVersion; assert.equal(flow.observeReaction('c1','m1',contact),false);
  assert.equal(flow.conversation('c1').workflowVersion,version);
  flow.observeReaction('c1','m1',{...contact,actorId:'second-contact',transportId:'second',emoji:'👍',occurredAt:1001});
  flow.observeReaction('c1','m1',{...contact,transportId:'removed',emoji:null,occurredAt:1002});
  assert.deepEqual(store.message('a','m1')?.observedReactions?.map(r => [r.actorId,r.emoji]),[['second-contact','👍'],['contact-c1',null]]);
  assert.throws(() => flow.observeReaction('c2','m1',contact),/invalid_reaction_target/); store.close();
});
test('verified live owner reactions hold and cool down; historical reactions never pause', () => {
  const {store,flow} = setup();
  for (const source of ['backfill','replay','unknown'] as const) {
    flow.observeReaction('c1','m1',{...contact,source,transportId:source,actor:'unknown',actorId:'owner',occurredAt:1000},true);
    assert.equal(flow.conversation('c1').control,'assistant_allowed'); assert.equal(flow.conversation('c1').workflowVersion,1);
  }
  flow.observeReaction('c1','m1',{...contact,actor:'unknown',actorId:'owner'},true);
  assert.equal(flow.conversation('c1').control,'manual'); assert.equal(flow.conversation('c1').pause?.until,301000);
  assert.equal(store.message('a','m1')?.observedReactions?.[0]?.actor,'owner'); store.close();
});
test('assistant outbox identity wins over fromMe; app reactions also record actor observations', async () => {
  const {store,flow} = setup();
  const action = {kind:'reaction' as const,reaction:{targetMessageId:'m1',emoji:'👍' as const},reason:'test'};
  const draft = flow.createDraft('c1',action,1,'draft'); const queued = flow.approve(draft.id,1,'approve');
  await flow.dispatch(queued.id,async component => {
    const current: Outbox = store.outbox('a',queued.id) ?? queued;
    store.saveOutbox({...current,components:current.components.map(p => p.id === component.id ? {...p,transportId:'assistant-reaction'} : p)});
    flow.observeReaction('c1','m1',{...contact,transportId:'assistant-reaction',actor:'unknown',actorId:'owner'},true);
    assert.equal(flow.conversation('c1').control,'assistant_allowed');
    assert.equal(store.message('a','m1')?.observedReactions?.[0]?.actor,'assistant');
    return {state:'accepted',transportId:'assistant-reaction'};
  });
  const owner = flow.manualSend('c1',action,'owner-reaction');
  await flow.dispatch(owner.id,async () => ({state:'accepted',transportId:'app-owner-reaction'}));
  assert.deepEqual(store.message('a','m1')?.observedReactions?.map(r => r.actor),['owner']); store.close();
});
test('late AI reaction completion preserves a newer owner reaction',async()=>{
  const {store,flow}=setup();
  const action={kind:'reaction' as const,reaction:{targetMessageId:'m1',emoji:'👍' as const},reason:'test'};
  const draft=flow.createDraft('c1',action,1,'draft');const queued=flow.approve(draft.id,1,'approve');
  try{
    await flow.dispatch(queued.id,async()=>{
      flow.observeReaction('c1','m1',{...contact,actor:'unknown',actorId:'owner',transportId:'newer-owner',emoji:'❤️',occurredAt:1000},true);
      return {state:'accepted',transportId:'older-ai'};
    });
    assert.equal(store.message('a','m1')?.reaction,'❤️');assert.deepEqual(store.message('a','m1')?.observedReactions?.map(r=>r.actor),['owner']);
  }finally{store.close();}
});
test('legacy emoji does not acquire a fabricated actor', () => {
  const {store} = setup(); store.saveMessage({...message(),reaction:'👍'});
  assert.equal(store.message('a','m1')?.observedReactions,undefined); store.close();
});
