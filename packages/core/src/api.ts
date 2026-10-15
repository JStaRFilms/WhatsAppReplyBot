import { z } from 'zod';
import { Snapshot, Message, Proposal } from './contracts.ts';
export const ProfileScope = z.object({
  profileId: z.string().min(1), accountId: z.string().min(1), revision: z.number().int().nonnegative(),
}).strict();
export type ProfileScope = z.infer<typeof ProfileScope>;
export const ProfileDescriptor = z.object({ profileId: z.string(), accountId: z.string(), label: z.string(), active: z.boolean() }).strict();
export type ProfileDescriptor = z.infer<typeof ProfileDescriptor>;
export const ProfileOperation = z.object({
  requestId: z.string(), kind: z.enum(['create','activate','repair']),
  state: z.enum(['pending','quiescing','restarting','completed','failed']), sourceScope: ProfileScope,
  targetProfileId: z.string().nullable(), resultScope: ProfileScope.nullable(), error: z.string().nullable(),
}).strict();
export type ProfileOperation = z.infer<typeof ProfileOperation>;
export const PcDisplay = z.object({ requestId: z.string().min(1).max(96), state: z.enum(['requested', 'ready', 'unavailable', 'expired']) }).strict();
export type PcDisplay = z.infer<typeof PcDisplay>;
export const SessionDiscovery = z.object({ protocol: z.literal(2), scope: ProfileScope, label: z.string(), transition: ProfileOperation.nullable(),
  capabilities: z.object({ pcQrDisplay: z.boolean().optional(), desktopBrowser: z.boolean().optional() }).strict().optional(),
}).strict();
export type SessionDiscovery = z.infer<typeof SessionDiscovery>;
export const ProfileList = z.object({ profiles: z.array(ProfileDescriptor) }).strict();
export type ProfileList = z.infer<typeof ProfileList>;
const TransitionRequest = z.object({ requestId: z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/), confirm: z.literal(true) });
export const ProfileTransitionInput = z.discriminatedUnion('kind', [
  TransitionRequest.extend({ kind: z.literal('create'), label: z.string().min(1).max(80) }).strict(),
  TransitionRequest.extend({ kind: z.literal('activate'), profileId: z.string().min(1) }).strict(),
  TransitionRequest.extend({ kind: z.literal('repair') }).strict(),
]);
export type ProfileTransitionInput = z.infer<typeof ProfileTransitionInput>;
export const ProfileTransitionResult = z.object({ operation: ProfileOperation }).strict();
export type ProfileTransitionResult = z.infer<typeof ProfileTransitionResult>;
export const ClientSnapshot = Snapshot.extend({
  profileScope: ProfileScope.default({ profileId: 'original', accountId: 'whatsapp-owner', revision: 0 }),
  serverTime:z.number().default(0),
  lastMessages: z.array(Message), latestTenIds: z.array(z.string()), modelConsent: z.boolean(), unreadCounts: z.record(z.string(),z.number().int().nonnegative()).default({}),
  historyVersions:z.record(z.string(),z.number().int().nonnegative()).default({}),
});
export type ClientSnapshot = z.infer<typeof ClientSnapshot>;
export const AssistantResponse = z.object({
  text: z.string(), proposal: Proposal.nullable(), draftId: z.string().nullable(),
  candidates: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type AssistantResponse = z.infer<typeof AssistantResponse>;
export const AssistantTurn = z.object({
  id: z.string(), accountId: z.string(), role: z.enum(['owner', 'assistant']),
  text: z.string(), createdAt: z.number(), result: AssistantResponse.nullable(),
});
export type AssistantTurn = z.infer<typeof AssistantTurn>;
