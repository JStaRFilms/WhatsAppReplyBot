import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '@replybot/core';
import { ClientSnapshot, AssistantResponse } from '@replybot/core/api';
import { Draft, Proposal } from '@replybot/core/contracts';
import { createApp } from '../src/server.ts';

test('owner boundary and complete demo approval/confirmation flow', async () => {
  const app = createApp({ store: new SqliteStore(), token: 'test-only-token', now: () => 10000000 });
  const headers = { authorization: 'Bearer test-only-token' };
  try {
    assert.equal((await app.inject({ url: '/v1/snapshot' })).statusCode, 401);
    assert.equal((await app.inject({ url: '/v1/snapshot', headers: { ...headers, origin: 'https://untrusted.example' } })).statusCode, 403);
    const state = ClientSnapshot.parse((await app.inject({ url: '/v1/snapshot', headers })).json());
    assert.equal(state.demo, true); assert.equal(state.model, 'local-demo'); assert.equal(state.conversations.length, 15);
    const request = await app.inject({ method: 'POST', url: '/v1/assistant/turns', headers,
      payload: { requestId: 'assistant1', text: 'never reply to Maya' } });
    assert.equal(request.statusCode, 200);
    const proposal = AssistantResponse.parse(request.json()).proposal; assert.ok(proposal);
    const before = ClientSnapshot.parse((await app.inject({ url: '/v1/snapshot', headers })).json());
    assert.equal(before.conversations.find(c => c.name === 'Maya')?.mode, 'auto_reply');
    const confirmed = await app.inject({ method: 'POST', url: '/v1/owner-actions/'+proposal.id+'/confirm', headers,
      payload: { requestId: 'confirm1', payloadHash: proposal.payloadHash } });
    assert.equal(confirmed.statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/conversations/demo-chat-4/draft', headers, payload: { requestId: 'no-ai' } })).statusCode, 403);
    const d = Draft.parse(state.drafts.find(d => d.conversationId === 'demo-chat-1'));
    const approved = await app.inject({ method: 'POST', url: '/v1/drafts/'+d.id+'/decision', headers,
      payload: { requestId: 'approve1', revision: d.revision, operation: 'approve' } });
    assert.equal(approved.statusCode, 200);
    const pause = await app.inject({ method: 'POST', url: '/v1/conversations/demo-chat-1/pause', headers, payload: { requestId: 'pause' } });
    assert.equal(pause.statusCode, 200);
    const p = Proposal.parse((await app.inject({ method: 'POST', url: '/v1/conversations/demo-chat-1/owner-actions', headers,
      payload: { requestId: 'resume-propose', kind: 'resume' } })).json());
    assert.equal((await app.inject({ method: 'POST', url: '/v1/owner-actions/'+p.id+'/confirm', headers,
      payload: { requestId: 'resume-confirm', payloadHash: p.payloadHash } })).statusCode, 200);
  } finally { await app.close(); }
});
