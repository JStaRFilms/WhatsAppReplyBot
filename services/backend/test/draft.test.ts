import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore, Workflow, type Action } from '@replybot/core';
import { createApp } from '../src/server.ts';
import { DEMO_ACCOUNT } from '../src/seed.ts';

test('remote drafting requires consent, respects takeover, and coalesces duplicate requests', async () => {
  const store = new SqliteStore();
  let calls = 0;
  let release: ((action: Action) => void) | undefined;
  let notify: (() => void) | undefined;
  let delayed = false;
  const action: Action = { kind: 'text', text: 'okay, sounds good', reason: 'Test output.' };
  const app = createApp({ store, token: 'test-owner-token', remoteModel: { generate: async () => {
    calls++;
    if (!delayed) return action;
    return new Promise<Action>(resolve => { release = resolve; notify?.(); });
  } } });
  const post = (url: string, payload: Record<string, unknown>) => app.inject({
    method: 'POST', url, headers: { authorization: 'Bearer test-owner-token' }, payload,
  });
  try {
    const denied = await post('/v1/conversations/demo-chat-6/draft', { requestId: 'before-consent' });
    assert.equal(denied.statusCode, 403); assert.equal(calls, 0);
    await post('/v1/model-consent', { requestId: 'consent', consent: true });
    const excluded = await post('/v1/conversations/demo-chat-3/draft', { requestId: 'never-reply' });
    assert.equal(excluded.statusCode, 403); assert.equal(calls, 0);
    const [first, duplicate, otherCaller] = await Promise.all([
      post('/v1/conversations/demo-chat-6/draft', { requestId: 'same-draft' }),
      post('/v1/conversations/demo-chat-6/draft', { requestId: 'same-draft' }),
      post('/v1/conversations/demo-chat-6/draft', { requestId: 'other-device-draft' }),
    ]);
    assert.equal(first.statusCode,200);assert.equal(duplicate.json().id,first.json().id);assert.equal(otherCaller.json().id,first.json().id);assert.equal(calls,1);
    const repeated=await post('/v1/conversations/demo-chat-6/draft',{requestId:'again'});assert.equal(repeated.json().id,first.json().id);assert.equal(calls,1);
    const incoming=store.recentMessages(DEMO_ACCOUNT,'demo-chat-6').find(m=>m.direction==='inbound');assert.ok(incoming);
    new Workflow(store,DEMO_ACCOUNT).observe({...incoming,id:'new-turn',transportId:'new-turn',occurredAt:Date.now(),text:'another question',source:'live'});
    const next=await post('/v1/conversations/demo-chat-6/draft',{requestId:'new-turn-draft'});assert.notEqual(next.json().id,first.json().id);assert.equal(calls,2);
    await post('/v1/conversations/demo-chat-6/pause', { requestId: 'pause' });
    assert.equal((await post('/v1/conversations/demo-chat-6/draft', { requestId: 'paused-draft' })).statusCode, 403);
    assert.equal(calls, 2);
    delayed = true;
    const started = new Promise<void>(resolve => { notify = resolve; });
    const pending = post('/v1/conversations/demo-chat-7/draft', { requestId: 'in-flight' });
    await started;
    await post('/v1/conversations/demo-chat-7/pause', { requestId: 'takeover' });
    assert.ok(release); release(action);
    const takenOver = await pending;
    assert.equal(takenOver.statusCode, 403); assert.equal(takenOver.json().error, 'ai_access_denied');
    const revokedStarted = new Promise<void>(resolve => { notify = resolve; });
    const revoked = post('/v1/conversations/demo-chat-8/draft', { requestId: 'revoked-in-flight' });
    await revokedStarted;
    await post('/v1/model-consent', { requestId: 'revoke', consent: false });
    assert.ok(release); release(action);
    assert.equal((await revoked).statusCode, 403);
    assert.equal(store.modelConsent(DEMO_ACCOUNT), false);
  } finally { await app.close(); }
});
