import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { setTimeout as wait } from 'node:timers/promises';
import { Action, Component, Conversation, DomainError, Draft, Grant, Message, Outbox, Proposal, Snapshot, OwnerAction, ImageUpload, AudioUpload, ReactionObservation, actionUnits } from './contracts.ts';
import { aiAccess, inPermittedHours } from './policy.ts';
import { buildContext } from './context.ts';
import { held, OWNER_COOLDOWN, pauseState } from './pause.ts';
import { SqliteStore } from './store.ts';

export type TransportResult = { state: 'accepted'; transportId: string } | { state: 'failed' | 'unknown' };
export interface DispatchOptions {
  signal?: AbortSignal;
  check?: () => void;
}
export interface ProposalInput {
  kind: 'change_mode' | 'resume' | 'delegate' | 'configure'; mode?: Conversation['mode']; maxUnits?: number | null | undefined; expiresAt?: number | null | undefined; acknowledgeRisk?: boolean | undefined;
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
  private readonly changes = new Set<(conversationId: string) => void>();
  constructor(readonly store: SqliteStore, readonly accountId: string, private readonly clock = Date.now,
    private readonly sleep = (ms: number, signal: AbortSignal): Promise<void> => wait(ms, undefined, { signal })) {}
  onChange(listener: (conversationId: string) => void): () => void {
    this.changes.add(listener);
    return () => { this.changes.delete(listener); };
  }
  conversation(id: string): Conversation {
    const c = this.store.conversation(this.accountId, id);
    if (!c) throw new DomainError('conversation_not_found', 404);
    return c;
  }
  stageImage(conversationId: string, image: Omit<ImageUpload, 'id'> & { bytes: Uint8Array }, requestId: string): ImageUpload {
    const metadata = ImageUpload.omit({id:true}).parse(image);
    if (!image.bytes.length || image.bytes.length > 10*1024*1024) throw new DomainError('image_too_large',413);
    return this.request(requestId, {operation:'image-upload',conversationId,...metadata,
      digest:createHash('sha256').update(image.bytes).digest('hex')}, ImageUpload, () => {
      this.conversation(conversationId);
      this.store.cleanupImageUploads(this.accountId,this.clock()-3600000);
      const upload = {...metadata,id:randomUUID()};
      this.store.saveImageUpload(this.accountId,conversationId,upload,image.bytes,this.clock());
      return upload;
    });
  }
  stageAudio(conversationId:string,audio:Omit<AudioUpload,'id'> & {bytes:Uint8Array},requestId:string):AudioUpload {
    const metadata=AudioUpload.omit({id:true}).parse(audio);
    return this.request(requestId,{operation:'audio-upload',conversationId,...metadata,
      digest:createHash('sha256').update(audio.bytes).digest('hex')},AudioUpload,()=>{
      this.conversation(conversationId);
      this.store.cleanupAudioUploads(this.accountId,this.clock()-3600000);
      const upload={...metadata,id:randomUUID()};
      this.store.saveAudioUpload(this.accountId,conversationId,upload,audio.bytes,this.clock());
      return upload;
    });
  }
  observeReaction(conversationId: string, targetMessageId: string, input: ReactionObservation, verifiedOwner = false): boolean {
    const observation = ReactionObservation.parse(input);
    return this.store.transaction(() => {
      const c = this.conversation(conversationId);
      const target = this.store.message(this.accountId,targetMessageId);
      if (!target || target.conversationId !== c.id) throw new DomainError('invalid_reaction_target',422);
      const known = this.store.outboxes(this.accountId,c.id).find(o => o.components.some(p => p.kind === 'reaction' && p.transportId === observation.transportId && p.reaction?.targetMessageId === target.id));
      observation.actor = known ? known.origin === 'owner_manual' ? 'owner' : 'assistant'
        : verifiedOwner ? 'owner' : observation.actor === 'contact' ? 'contact' : 'unknown';
      if (observation.actor === 'owner' || observation.actor === 'assistant') observation.actorId = 'account';
      const observations = target.observedReactions ?? [];
      const sameActor=(r:ReactionObservation)=>observation.actorId==='account' ? r.actor==='owner' || r.actor==='assistant' : r.actorId===observation.actorId;
      const previous=observations.filter(sameActor).sort((a,b)=>a.occurredAt-b.occurredAt).at(-1);
      if (previous && (previous.occurredAt > observation.occurredAt || previous.transportId === observation.transportId
        && previous.emoji === observation.emoji && (previous.source === 'live' || observation.source !== 'live'))) return false;
      this.store.saveMessage({...target,reaction:observation.emoji,
        observedReactions:[...observations.filter(r => !sameActor(r)),observation]});
      if (observation.source === 'live' && observation.actor !== 'assistant' && !known) {
        if (verifiedOwner) {
          const next = this.takeOver(c);
          this.ownerSent(next,observation.occurredAt,false);
        } else {
          const pause = pauseState(c); pause.catchUpMessageId = null;
          this.invalidate({...c,pause},false);
        }
      }
      return true;
    });
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
      if (this.store.modelConsent(this.accountId) === consent) return { consent };
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
    for (const listener of this.changes) listener(c.id);
    return next;
  }
  private resolveHandovers(conversationId: string, answeredAt?: number): void {
    for (const d of this.store.drafts(this.accountId, conversationId)) {
      if (d.state === 'needs_owner' && (answeredAt === undefined || answeredAt >= (d.handoverAt ?? d.createdAt))) this.store.saveDraft({ ...d, state: 'resolved' });
    }
  }
  private takeOver(c: Conversation, handover = false): Conversation {
    const pause = pauseState(c);
    if (!c.pause && !handover) pause.indefinite = false;
    if (handover) pause.handover = true; else pause.sending = true;
    pause.catchUpMessageId = null;
    return this.invalidate({ ...c, control: 'manual', pause }, false);
  }
  private ownerSent(c: Conversation, at: number, text: boolean): void {
    const pause = pauseState(c);
    if (!c.pause) pause.indefinite = false;
    pause.sending = false;
    pause.until = Math.max(pause.until ?? 0,at+OWNER_COOLDOWN);
    pause.catchUpMessageId = null;
    if (text) { pause.handover = false; this.resolveHandovers(c.id,at); }
    this.store.saveConversation({ ...c, control: 'manual', pause });
  }
  pause(conversationId: string, requestId: string): Conversation {
    return this.request(requestId, { operation: 'pause', conversationId }, Conversation,
      () => {
        const c = this.conversation(conversationId); const pause = pauseState(c);
        pause.indefinite = true; pause.catchUpMessageId = null;
        return this.invalidate({ ...c, control: 'manual', pause },true);
      });
  }
  composer(conversationId: string, hasText: boolean, requestId: string, clientId = 'owner-client'): Conversation {
    return this.request(requestId,{ operation: 'composer',conversationId,hasText,clientId },Conversation,() => {
      const c = this.conversation(conversationId); const pause = pauseState(c);
      this.store.setComposer(this.accountId,conversationId,clientId,hasText);
      const composing = this.store.hasComposer(this.accountId,conversationId);
      if (pause.composing === composing) return c;
      pause.composing = composing; pause.typingUntil = composing ? null : this.clock()+10000;
      pause.catchUpMessageId = null;
      return this.invalidate({ ...c,control:'manual',pause },false);
    });
  }
  quickControl(conversationId: string, action: 'resume'|'extend'|'indefinite', requestId: string): Conversation {
    return this.request(requestId,{ operation:'quick-control',conversationId,action },Conversation,() => {
      const c = this.conversation(conversationId); const pause = pauseState(c);
      pause.catchUpMessageId = null;
      if (action === 'resume') {
        if (!aiAccess(c,this.accountId)) throw new DomainError('ai_access_denied',403);
        if (pause.composing) throw new DomainError('composer_has_text',409);
        if (pause.sending || this.store.outboxes(this.accountId,c.id).some(o => o.components.some(p => p.state === 'unknown' || p.state === 'dispatching'))) throw new DomainError('delivery_unknown');
        pause.indefinite = false; pause.handover = false; pause.until = null; pause.typingUntil = null;
        this.resolveHandovers(c.id);
      } else if (action === 'extend') pause.until = Math.max(pause.until ?? 0,this.clock())+OWNER_COOLDOWN;
      else pause.indefinite = true;
      const next = this.invalidate({ ...c,control:held(pause,this.clock())?'manual':'assistant_allowed',pause },false);
      if (next.control === 'assistant_allowed') this.queueCatchUp(next);
      return this.conversation(c.id);
    });
  }
  private queueCatchUp(c: Conversation): void {
    const messages = this.store.recentMessages(this.accountId,c.id);
    const last = messages.at(-1);
    const pause = pauseState(c);
    pause.catchUpMessageId = last?.direction === 'inbound' && last.source === 'live' && !this.store.drafts(this.accountId,c.id).some(d => d.triggerMessageId === last.id && d.state === 'pending') ? last.id : null;
    this.store.saveConversation({ ...c,pause });
  }
  expirePauses(): { conversationId: string; messageId: string; workflowVersion:number }[] {
    return this.store.transaction(() => {
      for (const c of this.store.duePauses(this.accountId,this.clock())) {
        const pause = pauseState(c);
        if (pause.until !== null && pause.until <= this.clock()) pause.until = null;
        if (pause.typingUntil !== null && pause.typingUntil <= this.clock()) pause.typingUntil = null;
        if (c.control === 'manual' && !held(pause,this.clock())) {
          const next = this.invalidate({ ...c,control:'assistant_allowed',pause },false); this.queueCatchUp(next);
        } else this.store.saveConversation({ ...c,pause });
      }
      return this.store.duePauses(this.accountId,this.clock()).flatMap(c => {
        const messageId = c.pause?.catchUpMessageId;
        return c.control === 'assistant_allowed' && messageId ? [{ conversationId:c.id,messageId,workflowVersion:c.workflowVersion }] : [];
      });
    });
  }
  finishCatchUp(conversationId: string, messageId: string): void {
    const c = this.conversation(conversationId);
    if (c.pause?.catchUpMessageId === messageId) this.store.saveConversation({ ...c,pause:{ ...c.pause,catchUpMessageId:null } });
  }
  observe(input: Message, verifiedOwner = false): boolean {
    const message = Message.parse(input);
    if (message.accountId !== this.accountId) throw new DomainError('account_mismatch', 403);
    return this.store.transaction(() => {
      let c = this.conversation(message.conversationId);
      if (this.store.messages(this.accountId, c.id).some(m => m.transportId === message.transportId)) return false;
      const echo = this.store.outboxes(this.accountId, c.id).some(o => o.components.some(p => p.transportId === message.transportId));
      if (message.direction === 'outbound' && echo) return false;
      if (message.direction === 'outbound') {
        message.authorship = verifiedOwner ? 'owner_written' : 'unknown';
        if (message.source === 'live') {
          c = this.takeOver(c);
          if (verifiedOwner) { this.ownerSent(c,message.occurredAt,!!message.text.trim() || message.media?.kind === 'image' || message.media?.kind === 'audio'); c = this.conversation(c.id); }
        }
      } else c = this.invalidate(c, false);
      this.store.saveMessage(message);
      if (message.direction === 'inbound' || verifiedOwner) this.store.saveConversation({ ...c,
        lastHumanActivityAt: Math.max(c.lastHumanActivityAt, message.occurredAt) });
      return true;
    });
  }
  context(conversationId: string) {
    const c = this.conversation(conversationId);
    return buildContext(c, this.accountId, this.store.messages(this.accountId, c.id), [], 8000, this.clock());
  }
  private targets(c: Conversation, action: OwnerAction, quotedMessageId: string | null = null): void {
    const messages = this.store.messages(this.accountId, c.id);
    if ('quotedMessageId' in action && action.quotedMessageId && quotedMessageId && action.quotedMessageId !== quotedMessageId)
      throw new DomainError('quote_conflict',422);
    quotedMessageId ??= 'quotedMessageId' in action ? action.quotedMessageId ?? null : null;
    if (quotedMessageId && !('text' in action) && action.kind !== 'image' && action.kind !== 'audio') throw new DomainError('quote_requires_text', 422);
    if (quotedMessageId && !messages.some(m => m.id === quotedMessageId)) throw new DomainError('invalid_quote', 422);
    if (action.kind === 'text_sequence') {
      for (const part of action.messages) if (part.quotedMessageId && !messages.some(m => m.id === part.quotedMessageId)) throw new DomainError('invalid_quote',422);
    }
    if ('reaction' in action && !messages.some(m => m.id === action.reaction.targetMessageId)) throw new DomainError('invalid_reaction_target', 422);
  }
  private checkAudioSources(c:Conversation,ids:string[]):void {
    for(const id of ids){
      const message=this.store.message(this.accountId,id);const media=message?.media;
      if(message?.conversationId!==c.id || media?.kind!=='audio' || media.viewOnce || media.access!=='available'
        || media.expiresAt!==null && media.expiresAt<=this.clock())throw new DomainError('audio_source_unavailable',410);
    }
  }
  createDraft(conversationId: string, proposed: Action, expectedVersion: number, requestId: string, audioSourceIds:string[] = []): Draft {
    const action = Action.parse(proposed);
    return this.request(requestId, { operation: 'draft', conversationId, action, expectedVersion, ...(audioSourceIds.length ? {audioSourceIds} : {}) }, Draft, () => {
      let c = this.conversation(conversationId);
      if (!aiAccess(c, this.accountId) || c.control === 'manual') throw new DomainError('ai_access_denied', 403);
      if (c.workflowVersion !== expectedVersion) throw new DomainError('stale_workflow');
      this.targets(c, action);this.checkAudioSources(c,audioSourceIds);
      const trigger = this.store.messages(this.accountId, c.id).filter(m => m.direction === 'inbound').sort((a,b) => b.occurredAt-a.occurredAt)[0];
      if (!trigger) throw new DomainError('no_inbound_message', 422);
      if (action.kind === 'handover') c = this.takeOver(c,true);
      const draft = Draft.parse({ id: randomUUID(), accountId: this.accountId, conversationId, triggerMessageId: trigger.id,
        workflowVersion: c.workflowVersion, policyVersion: c.policyVersion, revision: 1, action, ...(audioSourceIds.length ? {audioSourceIds} : {}),
        state: action.kind === 'handover' ? 'needs_owner' : action.kind === 'silence' ? 'dismissed' : 'pending',
        createdAt: this.clock(), handoverAt: action.kind === 'handover' ? this.clock() : null, edited: false });
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
      if (action.kind === 'handover') c = this.takeOver(c,true);
      const next: Draft = { ...draft, action, workflowVersion: c.workflowVersion, revision: revision + 1, edited: true, handoverAt: action.kind === 'handover' ? this.clock() : null,
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
      if ((input.kind === 'change_mode' || input.kind === 'configure') && !input.mode) throw new DomainError('mode_required', 422);
      if (input.kind === 'delegate' && c.mode !== 'auto_reply') throw new DomainError('invalid_delegation',422);
      const configured = input.kind === 'configure';
      const delegated = input.kind === 'delegate' || configured && input.mode === 'auto_reply';
      if (configured && input.mode !== 'never_reply' && (c.excluded || c.kind !== 'direct')) throw new DomainError('ai_access_denied',403);
      if(delegated){
        if(input.maxUnits===undefined || input.expiresAt===undefined
          || input.maxUnits!==null && (!Number.isSafeInteger(input.maxUnits) || input.maxUnits<1)
          || input.expiresAt!==null && (!Number.isFinite(input.expiresAt) || input.expiresAt<=this.clock()))throw new DomainError('invalid_delegation',422);
        if((input.maxUnits===null || input.maxUnits>20 || input.expiresAt===null || input.expiresAt>this.clock()+86400000)
          && !input.acknowledgeRisk)throw new DomainError('delegation_warning_required',422);
      }
      const fields = { id: randomUUID(), accountId: this.accountId, conversationId, kind: input.kind,
        mode: input.kind === 'change_mode' || configured ? input.mode : null,
        maxUnits: delegated ? input.maxUnits : null,
        expiresAt: delegated ? input.expiresAt : null, riskAccepted:delegated && input.acknowledgeRisk===true,
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
      if (p.kind === 'resume') {
        const pause = pauseState(c);
        pause.indefinite = false; pause.handover = false; pause.until = null; pause.typingUntil = null;
        c = this.invalidate({ ...c, pause, control: held(pause,this.clock()) ? 'manual' : 'assistant_allowed' },true);
      }
      if((p.kind==='delegate' || p.kind==='configure' && p.mode==='auto_reply')
        && (p.expiresAt!==null && p.expiresAt<=this.clock()))throw new DomainError('invalid_delegation',422);
      if((p.kind==='delegate' || p.kind==='configure' && p.mode==='auto_reply')
        && (p.maxUnits===null || p.maxUnits>20 || p.expiresAt===null || p.expiresAt>this.clock()+86400000)
        && !p.riskAccepted)throw new DomainError('delegation_warning_required',422);
      if (p.kind === 'delegate') {
        if (!aiAccess(c, this.accountId) || c.mode !== 'auto_reply' || c.control === 'manual') throw new DomainError('delegation_denied', 403);
        if (this.store.outboxes(this.accountId, c.id).some(o => o.components.some(part => part.state === 'unknown'))) throw new DomainError('delivery_unknown');
        c = this.invalidate(c, true);
        this.store.saveGrant({ id: randomUUID(), accountId: this.accountId, conversationId: c.id,
          expiresAt: p.expiresAt, maxUnits: p.maxUnits, successfulUnits: 0, reservedUnits: 0, state: 'active' });
      }
      if (p.kind === 'configure') {
        if (!p.mode) throw new DomainError('mode_required',422);
        if (p.mode !== 'never_reply' && (c.excluded || c.kind !== 'direct')) throw new DomainError('ai_access_denied',403);
        if (p.mode === 'auto_reply') {
          if (this.store.outboxes(this.accountId,c.id).some(o => o.components.some(part => part.state === 'unknown'))) throw new DomainError('delivery_unknown');
        }
        const pause = pauseState(c);
        pause.indefinite = p.mode === 'never_reply'; pause.handover = false; pause.until = null; pause.typingUntil = null; pause.catchUpMessageId = null;
        c = this.invalidate({ ...c, pause, mode: p.mode, control: held(pause,this.clock()) ? 'manual' : 'assistant_allowed', policyVersion: c.policyVersion+1 },true);
        if (p.mode === 'auto_reply') this.store.saveGrant({ id: randomUUID(), accountId: this.accountId, conversationId: c.id,
          expiresAt: p.expiresAt, maxUnits: p.maxUnits, successfulUnits: 0, reservedUnits: 0, state: 'active' });
      }
      if (p.kind === 'resume' || p.kind === 'configure' || p.kind === 'change_mode') this.resolveHandovers(c.id);
      this.store.saveProposal({ ...p, consumed: true }); return c;
    });
  }
  private queue(c: Conversation, action: OwnerAction, requestId: string, origin: Outbox['origin'], authoredAs: Outbox['authoredAs'], quotedMessageId: string | null, audioSourceIds:string[] = []): Outbox {
    quotedMessageId ??= 'quotedMessageId' in action ? action.quotedMessageId ?? null : null;
    this.targets(c, action, quotedMessageId);
    if (action.kind === 'image') {
      if (origin !== 'owner_manual') throw new DomainError('owner_image_only',403);
      if (!this.store.imageUpload(this.accountId,c.id,action.uploadId)) throw new DomainError('upload_not_found',404);
    }
    if(action.kind==='audio') {
      if(origin!=='owner_manual')throw new DomainError('owner_audio_only',403);
      if(!this.store.audioUpload(this.accountId,c.id,action.uploadId))throw new DomainError('upload_not_found',404);
      const previous=this.store.outboxes(this.accountId,c.id).find(o=>o.components.some(p=>p.kind==='audio' && p.uploadId===action.uploadId && !['failed','cancelled'].includes(p.state)));
      if(previous)throw new DomainError(previous.components.some(p=>p.state==='unknown' || p.state==='dispatching') ? 'delivery_unknown' : 'audio_already_queued');
    }
    const units = actionUnits(action); if (!units) throw new DomainError('no_outbound_action', 422);
    let grant: Grant | undefined;
    if (origin !== 'owner_manual') {
      this.checkAudioSources(c,audioSourceIds);
      if (!aiAccess(c, this.accountId) || c.control === 'manual' || !inPermittedHours(c, this.clock())) throw new DomainError('send_denied', 403);
      if (this.store.outboxes(this.accountId, c.id).some(o => o.components.some(p => p.state === 'unknown'))) throw new DomainError('delivery_unknown');
      grant = this.grant(c.id);
      if (grant && grant.expiresAt!==null && grant.expiresAt <= this.clock()) {
        this.store.saveGrant({ ...grant, state: 'ended' }); grant = undefined;
      }
      if (origin === 'assistant_auto' && (c.mode !== 'auto_reply' || !grant)) throw new DomainError('autonomy_denied', 403);
      if (grant && (grant.expiresAt!==null && grant.expiresAt <= this.clock() || grant.maxUnits!==null && grant.successfulUnits+grant.reservedUnits+units > grant.maxUnits)) throw new DomainError('grant_limit');
      if (grant) this.store.saveGrant({ ...grant, reservedUnits: grant.reservedUnits + units });
    }
    const components: Component[] = [];
    if ('reaction' in action) components.push({ id: randomUUID(), kind: 'reaction', text: null, reaction: action.reaction, state: 'queued', transportId: null });
    if ('text' in action) components.push({ id: randomUUID(), kind: 'text', text: action.text, reaction: null, state: 'queued', transportId: null });
    if (action.kind === 'text_sequence') for (const [index, message] of action.messages.entries()) components.push({
      id: randomUUID(), kind: 'text', text: message.text, reaction: null, state: 'queued', transportId: null,
      quotedMessageId: message.quotedMessageId ?? null, delayAfterPreviousMs: index ? 5000 : 0, dueAt: index ? null : this.clock(),
    });
    if (action.kind === 'image') components.push({ id: randomUUID(), kind:'image', uploadId:action.uploadId, text:action.caption, reaction:null, state:'queued', transportId:null });
    if(action.kind==='audio')components.push({id:randomUUID(),kind:'audio',uploadId:action.uploadId,text:null,reaction:null,state:'queued',transportId:null});
    const outbox = Outbox.parse({ id: randomUUID(), accountId: this.accountId, conversationId: c.id, requestId,
      workflowVersion: c.workflowVersion, policyVersion: c.policyVersion, action, origin, authoredAs, ...(audioSourceIds.length ? {audioSourceIds} : {}),
      state: 'queued', components, quotedMessageId, grantId: grant?.id ?? null, units, transportId: null, createdAt: this.clock() });
    this.store.saveOutbox(outbox); return outbox;
  }
  approve(id: string, revision: number, requestId: string): Outbox {
    return this.request(requestId, { operation: 'approve', id, revision }, Outbox, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      const c = this.conversation(draft.conversationId);
      if (draft.state !== 'pending' || draft.revision !== revision || draft.workflowVersion !== c.workflowVersion || draft.policyVersion !== c.policyVersion) throw new DomainError('stale_draft');
      const outbox = this.queue(c, draft.action, requestId, 'assistant_approved', draft.edited ? 'owner_edited_assistant' : 'assistant_written', null, draft.audioSourceIds);
      this.store.saveDraft({ ...draft, state: 'approved' }); return outbox;
    });
  }
  autoSend(id: string, requestId: string): Outbox {
    return this.request(requestId, { operation: 'auto', id }, Outbox, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      const c = this.conversation(draft.conversationId);
      if (draft.state !== 'pending' || draft.workflowVersion !== c.workflowVersion || draft.policyVersion !== c.policyVersion) throw new DomainError('stale_draft');
      const outbox = this.queue(c, draft.action, requestId, 'assistant_auto', 'assistant_written', null, draft.audioSourceIds);
      this.store.saveDraft({ ...draft, state: 'approved' }); return outbox;
    });
  }
  manualSend(conversationId: string, proposed: OwnerAction, requestId: string, quotedMessageId: string | null = null): Outbox {
    const action = OwnerAction.parse(proposed);
    return this.request(requestId, { operation: 'manual', conversationId, action, quotedMessageId }, Outbox,
      () => this.queue(this.takeOver(this.conversation(conversationId)), action, requestId, 'owner_manual', 'owner_written', quotedMessageId));
  }
  private fresh(outbox: Outbox): void {
    const c = this.conversation(outbox.conversationId);
    if (outbox.origin === 'owner_manual') {
      if (outbox.action.kind === 'text_sequence' && c.workflowVersion !== outbox.workflowVersion) throw new DomainError('stale_delivery');
      return;
    }
    this.checkAudioSources(c,outbox.audioSourceIds ?? []);
    if (this.store.outboxes(this.accountId, c.id).some(other => other.id !== outbox.id && other.components.some(p => p.state === 'unknown'))) throw new DomainError('delivery_unknown');
    if (!aiAccess(c, this.accountId) || c.control === 'manual' || !inPermittedHours(c, this.clock())
      || c.workflowVersion !== outbox.workflowVersion || c.policyVersion !== outbox.policyVersion) throw new DomainError('stale_delivery');
    if (outbox.grantId) {
      const g = this.store.grants(this.accountId, c.id).find(g => g.id === outbox.grantId);
      if (!g || g.state !== 'active' || g.expiresAt!==null && g.expiresAt <= this.clock()) throw new DomainError('grant_expired');
    }
  }
  async dispatch(id: string, handoff: (component: Component) => Promise<TransportResult>, options: DispatchOptions = {}): Promise<Outbox> {
    const outbox = this.store.outbox(this.accountId, id);
    if (!outbox) throw new DomainError('outbox_not_found', 404);
    const key = outbox.conversationId;
    const previous = this.lanes.get(key) ?? Promise.resolve();
    const run = previous.then(() => this.dispatchInLane(id, handoff, options));
    const settled = run.then(() => {}, () => {}); this.lanes.set(key, settled);
    try { return await run; } finally { if (this.lanes.get(key) === settled) this.lanes.delete(key); }
  }
  private async dispatchInLane(id: string, handoff: (component: Component) => Promise<TransportResult>, options: DispatchOptions): Promise<Outbox> {
    const wake = new AbortController();
    const abort = () => wake.abort();
    const conversationId = this.store.outbox(this.accountId,id)?.conversationId;
    const unsubscribe = this.onChange(chat => { if (chat === conversationId) abort(); });
    options.signal?.addEventListener('abort',abort,{once:true});
    if (options.signal?.aborted) abort();
    try {
      for (;;) {
        const pending = this.store.outbox(this.accountId,id)?.components.find(c => c.state === 'queued');
        if (pending?.dueAt && pending.dueAt > this.clock() && !wake.signal.aborted) {
          const outbox = this.store.outbox(this.accountId,id);
          const grant = outbox?.grantId ? this.store.grants(this.accountId,outbox.conversationId).find(g => g.id === outbox.grantId) : undefined;
          // Expiry can end a gap before the next component is due, without polling.
          const quoteId = pending.quotedMessageId !== undefined ? pending.quotedMessageId : outbox?.quotedMessageId;
          const expiries = [grant?.expiresAt,quoteId ? this.store.message(this.accountId,quoteId)?.media?.expiresAt : null,
            ...(outbox?.audioSourceIds ?? []).map(source => this.store.message(this.accountId,source)?.media?.expiresAt)];
          const deadline = Math.min(pending.dueAt,...expiries.filter((at): at is number => at != null));
          try { await this.sleep(Math.max(0,deadline - this.clock()),wake.signal); } catch { abort(); }
        }
        const part = this.store.transaction(() => {
          const outbox = this.store.outbox(this.accountId, id);
          if (!outbox) throw new DomainError('outbox_not_found', 404);
          const component = outbox.components.find(c => c.state === 'queued');
          if (!component || outbox.components.some(c => c.state === 'unknown')) return undefined;
          try {
            if (wake.signal.aborted) throw new DomainError('delivery_cancelled');
            options.check?.(); this.fresh(outbox);
            if (component.dueAt && component.dueAt > this.clock()) throw new DomainError('delivery_not_due');
            const quoteId = component.quotedMessageId !== undefined ? component.quotedMessageId : outbox.quotedMessageId;
            if (quoteId) {
              const quote = this.store.message(this.accountId,quoteId);
              const raw = quote && this.store.waMessage(this.accountId,outbox.conversationId,quote.transportId);
              if (!quote || quote.conversationId !== outbox.conversationId || quote.media?.viewOnce
                || quote.media?.expiresAt != null && quote.media.expiresAt <= this.clock()
                || raw && z.object({deleted:z.literal(true)}).safeParse(JSON.parse(raw)).success) throw new DomainError('invalid_quote',422);
            }
          } catch (error) {
            if (!(error instanceof DomainError)) throw error;
            for (const p of outbox.components) if (p.state === 'queued') this.release(outbox, p, 'cancelled');
            outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox); return undefined;
          }
          component.state = 'dispatching'; outbox.state = 'dispatching'; this.store.saveOutbox(outbox); return component;
        });
        if (!part) break;
        const reactionBefore=part.reaction ? this.store.message(this.accountId,part.reaction.targetMessageId)?.observedReactions?.filter(r=>r.actor==='owner' || r.actor==='assistant').at(-1)?.transportId : undefined;
        const handoffAt=this.clock();
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
            const next = outbox.components.find(p => p.state === 'queued');
            if (next?.delayAfterPreviousMs) next.dueAt = this.clock() + next.delayAfterPreviousMs;
            if (component.kind === 'audio' || (component.kind === 'text' || component.kind === 'image') && component.text !== null) {
              const audio = component.kind==='audio' && component.uploadId ? this.store.audioUpload(this.accountId,outbox.conversationId,component.uploadId) : undefined;
              const upload = component.kind==='image' && component.uploadId ? this.store.imageUpload(this.accountId,outbox.conversationId,component.uploadId) : undefined;
              const raw=this.store.waMessage(this.accountId,outbox.conversationId,result.transportId);
              const deleted=!!raw && z.object({deleted:z.literal(true)}).safeParse(JSON.parse(raw)).success;
              const messageId=randomUUID();
              this.store.saveMessage({ id: messageId, accountId: this.accountId, conversationId: outbox.conversationId,
                transportId: result.transportId, direction: 'outbound', authorship: outbox.authoredAs, text: deleted ? '[Message deleted]' : component.text ?? '',
                occurredAt: this.clock(), source: 'live', quotedMessageId: component.quotedMessageId !== undefined ? component.quotedMessageId : outbox.quotedMessageId,
                statusReply: false, statusContext: null, media: !deleted && audio ? {kind:'audio',access:'available',fixture:null,description:'Owner voice note',viewOnce:false,expiresAt:null,mime:audio.mime,duration:audio.duration} : !deleted && upload ? {kind:'image',access:'available',fixture:null,
                  description:'Owner image',viewOnce:false,expiresAt:null,mime:upload.mime,width:upload.width,height:upload.height} : null, reaction: null });
            } else if (component.reaction) {
              const target = this.store.messages(this.accountId, outbox.conversationId).find(m => m.id === component.reaction?.targetMessageId);
              const currentReaction=target?.observedReactions?.filter(r=>r.actor==='owner' || r.actor==='assistant').at(-1);
              if(target && (!currentReaction || currentReaction.transportId===reactionBefore || currentReaction.transportId===result.transportId)) {
                const actor = outbox.origin === 'owner_manual' ? 'owner' : 'assistant';
                this.store.saveMessage({ ...target, reaction:component.reaction.emoji,
                  observedReactions:[...(target.observedReactions ?? []).filter(r => r.actor!=='owner' && r.actor!=='assistant'),
                    {actor,actorId:'account',transportId:result.transportId,emoji:component.reaction.emoji,occurredAt:handoffAt,source:'live'}] });
              }
            }
          } else for (const pending of outbox.components) if (pending.state === 'queued') this.release(outbox, pending, 'cancelled');
          outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox);
          if(result.state === 'accepted' && outbox.origin === 'owner_manual')this.ownerSent(this.conversation(outbox.conversationId),this.clock(),component.kind === 'text' || component.kind === 'image' || component.kind === 'audio');
        });
      }
      return this.store.transaction(() => {
        const outbox = this.store.outbox(this.accountId, id);
        if (!outbox) throw new DomainError('outbox_not_found', 404);
        const c = this.conversation(outbox.conversationId);
        if (outbox.state === 'accepted' && outbox.origin === 'owner_manual') {
          this.store.saveConversation({ ...c, lastHumanActivityAt: Math.max(c.lastHumanActivityAt, outbox.createdAt) });
        }
        if ((outbox.state === 'failed' || outbox.state === 'cancelled' && outbox.action.kind === 'text_sequence') && outbox.origin === 'owner_manual') {
          const current = this.conversation(c.id); const pause = pauseState(current); pause.sending = false;
          this.store.saveConversation({ ...current, pause });
        }
        if (outbox.components.some(p => p.state === 'accepted') && outbox.origin !== 'owner_manual' && c.workflowVersion === outbox.workflowVersion) this.invalidate(c, false);
        return outbox;
      });
    } finally {
      unsubscribe(); options.signal?.removeEventListener('abort',abort);
    }
  }
  recover(): void {
    this.store.transaction(() => {
      const handedOver = new Set(this.store.drafts(this.accountId).filter(d => d.state === 'needs_owner').map(d => d.conversationId));
      for (const id of handedOver) {
        const c = this.conversation(id);
        if (c.control === 'assistant_allowed') this.resolveHandovers(c.id);
        else {
          const ownerReply = this.store.messages(this.accountId,c.id).filter(m => m.direction === 'outbound' && m.authorship === 'owner_written' && m.source === 'live' && (m.text.trim() || m.media?.kind === 'image' || m.media?.kind === 'audio')).sort((a,b) => b.occurredAt-a.occurredAt)[0];
          if (ownerReply) this.resolveHandovers(c.id,ownerReply.occurredAt);
        }
      }
      for (const outbox of this.store.outboxes(this.accountId)) {
        for (const component of outbox.components) {
          if (component.state === 'dispatching') component.state = 'unknown';
          else if (component.state === 'queued' && outbox.action.kind === 'text_sequence') this.release(outbox,component,'cancelled');
        }
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
