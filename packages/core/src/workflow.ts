import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Action, Component, Conversation, DomainError, Draft, Grant, Message, Outbox, Proposal, Snapshot, actionUnits } from './contracts.ts';
import { aiAccess, inPermittedHours } from './policy.ts';
import { buildContext } from './context.ts';
import { SqliteStore } from './store.ts';

export type TransportResult = { state: 'accepted'; transportId: string } | { state: 'failed' | 'unknown' };
export interface ProposalInput {
  kind: 'change_mode' | 'resume' | 'delegate'; mode?: Conversation['mode']; maxUnits?: number; expiresAt?: number;
}
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function outboxState(components: Component[]): Outbox['state'] {
  if (components.some(c => c.state === 'dispatching')) return 'dispatching';
  const accepted = components.filter(c => c.state === 'accepted').length;
  if (accepted === components.length) return 'accepted';
  if (components.some(c => c.state === 'unknown')) return accepted ? 'partial' : 'unknown';
  if (accepted) return 'partial';
  if (components.some(c => c.state === 'queued')) return 'queued';
  return components.every(c => c.state === 'cancelled') ? 'cancelled' : 'failed';
}

export class Workflow {
  private readonly lanes = new Map<string, Promise<void>>();
  constructor(readonly store: SqliteStore, readonly accountId: string, private readonly clock = Date.now) {}
  conversation(id: string): Conversation {
    const c = this.store.conversation(this.accountId, id);
    if (!c) throw new DomainError('conversation_not_found', 404);
    return c;
  }
  private request<T>(requestId: string, payload: unknown, schema: z.ZodType<T>, operation: () => T): T {
    if (!requestId || requestId.length > 128) throw new DomainError('invalid_request_id', 422);
    return this.store.transaction(() => {
      const saved = this.store.request(this.accountId, requestId);
      const payloadHash = hash(payload);
      if (saved) {
        if (saved.hash !== payloadHash) throw new DomainError('request_id_conflict');
        return schema.parse(saved.result);
      }
      const result = schema.parse(operation());
      this.store.saveRequest(this.accountId, requestId, payloadHash, result);
      return result;
    });
  }
  setModelConsent(consent: boolean, requestId: string): { consent: boolean } {
    return this.request(requestId, { operation: 'model-consent', consent }, z.object({ consent: z.boolean() }), () => {
      this.store.saveModelConsent(this.accountId, consent);
      for (const c of this.store.conversations(this.accountId)) this.invalidate(c, true);
      return { consent };
    });
  }
  private grant(conversationId: string): Grant | undefined {
    return this.store.grants(this.accountId, conversationId).find(g => g.state === 'active');
  }
  private release(outbox: Outbox, component: Component, next: Component['state']): void {
    if (outbox.grantId && component.state !== 'accepted' && component.state !== 'failed' && component.state !== 'cancelled') {
      const grant = this.store.grants(this.accountId, outbox.conversationId).find(g => g.id === outbox.grantId);
      if (grant && (next === 'accepted' || next === 'failed' || next === 'cancelled')) {
        this.store.saveGrant({ ...grant, reservedUnits: grant.reservedUnits - 1,
          successfulUnits: grant.successfulUnits + (next === 'accepted' ? 1 : 0) });
      }
    }
    component.state = next;
  }
  private invalidate(c: Conversation, revokeGrant: boolean): Conversation {
    const next = { ...c, workflowVersion: c.workflowVersion + 1 };
    this.store.saveConversation(next);
    for (const draft of this.store.drafts(this.accountId, c.id)) {
      if (draft.state === 'pending') this.store.saveDraft({ ...draft, state: 'stale' });
    }
    for (const outbox of this.store.outboxes(this.accountId, c.id)) {
      if (outbox.origin === 'owner_manual') continue;
      for (const part of outbox.components) if (part.state === 'queued') this.release(outbox, part, 'cancelled');
      outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox);
    }
    if (revokeGrant) for (const g of this.store.grants(this.accountId, c.id)) {
      if (g.state === 'active') this.store.saveGrant({ ...g, state: 'revoked' });
    }
    return next;
  }
  private takeOver(c: Conversation): Conversation { return this.invalidate({ ...c, control: 'manual' }, true); }
  pause(conversationId: string, requestId: string): Conversation {
    return this.request(requestId, { operation: 'pause', conversationId }, Conversation,
      () => this.takeOver(this.conversation(conversationId)));
  }
  observe(input: Message): boolean {
    const message = Message.parse(input);
    if (message.accountId !== this.accountId) throw new DomainError('account_mismatch', 403);
    return this.store.transaction(() => {
      let c = this.conversation(message.conversationId);
      if (this.store.messages(this.accountId, c.id).some(m => m.transportId === message.transportId)) return false;
      const echo = this.store.outboxes(this.accountId, c.id).some(o => o.components.some(p => p.transportId === message.transportId));
      if (message.direction === 'outbound' && echo) return false;
      if (message.direction === 'outbound') {
        message.authorship = 'unknown';
        if (message.source === 'live') c = this.takeOver(c);
      } else c = this.invalidate(c, false);
      this.store.saveMessage(message);
      if (message.direction === 'inbound') this.store.saveConversation({ ...c,
        lastHumanActivityAt: Math.max(c.lastHumanActivityAt, message.occurredAt) });
      return true;
    });
  }
  context(conversationId: string) {
    const c = this.conversation(conversationId);
    return buildContext(c, this.accountId, this.store.messages(this.accountId, c.id), [], 8000, this.clock());
  }
  private targets(c: Conversation, action: Action, quotedMessageId: string | null = null): void {
    const messages = this.store.messages(this.accountId, c.id);
    if (quotedMessageId && !('text' in action)) throw new DomainError('quote_requires_text', 422);
    if (quotedMessageId && !messages.some(m => m.id === quotedMessageId)) throw new DomainError('invalid_quote', 422);
    if ('reaction' in action && !messages.some(m => m.id === action.reaction.targetMessageId)) throw new DomainError('invalid_reaction_target', 422);
  }
  createDraft(conversationId: string, proposed: Action, expectedVersion: number, requestId: string): Draft {
    const action = Action.parse(proposed);
    return this.request(requestId, { operation: 'draft', conversationId, action, expectedVersion }, Draft, () => {
      let c = this.conversation(conversationId);
      if (!aiAccess(c, this.accountId) || c.control === 'manual') throw new DomainError('ai_access_denied', 403);
      if (c.workflowVersion !== expectedVersion) throw new DomainError('stale_workflow');
      this.targets(c, action);
      const trigger = this.store.messages(this.accountId, c.id).filter(m => m.direction === 'inbound').sort((a,b) => b.occurredAt-a.occurredAt)[0];
      if (!trigger) throw new DomainError('no_inbound_message', 422);
      if (action.kind === 'handover') c = this.takeOver(c);
      const draft = Draft.parse({ id: randomUUID(), accountId: this.accountId, conversationId, triggerMessageId: trigger.id,
        workflowVersion: c.workflowVersion, policyVersion: c.policyVersion, revision: 1, action,
        state: action.kind === 'handover' ? 'needs_owner' : action.kind === 'silence' ? 'dismissed' : 'pending',
        createdAt: this.clock(), edited: false });
      this.store.saveDraft(draft); return draft;
    });
  }
  editDraft(id: string, proposed: Action, revision: number, requestId: string): Draft {
    const action = Action.parse(proposed);
    return this.request(requestId, { operation: 'edit', id, action, revision }, Draft, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      let c = this.conversation(draft.conversationId);
      if (!aiAccess(c, this.accountId)) throw new DomainError('ai_access_denied', 403);
      if (draft.state !== 'pending' || draft.revision !== revision || draft.workflowVersion !== c.workflowVersion) throw new DomainError('stale_draft');
      this.targets(c, action);
      if (action.kind === 'handover') c = this.takeOver(c);
      const next: Draft = { ...draft, action, workflowVersion: c.workflowVersion, revision: revision + 1, edited: true,
        state: action.kind === 'handover' ? 'needs_owner' : action.kind === 'silence' ? 'dismissed' : 'pending' };
      this.store.saveDraft(next); return next;
    });
  }
  dismissDraft(id: string, requestId: string): Draft {
    return this.request(requestId, { operation: 'dismiss', id }, Draft, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      const next: Draft = { ...draft, state: 'dismissed' }; this.store.saveDraft(next); return next;
    });
  }
  propose(conversationId: string, input: ProposalInput, requestId: string): Proposal {
    return this.request(requestId, { operation: 'propose', conversationId, input }, Proposal, () => {
      const c = this.conversation(conversationId);
      if (input.kind === 'change_mode' && !input.mode) throw new DomainError('mode_required', 422);
      if (input.kind === 'delegate' && (c.mode !== 'auto_reply' || !input.maxUnits || !input.expiresAt
        || input.expiresAt <= this.clock() || input.expiresAt > this.clock() + 24*60*60*1000)) throw new DomainError('invalid_delegation', 422);
      const fields = { id: randomUUID(), accountId: this.accountId, conversationId, kind: input.kind,
        mode: input.kind === 'change_mode' ? input.mode : null,
        maxUnits: input.kind === 'delegate' ? input.maxUnits : null,
        expiresAt: input.kind === 'delegate' ? input.expiresAt : null,
        workflowVersion: c.workflowVersion, policyVersion: c.policyVersion, confirmBy: this.clock()+300000, consumed: false };
      const proposal = Proposal.parse({ ...fields, payloadHash: hash(fields) });
      this.store.saveProposal(proposal); return proposal;
    });
  }
  confirm(id: string, payloadHash: string, requestId: string): Conversation {
    return this.request(requestId, { operation: 'confirm', id, payloadHash }, Conversation, () => {
      const p = this.store.proposal(this.accountId, id);
      if (!p) throw new DomainError('proposal_not_found', 404);
      if (p.consumed || p.payloadHash !== payloadHash) throw new DomainError('confirmation_invalid');
      if (p.confirmBy <= this.clock()) throw new DomainError('confirmation_expired', 410);
      let c = this.conversation(p.conversationId);
      if (c.workflowVersion !== p.workflowVersion || c.policyVersion !== p.policyVersion) throw new DomainError('stale_proposal');
      if (p.kind === 'change_mode') c = this.invalidate({ ...c, mode: p.mode, policyVersion: c.policyVersion+1 }, true);
      if (p.kind === 'resume') c = this.invalidate({ ...c, control: 'assistant_allowed' }, true);
      if (p.kind === 'delegate') {
        if (!aiAccess(c, this.accountId) || c.mode !== 'auto_reply' || c.control === 'manual') throw new DomainError('delegation_denied', 403);
        if (!p.expiresAt || p.expiresAt <= this.clock() || !p.maxUnits) throw new DomainError('invalid_delegation', 422);
        if (this.store.outboxes(this.accountId, c.id).some(o => o.components.some(part => part.state === 'unknown'))) throw new DomainError('delivery_unknown');
        c = this.invalidate(c, true);
        this.store.saveGrant({ id: randomUUID(), accountId: this.accountId, conversationId: c.id,
          expiresAt: p.expiresAt, maxUnits: p.maxUnits, successfulUnits: 0, reservedUnits: 0, state: 'active' });
      }
      this.store.saveProposal({ ...p, consumed: true }); return c;
    });
  }
  private queue(c: Conversation, action: Action, requestId: string, origin: Outbox['origin'], authoredAs: Outbox['authoredAs'], quotedMessageId: string | null): Outbox {
    this.targets(c, action, quotedMessageId);
    const units = actionUnits(action); if (!units) throw new DomainError('no_outbound_action', 422);
    let grant: Grant | undefined;
    if (origin !== 'owner_manual') {
      if (!aiAccess(c, this.accountId) || c.control === 'manual' || !inPermittedHours(c, this.clock())) throw new DomainError('send_denied', 403);
      if (this.store.outboxes(this.accountId, c.id).some(o => o.components.some(p => p.state === 'unknown'))) throw new DomainError('delivery_unknown');
      grant = this.grant(c.id);
      if (grant && grant.expiresAt <= this.clock()) {
        this.store.saveGrant({ ...grant, state: 'ended' }); grant = undefined;
      }
      if (origin === 'assistant_auto' && (c.mode !== 'auto_reply' || !grant)) throw new DomainError('autonomy_denied', 403);
      if (grant && (grant.expiresAt <= this.clock() || grant.successfulUnits+grant.reservedUnits+units > grant.maxUnits)) throw new DomainError('grant_limit');
      if (grant) this.store.saveGrant({ ...grant, reservedUnits: grant.reservedUnits + units });
    }
    const components: Component[] = [];
    if ('reaction' in action) components.push({ id: randomUUID(), kind: 'reaction', text: null, reaction: action.reaction, state: 'queued', transportId: null });
    if ('text' in action) components.push({ id: randomUUID(), kind: 'text', text: action.text, reaction: null, state: 'queued', transportId: null });
    const outbox = Outbox.parse({ id: randomUUID(), accountId: this.accountId, conversationId: c.id, requestId,
      workflowVersion: c.workflowVersion, policyVersion: c.policyVersion, action, origin, authoredAs,
      state: 'queued', components, quotedMessageId, grantId: grant?.id ?? null, units, transportId: null, createdAt: this.clock() });
    this.store.saveOutbox(outbox); return outbox;
  }
  approve(id: string, revision: number, requestId: string): Outbox {
    return this.request(requestId, { operation: 'approve', id, revision }, Outbox, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      const c = this.conversation(draft.conversationId);
      if (draft.state !== 'pending' || draft.revision !== revision || draft.workflowVersion !== c.workflowVersion || draft.policyVersion !== c.policyVersion) throw new DomainError('stale_draft');
      const outbox = this.queue(c, draft.action, requestId, 'assistant_approved', draft.edited ? 'owner_edited_assistant' : 'assistant_written', null);
      this.store.saveDraft({ ...draft, state: 'approved' }); return outbox;
    });
  }
  autoSend(id: string, requestId: string): Outbox {
    return this.request(requestId, { operation: 'auto', id }, Outbox, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      const c = this.conversation(draft.conversationId);
      if (draft.state !== 'pending' || draft.workflowVersion !== c.workflowVersion || draft.policyVersion !== c.policyVersion) throw new DomainError('stale_draft');
      const outbox = this.queue(c, draft.action, requestId, 'assistant_auto', 'assistant_written', null);
      this.store.saveDraft({ ...draft, state: 'approved' }); return outbox;
    });
  }
  manualSend(conversationId: string, proposed: Action, requestId: string, quotedMessageId: string | null = null): Outbox {
    const action = Action.parse(proposed);
    return this.request(requestId, { operation: 'manual', conversationId, action, quotedMessageId }, Outbox,
      () => this.queue(this.takeOver(this.conversation(conversationId)), action, requestId, 'owner_manual', 'owner_written', quotedMessageId));
  }
  private fresh(outbox: Outbox): void {
    if (outbox.origin === 'owner_manual') return;
    const c = this.conversation(outbox.conversationId);
    if (this.store.outboxes(this.accountId, c.id).some(other => other.id !== outbox.id && other.components.some(p => p.state === 'unknown'))) throw new DomainError('delivery_unknown');
    if (!aiAccess(c, this.accountId) || c.control === 'manual' || !inPermittedHours(c, this.clock())
      || c.workflowVersion !== outbox.workflowVersion || c.policyVersion !== outbox.policyVersion) throw new DomainError('stale_delivery');
    if (outbox.grantId) {
      const g = this.store.grants(this.accountId, c.id).find(g => g.id === outbox.grantId);
      if (!g || g.state !== 'active' || g.expiresAt <= this.clock()) throw new DomainError('grant_expired');
    }
  }
  async dispatch(id: string, handoff: (component: Component) => Promise<TransportResult>): Promise<Outbox> {
    const outbox = this.store.outbox(this.accountId, id);
    if (!outbox) throw new DomainError('outbox_not_found', 404);
    const key = outbox.conversationId;
    const previous = this.lanes.get(key) ?? Promise.resolve();
    const run = previous.then(() => this.dispatchInLane(id, handoff));
    const settled = run.then(() => {}, () => {}); this.lanes.set(key, settled);
    try { return await run; } finally { if (this.lanes.get(key) === settled) this.lanes.delete(key); }
  }
  private async dispatchInLane(id: string, handoff: (component: Component) => Promise<TransportResult>): Promise<Outbox> {
    for (;;) {
      const part = this.store.transaction(() => {
        const outbox = this.store.outbox(this.accountId, id);
        if (!outbox) throw new DomainError('outbox_not_found', 404);
        const component = outbox.components.find(c => c.state === 'queued');
        if (!component || outbox.components.some(c => c.state === 'unknown')) return undefined;
        try { this.fresh(outbox); } catch (error) {
          if (!(error instanceof DomainError)) throw error;
          for (const p of outbox.components) if (p.state === 'queued') this.release(outbox, p, 'cancelled');
          outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox); return undefined;
        }
        component.state = 'dispatching'; outbox.state = 'dispatching'; this.store.saveOutbox(outbox); return component;
      });
      if (!part) break;
      let result: TransportResult;
      try { result = await handoff(part); } catch { result = { state: 'unknown' }; }
      this.store.transaction(() => {
        const outbox = this.store.outbox(this.accountId, id);
        if (!outbox) throw new DomainError('outbox_not_found', 404);
        const component = outbox.components.find(c => c.id === part.id);
        if (!component || component.state !== 'dispatching') return;
        this.release(outbox, component, result.state);
        if (result.state === 'accepted') {
          component.transportId = result.transportId; outbox.transportId ??= result.transportId;
          if (component.kind === 'text' && component.text !== null) {
            this.store.saveMessage({ id: randomUUID(), accountId: this.accountId, conversationId: outbox.conversationId,
              transportId: result.transportId, direction: 'outbound', authorship: outbox.authoredAs, text: component.text,
              occurredAt: this.clock(), source: 'live', quotedMessageId: outbox.quotedMessageId,
              statusReply: false, statusContext: null, media: null, reaction: null });
          } else if (component.reaction) {
            const target = this.store.messages(this.accountId, outbox.conversationId).find(m => m.id === component.reaction?.targetMessageId);
            if (target) this.store.saveMessage({ ...target, reaction: component.reaction.emoji });
          }
        } else for (const pending of outbox.components) if (pending.state === 'queued') this.release(outbox, pending, 'cancelled');
        outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox);
      });
    }
    return this.store.transaction(() => {
      const outbox = this.store.outbox(this.accountId, id);
      if (!outbox) throw new DomainError('outbox_not_found', 404);
      const c = this.conversation(outbox.conversationId);
      if (outbox.state === 'accepted' && outbox.origin === 'owner_manual') this.store.saveConversation({ ...c, lastHumanActivityAt: Math.max(c.lastHumanActivityAt, outbox.createdAt) });
      if (outbox.components.some(p => p.state === 'accepted') && outbox.origin !== 'owner_manual' && c.workflowVersion === outbox.workflowVersion) this.invalidate(c, false);
      return outbox;
    });
  }
  recover(): void {
    this.store.transaction(() => {
      for (const outbox of this.store.outboxes(this.accountId)) {
        for (const component of outbox.components) if (component.state === 'dispatching') component.state = 'unknown';
        outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox);
      }
    });
  }
  snapshot(): Snapshot {
    return { demo: true, connection: 'disconnected', model: 'local-demo', accountId: this.accountId,
      conversations: this.store.conversations(this.accountId), drafts: this.store.drafts(this.accountId),
      grants: this.store.grants(this.accountId), outbox: this.store.outboxes(this.accountId) };
  }
}
