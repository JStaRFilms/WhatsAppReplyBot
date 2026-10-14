import { z } from 'zod';

export const Mode = z.enum(['never_reply', 'draft_only', 'auto_reply']);
export const Hours = z.object({
  timezone: z.string(),
  start: z.number().int().min(0).max(23),
  end: z.number().int().min(0).max(23),
}).strict();
export const Conversation = z.object({
  id: z.string().min(1), accountId: z.string().min(1), contactId: z.string().min(1),
  name: z.string(), kind: z.enum(['direct', 'group', 'status_broadcast', 'unknown']),
  mode: Mode.nullable(), excluded: z.boolean(), control: z.enum(['assistant_allowed', 'manual']),
  workflowVersion: z.number().int().positive(), policyVersion: z.number().int().positive(),
  lastHumanActivityAt: z.number().nonnegative(), hours: Hours.nullable(),
});
export type Conversation = z.infer<typeof Conversation>;
export type Mode = z.infer<typeof Mode>;
export const Media = z.object({
  kind: z.enum(['image', 'sticker', 'animated_sticker', 'gif', 'audio', 'video', 'document']),
  access: z.enum(['available', 'missing', 'expired', 'unsupported']),
  fixture: z.enum(['image', 'sticker', 'gif']).nullable(),
  description: z.string().max(512), viewOnce: z.boolean(),
  expiresAt: z.number().nullable(),
});
export const Message = z.object({
  id: z.string(), accountId: z.string(), conversationId: z.string(), transportId: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  authorship: z.enum(['owner_written', 'assistant_written', 'owner_edited_assistant', 'contact_written', 'unknown']),
  text: z.string().max(100_000), occurredAt: z.number(),
  source: z.enum(['live', 'backfill', 'replay', 'unknown']),
  quotedMessageId: z.string().nullable(), statusReply: z.boolean(), statusContext: z.string().max(2000).nullable(),
  media: Media.nullable(), reaction: z.string().nullable(),
});
export type Message = z.infer<typeof Message>;
const Reason = z.string().min(1).max(512);
const Reaction = z.object({ targetMessageId: z.string().min(1), emoji: z.enum(['👍', '😂', '❤️', '🙏', '🎉', '😮', '😢']) }).strict();
export const Action = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('silence'), reason: Reason }).strict(),
  z.object({ kind: z.literal('handover'), reason: Reason }).strict(),
  z.object({ kind: z.literal('text'), text: z.string().trim().min(1).max(4000), reason: Reason }).strict(),
  z.object({ kind: z.literal('reaction'), reaction: Reaction, reason: Reason }).strict(),
  z.object({ kind: z.literal('reaction_plus_text'), reaction: Reaction, text: z.string().trim().min(1).max(4000), reason: Reason }).strict(),
]);
export type Action = z.infer<typeof Action>;
export const Draft = z.object({
  id: z.string(), accountId: z.string(), conversationId: z.string(), triggerMessageId: z.string(),
  workflowVersion: z.number(), policyVersion: z.number(), revision: z.number().int().positive(),
  action: Action, state: z.enum(['pending', 'needs_owner', 'approved', 'dismissed', 'stale']),
  createdAt: z.number(), edited: z.boolean(),
});
export type Draft = z.infer<typeof Draft>;
export const Grant = z.object({
  id: z.string(), accountId: z.string(), conversationId: z.string(), expiresAt: z.number(),
  maxUnits: z.number().int().min(1).max(20), successfulUnits: z.number().int().nonnegative(),
  reservedUnits: z.number().int().nonnegative(), state: z.enum(['active', 'revoked', 'ended']),
});
export type Grant = z.infer<typeof Grant>;
export const Component = z.object({
  id: z.string(), kind: z.enum(['text', 'reaction']), text: z.string().nullable(),
  reaction: Reaction.nullable(),
  state: z.enum(['queued', 'dispatching', 'accepted', 'cancelled', 'unknown', 'failed']),
  transportId: z.string().nullable(),
});
export type Component = z.infer<typeof Component>;
export const Outbox = z.object({
  id: z.string(), accountId: z.string(), conversationId: z.string(), requestId: z.string(),
  workflowVersion: z.number(), policyVersion: z.number(), action: Action,
  origin: z.enum(['owner_manual', 'assistant_approved', 'assistant_auto']),
  state: z.enum(['queued', 'dispatching', 'accepted', 'cancelled', 'unknown', 'failed', 'partial']),
  components: z.array(Component).min(1).max(2), quotedMessageId: z.string().nullable(),
  grantId: z.string().nullable(), units: z.number(), transportId: z.string().nullable(),
  authoredAs: z.enum(['owner_written', 'assistant_written', 'owner_edited_assistant']), createdAt: z.number(),
});
export type Outbox = z.infer<typeof Outbox>;
export const Proposal = z.object({
  id: z.string(), accountId: z.string(), conversationId: z.string(),
  kind: z.enum(['change_mode', 'resume', 'delegate']), mode: Mode.nullable(),
  maxUnits: z.number().int().min(1).max(20).nullable(), expiresAt: z.number().nullable(),
  workflowVersion: z.number(), policyVersion: z.number(), confirmBy: z.number(), consumed: z.boolean(),
  payloadHash: z.string().length(64),
});
export type Proposal = z.infer<typeof Proposal>;
export const Snapshot = z.object({
  demo: z.boolean(), connection: z.enum(['disconnected', 'connecting', 'qr', 'connected', 'error']), model: z.enum(['local-demo', 'openai/gpt-6-luna']),
  accountId: z.string(), conversations: z.array(Conversation), drafts: z.array(Draft), grants: z.array(Grant),
  outbox: z.array(Outbox),
});
export type Snapshot = z.infer<typeof Snapshot>;

export function actionUnits(action: Action): number {
  return action.kind === 'reaction_plus_text' ? 2 : action.kind === 'text' || action.kind === 'reaction' ? 1 : 0;
}
export class DomainError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}
