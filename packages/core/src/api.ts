import { z } from 'zod';
import { Snapshot, Message, Proposal } from './contracts.ts';
export const ClientSnapshot = Snapshot.extend({
  lastMessages: z.array(Message), latestTenIds: z.array(z.string()), modelConsent: z.boolean(),
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
