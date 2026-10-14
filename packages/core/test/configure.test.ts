import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat, message } from './fixtures.ts';
test('one confirmed configuration resumes a paused chat and creates a bounded grant', () => {
  const store = new SqliteStore(); store.saveConversation({ ...chat(),control:'manual' }); store.saveMessage(message());
  const flow = new Workflow(store,'a',()=>1000);
  try {
    assert.throws(()=>flow.propose('c1',{kind:'configure',mode:'auto_reply'},'bad'),/invalid_delegation/);
    const proposal = flow.propose('c1',{kind:'configure',mode:'auto_reply',maxUnits:5,expiresAt:100000},'propose');
    assert.equal(flow.conversation('c1').control,'manual'); assert.equal(store.grants('a').length,0);
    flow.confirm(proposal.id,proposal.payloadHash,'confirm');
    assert.equal(flow.conversation('c1').control,'assistant_allowed'); assert.equal(flow.conversation('c1').mode,'auto_reply');
    assert.equal(store.grants('a')[0]?.maxUnits,5);
    assert.throws(()=>flow.confirm(proposal.id,proposal.payloadHash,'again'),/confirmation_invalid/);
    flow.setModelConsent(true,'enable');
    const version = flow.conversation('c1').workflowVersion;
    flow.setModelConsent(true,'repeat'); assert.equal(flow.conversation('c1').workflowVersion,version);
    const off = flow.propose('c1',{kind:'configure',mode:'never_reply'},'off');
    flow.confirm(off.id,off.payloadHash,'confirm-off');
    assert.equal(flow.conversation('c1').mode,'never_reply');
    assert.ok(store.grants('a').every(g=>g.state !== 'active'));
  } finally { store.close(); }
});
