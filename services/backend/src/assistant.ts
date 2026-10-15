import { createHash } from 'node:crypto';
import { DomainError, aiAccess, type Conversation, type Workflow, type Draft } from '@replybot/core';
import { AssistantResponse } from '@replybot/core/api';

export function attention(flow: Workflow, start = Date.now()-5*60*60*1000, end = Date.now()) {
  const conversations = flow.effectiveConversations();
  return conversations.flatMap(c => {
    const messages = flow.store.recentMessages(flow.accountId,c.id,100,end);
    const incoming = messages.filter(m => m.direction === 'inbound' && m.occurredAt >= start && m.occurredAt <= end).at(-1);
    if (!incoming || messages.some(m => m.direction === 'outbound' && m.occurredAt > incoming.occurredAt)) return [];
    return [{ conversationId: c.id, name: c.name, sourceId: incoming.id, incompleteHistory: true,
      needsOwner: c.control === 'manual' || (incoming.statusReply && !incoming.statusContext),
      aiEligible: aiAccess(c, flow.accountId), reason: !aiAccess(c, flow.accountId) ? 'AI is off for this contact.'
        : c.control === 'manual' ? 'You are handling this chat.' : incoming.statusReply && !incoming.statusContext
          ? 'The original status context is missing.' : 'An incoming message is unanswered.' }];
  });
}
function resolve(flow: Workflow, name: string): Conversation[] {
  const lower = name.trim().toLowerCase().replace(/[.!?]+$/, '');
  const all = flow.effectiveConversations();
  const exact = all.filter(c => c.name.toLowerCase() === lower);
  return exact.length ? exact : all.filter(c => c.name.toLowerCase().startsWith(lower));
}
export async function assistantTurn(flow: Workflow, text: string, requestId: string, now: number,
  generateDraft: (conversationId: string, requestId: string) => Promise<Draft>): Promise<AssistantResponse> {
  const payloadHash = createHash('sha256').update(JSON.stringify({ operation: 'assistant-turn', text })).digest('hex');
  const saved = flow.store.request(flow.accountId, requestId);
  if (saved) {
    if (saved.hash !== payloadHash) throw new DomainError('request_id_conflict');
    return AssistantResponse.parse(saved.result);
  }
  let result: AssistantResponse = { text: 'This build supports "review the past five hours", "draft for David", "never reply to Tolu", or "resume David". Contact changes require confirmation; drafts are not sent automatically.',
    proposal: null, draftId: null, candidates: [] };
  const match = /^(draft(?: a reply)? for|never reply to|auto reply to|draft only for|resume)\s+(.+)$/i.exec(text.trim());
  if (/^review\b|^what needs me\b/i.test(text.trim())) {
    const items = attention(flow, now-5*60*60*1000, now);
    const drafts = flow.store.drafts(flow.accountId).filter(d => d.state === 'pending').length;
    result.text = items.length+' conversations have unanswered messages. '+drafts+' drafts are ready. '
      +items.filter(i => i.needsOwner).length+' need you. Nothing was sent. History may be incomplete.';
  } else if (match?.[1] && match[2]) {
    const candidates = resolve(flow, match[2]);
    const contact = candidates.length === 1 ? candidates[0] : undefined;
    if (!contact) {
      result.text = candidates.length ? 'Which contact did you mean?' : 'No matching contact was found.';
      result.candidates = candidates.map(c => ({ id: c.id, name: c.name }));
    } else {
      const verb = match[1].toLowerCase();
      if (verb.startsWith('draft') && verb.includes('for') && !verb.startsWith('draft only')) {
        const d = await generateDraft(contact.id, requestId+'-draft');
        result.text = d.state === 'needs_owner' ? d.action.reason : 'Created a draft for '+contact.name+'. No message was sent.';
        result.draftId = d.id;
      } else {
        const mode = verb === 'never reply to' ? 'never_reply' : verb === 'auto reply to' ? 'auto_reply' : 'draft_only';
        const p = flow.propose(contact.id, verb === 'resume' ? { kind: 'resume' } : { kind: 'change_mode', mode }, requestId+'-proposal');
        result.proposal = p;
        result.text = verb === 'resume' ? 'Confirm resuming '+contact.name+'. Old grants will not return.'
          : 'Confirm changing '+contact.name+' to '+mode.replaceAll('_',' ')+'. This has not been applied.';
      }
    }
  }
  const completed = flow.store.request(flow.accountId, requestId);
  if (completed) {
    if (completed.hash !== payloadHash) throw new DomainError('request_id_conflict');
    return AssistantResponse.parse(completed.result);
  }
  flow.store.transaction(() => {
    flow.store.saveAssistantTurn({ id: requestId+'-owner', accountId: flow.accountId, role: 'owner', text, createdAt: now, result: null });
    flow.store.saveAssistantTurn({ id: requestId+'-assistant', accountId: flow.accountId, role: 'assistant', text: result.text, createdAt: now+1, result });
    flow.store.saveRequest(flow.accountId, requestId, payloadHash, result);
  });
  return result;
}
