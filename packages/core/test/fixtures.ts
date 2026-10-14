import type { Conversation, Message } from '../src/contracts.ts';
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
