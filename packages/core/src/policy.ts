import type { Conversation, Grant } from './contracts.ts';

export function inPermittedHours(conversation: Conversation, now: number): boolean {
  if (!conversation.hours) return true;
  const { timezone, start, end } = conversation.hours;
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour: 'numeric', hourCycle: 'h23',
    }).format(new Date(now)));
    if (!Number.isFinite(hour)) return false;
    return start === end || (start < end ? hour >= start && hour < end : hour >= start || hour < end);
  } catch { return false; }
}

export function aiAccess(conversation: Conversation, accountId: string): boolean {
  return conversation.accountId === accountId && conversation.kind === 'direct'
    && !conversation.excluded && conversation.mode !== 'never_reply';
}

export function latestTen(conversations: Conversation[], accountId: string, now: number): string[] {
  return conversations.filter(c => aiAccess(c, accountId) && c.mode === null
    && c.control === 'assistant_allowed' && inPermittedHours(c, now))
    .sort((a, b) => b.lastHumanActivityAt - a.lastHumanActivityAt || a.id.localeCompare(b.id))
    .slice(0, 10).map(c => c.id);
}

export function automaticDecision(
  conversation: Conversation, conversations: Conversation[], accountId: string,
  now: number, source: 'live' | 'backfill' | 'replay' | 'unknown', grant: Grant | undefined,
): 'none' | 'draft' | 'auto' {
  if (source !== 'live' || !aiAccess(conversation, accountId)
    || conversation.control === 'manual' || !inPermittedHours(conversation, now)) return 'none';
  if (conversation.mode === 'auto_reply') {
    return grant?.accountId === accountId && grant.conversationId === conversation.id
      && grant.state === 'active' && grant.expiresAt > now
      && grant.successfulUnits + grant.reservedUnits < grant.maxUnits ? 'auto' : 'draft';
  }
  return conversation.mode === 'draft_only'
    || latestTen(conversations, accountId, now).includes(conversation.id) ? 'draft' : 'none';
}
