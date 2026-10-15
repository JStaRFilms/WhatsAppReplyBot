import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Message } from './contracts.ts';

export interface RawHistoryEvidence {
  deleted: boolean; viewOnce: boolean; expiresAt: number | null; mediaIdentity: string | null; conflict?:boolean;
}
export interface HistorySource {
  message: Message; accountId: string; conversationId: string; messageId: string; transportId: string;
  candidateIds: string[]; state: 'available'|'deleted'|'expired'|'view_once'|'conflict'; expiresAt: number|null;
}
export const HistoryCursor = z.tuple([
  z.literal(1), z.string().min(1), z.string().min(1), z.string().regex(/^[a-f0-9]{64}$/),
  z.number().int().nonnegative(), z.number().int().nonnegative().safe(), z.number().finite(), z.string().min(1),
]);
export function historyDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function partialMessage(message: Message): boolean {
  return message.contentState === 'partial' || message.contentState === undefined && !message.text.trim()
    && !message.media && !message.reaction && !message.observedReactions?.length && !message.statusReply;
}
export function automaticTrigger(message: Message): boolean {
  return !partialMessage(message) && !message.contentRecovered && (!!message.text.trim() || message.media !== null);
}
export function eventIdentity(message: Message, mediaIdentity: string|null): string {
  // Known arrival classes can differ for the same event; actor and unknown provenance cannot.
  const media = message.media;
  return historyDigest([message.direction,message.occurredAt,message.authorship,message.source==='unknown'?'unknown':'whatsapp',message.text,
    message.quotedMessageId,message.statusReply,message.statusContext,
    media ? [media.kind,media.fixture,media.mime ?? null,media.duration ?? null,media.width ?? null,media.height ?? null,mediaIdentity] : null]);
}
