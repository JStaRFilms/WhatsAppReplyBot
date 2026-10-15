import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat, message } from './fixtures.ts';

function setup() {
  const store = new SqliteStore(); const flow = new Workflow(store, 'a', () => 1000);
  store.saveConversation({ ...chat(), mode: 'auto_reply' }); store.saveMessage(message());
  store.saveModelConsent('a', true);
  const proposal = flow.propose('c1', { kind: 'delegate', maxUnits: 10, expiresAt: 100000 }, 'grant');
  flow.confirm(proposal.id, proposal.payloadHash, 'confirmed');
  return { store, flow };
}

test('profile suspension cancels all queued origins, preserves accepted/unknown accounting and unresolved handovers', async () => {
  const { store, flow } = setup();
  try {
    const draft = flow.createDraft('c1', { kind: 'text_sequence', messages: [{ text: 'one' }, { text: 'two' }, { text: 'three' }], reason: 'Synthetic' }, flow.conversation('c1').workflowVersion, 'draft');
    const ai = flow.autoSend(draft.id, 'ai');
    const saved = store.outbox('a', ai.id); assert.ok(saved);
    const [first, second] = saved.components; assert.ok(first); assert.ok(second);
    first.state = 'accepted'; first.transportId = 'accepted-synthetic'; second.state = 'unknown'; saved.state = 'partial';
    store.saveOutbox(saved);
    const grant = store.grants('a')[0]; assert.ok(grant);
    store.saveGrant({ ...grant, reservedUnits: 2, successfulUnits: 1 });
    const pending = flow.createDraft('c1', { kind: 'text', text: 'Pending', reason: 'Synthetic' }, flow.conversation('c1').workflowVersion, 'pending');
    store.saveDraft({ ...pending, id: 'unresolved', state: 'needs_owner' });
    store.saveConversation(chat('c2'));
    const manual = flow.manualSend('c2', { kind: 'text', text: 'Old manual', reason: 'Synthetic' }, 'manual');
    store.setComposer('a', 'c1', 'synthetic-client', true);
    const c = flow.conversation('c1');
    store.saveConversation({ ...c, pause: { until: 30000, indefinite: false, handover: true, composing: true, typingUntil: 9000, sending: true, catchUpMessageId: 'm1' } });
    flow.suspendAccount();
    assert.deepEqual(store.outbox('a', ai.id)?.components.map(p => p.state), ['accepted', 'unknown', 'cancelled']);
    assert.equal(store.outbox('a', manual.id)?.state, 'cancelled');
    assert.equal(store.grants('a')[0]?.reservedUnits, 1); assert.equal(store.grants('a')[0]?.successfulUnits, 1);
    assert.equal(store.draft('a', pending.id)?.state, 'stale'); assert.equal(store.draft('a', 'unresolved')?.state, 'needs_owner');
    assert.equal(store.modelConsent('a'), false); assert.equal(store.hasComposer('a', 'c1'), false);
    assert.deepEqual(flow.conversation('c1').pause, { until: null, indefinite: true, handover: true, composing: false, typingUntil: null, sending: false, catchUpMessageId: null });
    assert.deepEqual(flow.expirePauses(), []);
    let sends = 0; await flow.dispatch(manual.id, async () => { sends++; return { state: 'accepted', transportId: 'never' }; });
    assert.equal(sends, 0); assert.throws(() => flow.manualSend('c1', { kind: 'text', text: 'Late', reason: 'Synthetic' }, 'late'), /profile_transition_in_progress/);
    const restored = new Workflow(store, 'a', () => 1000); restored.recover(true); restored.suspendAccount(false);
    assert.equal(store.outbox('a', ai.id)?.components[1]?.state, 'unknown'); assert.equal(store.grants('a')[0]?.reservedUnits, 1);
    assert.equal(store.draft('a', 'unresolved')?.state, 'needs_owner');
  } finally { store.close(); }
});

test('executing handoff refuses suspension without misclassifying it or changing consent', async () => {
  const { store, flow } = setup(); let entered: () => void = () => {}; let complete: () => void = () => {};
  const started = new Promise<void>(resolve => { entered = resolve; }); const handoff = new Promise<void>(resolve => { complete = resolve; });
  const manual = flow.manualSend('c1', { kind: 'text', text: 'Synthetic', reason: 'Fixture' }, 'manual');
  const sending = flow.dispatch(manual.id, async () => { entered(); await handoff; return { state: 'unknown' }; });
  try {
    await started; assert.equal(flow.hasActiveHandoff(), true);
    assert.throws(() => flow.suspendAccount(), /profile_handoff_active/);
    assert.equal(store.modelConsent('a'), true); assert.equal(store.outbox('a', manual.id)?.state, 'dispatching');
    complete(); await sending; flow.suspendAccount();
    assert.equal(store.outbox('a', manual.id)?.state, 'unknown');
  } finally { complete(); await sending; store.close(); }
});
