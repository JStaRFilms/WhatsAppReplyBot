import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '../src/store.ts';
import { Workflow, type TransportResult } from '../src/workflow.ts';
import type { Action } from '../src/contracts.ts';
import { chat, message } from './fixtures.ts';

const text: Action = { kind: 'text', text: 'yeah bro', reason: 'demo' };
function setup(mode: 'auto_reply' | 'draft_only' | 'never_reply' = 'draft_only', path = ':memory:') {
  const store = new SqliteStore(path);
  store.saveConversation({ ...chat(), mode });
  store.saveMessage(message());
  let now = 1000;
  return { store, flow: new Workflow(store, 'a', () => now), advance: (value: number) => { now = value; } };
}
function delegate(flow: Workflow, maxUnits = 20) {
  const p = flow.propose('c1', { kind: 'delegate', maxUnits, expiresAt: 100000 }, 'propose-grant');
  flow.confirm(p.id, p.payloadHash, 'confirm-grant');
}
function draft(flow: Workflow, action = text, requestId = 'draft') {
  return flow.createDraft('c1', action, flow.conversation('c1').workflowVersion, requestId);
}
test('duplicate approval is one outbox; conflicting request reuse rejects', () => {
  const { store, flow } = setup();
  const d = draft(flow);
  const one = flow.approve(d.id, 1, 'approve');
  assert.equal(flow.approve(d.id, 1, 'approve').id, one.id);
  assert.equal(store.outboxes('a').length, 1);
  assert.throws(() => flow.manualSend('c1', text, 'approve'), /request_id_conflict/);
  store.close();
});
test('new inbound content invalidates generation and approval', () => {
  const { store, flow } = setup(); const d = draft(flow); const version = d.workflowVersion;
  flow.observe({ ...message('m2'), occurredAt: 200 });
  assert.throws(() => flow.approve(d.id, 1, 'stale'), /stale_draft/);
  assert.throws(() => flow.createDraft('c1', text, version, 'late-model'), /stale_workflow/);
  assert.equal(store.draft('a', d.id)?.state, 'stale'); store.close();
});
test('never-reply prevents AI but authenticated manual messaging stays possible', async () => {
  const { store, flow } = setup('never_reply');
  assert.throws(() => draft(flow), /ai_access_denied/);
  const out = flow.manualSend('c1', text, 'manual');
  const accepted = await flow.dispatch(out.id, async () => ({ state: 'accepted', transportId: 'demo-owner' }));
  assert.equal(accepted.state, 'accepted');
  assert.equal(flow.conversation('c1').control, 'manual');
  assert.equal(store.messages('a', 'c1').at(-1)?.authorship, 'owner_written'); store.close();
});
test('pause before handoff cancels queued work; inbound and restart do not resume', async () => {
  const { store, flow } = setup(); const d = draft(flow); const q = flow.approve(d.id, 1, 'approve');
  flow.pause('c1', 'pause');
  let calls = 0; const result = await flow.dispatch(q.id, async () => { calls++; return { state: 'accepted', transportId: 'never' }; });
  assert.equal(calls, 0); assert.equal(result.state, 'cancelled');
  flow.observe(message('new')); flow.recover();
  assert.equal(flow.conversation('c1').control, 'manual'); store.close();
});
test('owner takeover during handoff records acceptance, never false cancellation', async () => {
  const { store, flow } = setup(); const d = draft(flow); const q = flow.approve(d.id, 1, 'approve');
  const result = await flow.dispatch(q.id, async () => {
    flow.pause('c1', 'pause-during'); return { state: 'accepted', transportId: 'in-flight' };
  });
  assert.equal(result.state, 'accepted'); assert.equal(flow.conversation('c1').control, 'manual'); store.close();
});
test('bounded grants count reactions and deny bundles when one unit remains', async () => {
  const { store, flow } = setup('auto_reply'); delegate(flow, 1);
  const both: Action = { kind: 'reaction_plus_text', text: 'lol', reason: 'demo', reaction: { targetMessageId: 'm1', emoji: '😂' } };
  const d = draft(flow, both);
  assert.throws(() => flow.autoSend(d.id, 'too-many'), /grant_limit/);
  assert.equal(store.grants('a')[0]?.reservedUnits, 0);
  const single = draft(flow, { kind: 'reaction', reaction: both.reaction, reason: 'demo' }, 'single');
  const q = flow.autoSend(single.id, 'auto');
  await flow.dispatch(q.id, async () => ({ state: 'accepted', transportId: 'react' }));
  assert.equal(store.grants('a')[0]?.successfulUnits, 1); assert.equal(store.grants('a')[0]?.reservedUnits, 0);
  assert.equal(store.messages('a', 'c1')[0]?.reaction, '😂'); store.close();
});
test('partial unknown delivery preserves exactly its reservation and does not retry', async () => {
  const { store, flow } = setup('auto_reply'); delegate(flow, 2);
  const both: Action = { kind: 'reaction_plus_text', text: 'lol', reason: 'demo', reaction: { targetMessageId: 'm1', emoji: '😂' } };
  const d = draft(flow, both); const q = flow.autoSend(d.id, 'auto');
  let calls = 0;
  const result = await flow.dispatch(q.id, async () => ++calls === 1 ? { state: 'accepted', transportId: 'reaction' } : { state: 'unknown' });
  assert.equal(result.state, 'partial'); assert.equal(calls, 2);
  assert.equal(store.grants('a')[0]?.successfulUnits, 1); assert.equal(store.grants('a')[0]?.reservedUnits, 1);
  await flow.dispatch(q.id, async () => { calls++; return { state: 'accepted', transportId: 'bad' }; });
  assert.equal(calls, 2); store.close();
});
test('dispatch serialization stops a second stale approval in the same chat', async () => {
  const { store, flow } = setup();
  const d1 = draft(flow, text, 'draft1'); const d2 = draft(flow, text, 'draft2');
  const q1 = flow.approve(d1.id, 1, 'approve1'); const q2 = flow.approve(d2.id, 1, 'approve2');
  let calls = 0;
  const handoff = async (): Promise<TransportResult> => ({ state: 'accepted', transportId: 'sent-'+(++calls) });
  const results = await Promise.all([flow.dispatch(q1.id, handoff), flow.dispatch(q2.id, handoff)]);
  assert.equal(calls, 1); assert.equal(results[1]?.state, 'cancelled'); store.close();
});
test('restart keeps manual control and converts dispatch intent to unknown', () => {
  const dir = mkdtempSync(join(tmpdir(), 'replybot-')); const path = join(dir, 'db.sqlite');
  try {
    const { store, flow } = setup('auto_reply', path); delegate(flow, 2);
    const d = draft(flow); const q = flow.autoSend(d.id, 'auto');
    const part = q.components[0]; assert.ok(part);
    part.state = 'dispatching'; q.state = 'dispatching'; store.saveOutbox(q);
    flow.pause('c1', 'pause'); store.close();
    const reopened = new SqliteStore(path); const restored = new Workflow(reopened, 'a', () => 1100); restored.recover();
    assert.equal(restored.conversation('c1').control, 'manual');
    assert.equal(reopened.outbox('a', q.id)?.components[0]?.state, 'unknown');
    assert.equal(reopened.grants('a')[0]?.reservedUnits, 1); reopened.close();
  } finally { rmSync(dir, { recursive: true }); }
});
test('confirmation checks hash, expiry, version and one-use semantics', () => {
  const { store, flow, advance } = setup();
  const p = flow.propose('c1', { kind: 'change_mode', mode: 'auto_reply' }, 'proposal');
  assert.throws(() => flow.confirm(p.id, 'wrong', 'wrong-confirm'), /confirmation_invalid/);
  advance(400000); assert.throws(() => flow.confirm(p.id, p.payloadHash, 'expired'), /confirmation_expired/);
  store.close();
});
test('resume does not revive grants or stale drafts; quotes cannot cross chat boundaries', () => {
  const { store, flow } = setup('auto_reply'); delegate(flow);
  flow.pause('c1', 'pause'); const p = flow.propose('c1', { kind: 'resume' }, 'resume-proposal'); flow.confirm(p.id, p.payloadHash, 'resume');
  assert.equal(flow.conversation('c1').control, 'assistant_allowed'); assert.equal(store.grants('a')[0]?.state, 'revoked');
  assert.throws(() => flow.manualSend('c1', text, 'badquote', 'foreign-message'), /invalid_quote/);
  assert.equal(flow.conversation('c1').control, 'assistant_allowed'); store.close();
});
test('known assistant echo does not trigger takeover; unknown outgoing does', async () => {
  const { store, flow } = setup(); const d = draft(flow); const q = flow.approve(d.id, 1, 'approve');
  await flow.dispatch(q.id, async () => ({ state: 'accepted', transportId: 'known' }));
  assert.equal(flow.observe({ ...message('echo'), direction: 'outbound', transportId: 'known' }), false);
  assert.equal(flow.conversation('c1').control, 'assistant_allowed');
  flow.observe({ ...message('unknown'), direction: 'outbound', authorship: 'owner_written' });
  assert.equal(flow.conversation('c1').control, 'manual');
  assert.equal(store.messages('a', 'c1').at(-1)?.authorship, 'unknown'); store.close();
});
test('record upserts cannot change the account or conversation of an existing ID', () => {
  const { store } = setup();
  assert.throws(() => store.saveConversation({ ...chat(), accountId: 'b' }), /record_scope_conflict/);
  assert.equal(store.conversation('a', 'c1')?.accountId, 'a');
  store.saveConversation(chat('c2'));
  assert.throws(() => store.saveMessage({ ...message(), conversationId: 'c2' }), /record_scope_conflict/);
  assert.equal(store.messages('a', 'c2').length, 0); store.close();
});
test('expired autonomy allows a fresh one-shot approval without reviving the grant', () => {
  const { store, flow, advance } = setup('auto_reply'); delegate(flow, 1); advance(101000);
  const d = draft(flow); const q = flow.approve(d.id, 1, 'one-shot');
  assert.equal(q.grantId, null); assert.equal(store.grants('a')[0]?.state, 'ended'); store.close();
});
test('queued work cannot pass an earlier unknown handoff in the same chat', async () => {
  const { store, flow } = setup('auto_reply'); delegate(flow, 2);
  const d1 = draft(flow, text, 'd1'); const d2 = draft(flow, text, 'd2');
  const q1 = flow.autoSend(d1.id, 'q1'); const q2 = flow.autoSend(d2.id, 'q2');
  let calls = 0; const handoff = async (): Promise<TransportResult> => { calls++; return { state: 'unknown' }; };
  const results = await Promise.all([flow.dispatch(q1.id, handoff), flow.dispatch(q2.id, handoff)]);
  assert.equal(calls, 1); assert.equal(results[1]?.state, 'cancelled');
  assert.equal(store.grants('a')[0]?.reservedUnits, 1); store.close();
});
test('edited drafts reject old revisions and keep edited-assistant provenance', async () => {
  const { store, flow } = setup(); const d = draft(flow);
  const edited = flow.editDraft(d.id, { kind: 'text', text: 'eii yes', reason: 'owner edit' }, 1, 'edit');
  assert.throws(() => flow.approve(d.id, 1, 'old-revision'), /stale_draft/);
  const q = flow.approve(d.id, edited.revision, 'approve-edit');
  await flow.dispatch(q.id, async () => ({ state: 'accepted', transportId: 'edited' }));
  assert.equal(store.messages('a', 'c1').at(-1)?.authorship, 'owner_edited_assistant'); store.close();
});
