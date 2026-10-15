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
  capabilities: z.object({ pcQrDisplay: z.boolean().optional(), desktopBrowser: z.boolean().optional(), ownerInstructions: z.boolean().optional(), contactBookNames: z.boolean().optional() }).strict().optional(),
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
const Revision = z.number().int().nonnegative();
const ReleaseRequest = z.object({ requestId: z.string().min(1).max(96), expectedRevision: Revision });
const plainText = (points: number, bytes: number) => z.string().refine(text =>
  [...text].length <= points && new TextEncoder().encode(text).length <= bytes
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ud800-\udfff]/u.test(text), 'Invalid plain text');
export const OwnerInstructions = z.object({ text: plainText(2000, 4000), revision: Revision }).strict();
export type OwnerInstructions = z.infer<typeof OwnerInstructions>;
export const OwnerInstructionsInput = ReleaseRequest.extend({ text: OwnerInstructions.shape.text }).strict();
export type OwnerInstructionsInput = z.infer<typeof OwnerInstructionsInput>;
export const ContactNameSettings = z.object({ enabled: z.boolean(), revision: Revision,
  lastPhoneSyncAt: z.number().nonnegative().nullable(), lastPhoneImportRequestId: z.string().nullable(),
}).strict();
export type ContactNameSettings = z.infer<typeof ContactNameSettings>;
export const ContactNamesInput = ReleaseRequest.extend({ enabled: z.boolean() }).strict();
export type ContactNamesInput = z.infer<typeof ContactNamesInput>;
export const ContactNamesImportInput = ReleaseRequest.extend({ entries: z.array(z.object({
  conversationId: z.string().min(1).max(128), name: plainText(120, 512).refine(text => text.trim().length > 0 && !/[\t\r\n]/.test(text)),
}).strict()).max(500) }).strict();
export type ContactNamesImportInput = z.infer<typeof ContactNamesImportInput>;
export const ContactNamesImportResult = z.object({ settings: ContactNameSettings }).strict();
export type ContactNamesImportResult = z.infer<typeof ContactNamesImportResult>;
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
