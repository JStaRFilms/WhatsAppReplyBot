import assert from 'node:assert/strict';
import test from 'node:test';
import { Conversation, Message, Action, actionUnits } from '../src/contracts.ts';
import { latestTen, automaticDecision, inPermittedHours } from '../src/policy.ts';
import { buildContext } from '../src/context.ts';

export function chat(id = 'c1'): Conversation {
  return { id, accountId: 'a', contactId: id, name: id, kind: 'direct', mode: null,
    excluded: false, control: 'assistant_allowed', workflowVersion: 1, policyVersion: 1,
    lastHumanActivityAt: 100, hours: null };
}
export function message(id = 'm1', conversationId = 'c1'): Message {
  return { id, accountId: 'a', conversationId, transportId: id, direction: 'inbound',
    authorship: 'contact_written', text: 'hello', occurredAt: 100, source: 'live',
    quotedMessageId: null, statusReply: false, statusContext: null, media: null, reaction: null };
}
test('select ten after removing explicit modes, exclusion and non-direct chats', () => {
  const chats = Array.from({ length: 15 }, (_, i) => ({ ...chat('c' + i), lastHumanActivityAt: i }));
  const explicit = { ...chat('auto'), mode: 'auto_reply' as const, lastHumanActivityAt: 1000 };
  assert.equal(latestTen([...chats, explicit, { ...chat('never'), mode: 'never_reply' }, { ...chat('group'), kind: 'group' }], 'a', 100).length, 10);
  assert.deepEqual(latestTen(chats, 'a', 100), ['c14','c13','c12','c11','c10','c9','c8','c7','c6','c5']);
  assert.equal(automaticDecision(chats[0] ?? chat(), chats, 'a', 100, 'live', undefined), 'none');
  assert.equal(automaticDecision(explicit, chats, 'a', 100, 'live', undefined), 'draft');
});
test('history, unknown sources and manual control cannot trigger automatic work', () => {
  const c = chat();
  for (const source of ['backfill', 'replay', 'unknown'] as const)
    assert.equal(automaticDecision(c, [c], 'a', 100, source, undefined), 'none');
  assert.equal(automaticDecision({ ...c, control: 'manual' }, [c], 'a', 100, 'live', undefined), 'none');
});
test('overnight hours respect timezone and invalid zones fail closed', () => {
  const c = { ...chat(), hours: { timezone: 'UTC', start: 22, end: 6 } };
  assert.equal(inPermittedHours(c, Date.UTC(2026, 9, 14, 23)), true);
  assert.equal(inPermittedHours(c, Date.UTC(2026, 9, 14, 12)), false);
  assert.equal(inPermittedHours({ ...c, hours: { ...c.hours, timezone: 'bad-zone' } }, 100), false);
});
test('context isolates contacts/accounts and learns only verified owner examples', () => {
  const c = chat();
  const own = { ...message('own'), direction: 'outbound' as const, authorship: 'owner_written' as const, text: 'yeah bro' };
  const bot = { ...own, id: 'bot', authorship: 'assistant_written' as const, text: 'BOT STYLE' };
  const ctx = buildContext(c, 'a', [own, bot, message('other', 'c2'), { ...message('foreign'), accountId: 'b' }]);
  assert.deepEqual(ctx.styleExamples, ['yeah bro']);
  assert.equal(ctx.messages.length, 2);
  assert.throws(() => buildContext({ ...c, mode: 'never_reply' }, 'a', []), /ai_access_denied/);
  assert.throws(() => buildContext({ ...c, excluded: true }, 'a', []), /ai_access_denied/);
});
test('deleted source memory and view-once context are not exported', () => {
  const m = { ...message(), statusReply: true, media: { kind: 'image' as const, access: 'available' as const,
    fixture: 'image' as const, description: 'PRIVATE PIXELS', viewOnce: true, expiresAt: null } };
  const ctx = buildContext(chat(), 'a', [m], [{ accountId: 'a', contactId: 'c1', text: 'stale fact', sourceIds: ['deleted'], certainty: 'inferred' }]);
  assert.equal(ctx.memories.length, 0);
  assert.equal(JSON.stringify(ctx).includes('PRIVATE PIXELS'), false);
  assert.deepEqual(ctx.limitations, ['status_original_missing', 'view_once_not_exported']);
});
test('oversize required current input rejects rather than truncates policy', () => {
  assert.throws(() => buildContext(chat(), 'a', [{ ...message(), text: '字'.repeat(4000) }]), /context_budget_exceeded/);
});
test('model output is strict and reactions consume units', () => {
  assert.equal(actionUnits(Action.parse({ kind: 'reaction', reaction: { targetMessageId: 'm', emoji: '😂' }, reason: 'fits' })), 1);
  assert.equal(actionUnits(Action.parse({ kind: 'reaction_plus_text', text: 'lol', reaction: { targetMessageId: 'm', emoji: '😂' }, reason: 'fits' })), 2);
  assert.equal(Action.safeParse({ kind: 'text', text: 'hello', reason: 'ok', grant: true }).success, false);
});
