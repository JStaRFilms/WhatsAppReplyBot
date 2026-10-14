import { Action, type ModelContext } from '@replybot/core';

export function demoReply(context: ModelContext): Action {
  const incoming = context.messages.filter(m => m.direction === 'inbound').at(-1);
  if (!incoming) return { kind: 'handover', reason: 'No incoming message is available.' };
  if (context.limitations.length) return { kind: 'handover', reason: 'The status or media context is missing. Please review it yourself.' };
  const lower = incoming.text.toLowerCase();
  if (/\b(friday|calendar|meeting|available|time|birthday)\b/.test(lower))
    return { kind: 'handover', reason: 'Your availability or a personal commitment needs confirmation.' };
  if (/^(thanks|thank you|okay|ok|got it)[.!\s]*$/i.test(lower))
    return { kind: 'silence', reason: 'The conversation can end naturally.' };
  if (/lol|lmao|😂|gif|sticker/.test(lower) || incoming.media?.kind === 'gif')
    return { kind: 'reaction', reaction: { targetMessageId: incoming.id, emoji: '😂' }, reason: 'A short reaction fits this synthetic conversation.' };
  return { kind: 'text', text: 'yeah, let me check and get back to you', reason: 'Local demo response, not a live model judgment.' };
}
