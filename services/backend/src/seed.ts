import { randomUUID } from 'node:crypto';
import { SqliteStore, Workflow, type Conversation, type Message } from '@replybot/core';
import { demoReply } from './demo-model.ts';

export const DEMO_ACCOUNT = 'demo-account';
export const DEMO_TOKEN = 'replybot-local-demo';
export function seedDemo(store: SqliteStore, now = Date.now()): void {
  if (store.conversations(DEMO_ACCOUNT).length) return;
  const names = ['David O.', 'Femi A.', 'Chisom', 'Tolu', 'Maya', 'Ada', 'Kemi', 'Zain', 'Sam', 'Ife', 'Noah', 'Lola', 'Riley', 'Casey', 'Robin'];
  const texts = ['Can we move it to Friday? Around 4?', 'lmaooo this GIF 😂', 'This is so funny 😂', 'I will send the location', 'How is your day?', 'See you tomorrow', 'Can you send it later?', 'Are you there?', 'Just checking in', 'What do you think?', 'Please let me know', 'Hello!', 'Have a good day', 'Thanks!', 'Got it'];
  store.transaction(() => {
    names.forEach((name, i) => {
      const id = 'demo-chat-'+i;
      const c: Conversation = { id, accountId: DEMO_ACCOUNT, contactId: 'demo-contact-'+i, name,
        kind: 'direct', mode: i === 1 ? 'draft_only' : i === 3 ? 'never_reply' : i === 4 ? 'auto_reply' : null,
        excluded: false, control: 'assistant_allowed', workflowVersion: 1, policyVersion: 1,
        lastHumanActivityAt: now-i*180000, hours: null };
      store.saveConversation(c);
      const owner: Message = { id: randomUUID(), accountId: DEMO_ACCOUNT, conversationId: id, transportId: 'seed-owner-'+i,
        direction: 'outbound', authorship: 'owner_written', text: i === 1 ? 'on my way, five minutes' : 'yeah bro, let me know',
        occurredAt: now-i*180000-60000, source: 'backfill', quotedMessageId: null, statusReply: false,
        statusContext: null, media: null, reaction: null };
      store.saveMessage(owner);
      store.saveMessage({ ...owner, id: randomUUID(), transportId: 'seed-incoming-'+i, direction: 'inbound',
        authorship: 'contact_written', text: texts[i] ?? 'hello', occurredAt: c.lastHumanActivityAt,
        quotedMessageId: i === 1 ? owner.id : null, statusReply: i === 2,
        media: i === 1 ? { kind: 'gif', access: 'available', fixture: 'gif', description: 'Synthetic clock joke', viewOnce: false, expiresAt: null }
          : i === 5 ? { kind: 'image', access: 'available', fixture: 'image', description: 'Synthetic landscape drawing', viewOnce: false, expiresAt: null }
          : i === 6 ? { kind: 'sticker', access: 'available', fixture: 'sticker', description: 'Synthetic smiling sticker', viewOnce: false, expiresAt: null } : null });
    });
  });
  const workflow = new Workflow(store, DEMO_ACCOUNT, () => now);
  for (const id of ['demo-chat-0', 'demo-chat-1', 'demo-chat-2', 'demo-chat-5']) {
    workflow.createDraft(id, demoReply(workflow.context(id)), workflow.conversation(id).workflowVersion, 'seed-draft-'+id);
  }
}
