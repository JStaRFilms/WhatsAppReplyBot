import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { setTimeout as wait } from 'node:timers/promises';
import { Action, Component, Conversation, DomainError, Draft, Grant, Message, Outbox, Proposal, Snapshot, OwnerAction, ImageUpload, AudioUpload, ReactionObservation, actionUnits, normalizeGeneratedAction, type NameSource } from './contracts.ts';
import { aiAccess, inPermittedHours } from './policy.ts';
import { buildContext } from './context.ts';
import { partialMessage, automaticTrigger } from './history.ts';
import { held, OWNER_COOLDOWN, pauseState } from './pause.ts';
import { SqliteStore, type HistoryRead } from './store.ts';
import { OwnerInstructions, OwnerInstructionsInput, ContactNameSettings, ContactNamesInput, ContactNamesImportInput, ContactNamesImportResult } from './api.ts';

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
  private suspended = false;
  private readonly lanes = new Map<string, Promise<void>>();
  hasActiveHandoff(): boolean {
    return this.store.outboxes(this.accountId).some(o => o.components.some(p => p.state === 'dispatching'));
  }
  async drain(): Promise<void> { await Promise.allSettled(this.lanes.values()); }
  suspendAccount(freeze = true): void {
    if (this.hasActiveHandoff()) throw new DomainError('profile_handoff_active', 409);
    this.suspended = freeze;
    this.store.transaction(() => {
      this.store.saveModelConsent(this.accountId, false);
      this.store.clearComposers(this.accountId);
      for (const c of this.store.conversations(this.accountId)) {
        const pause = pauseState(c);
        pause.indefinite = true; pause.composing = false; pause.typingUntil = null;
        pause.until = null; pause.catchUpMessageId = null; pause.sending = false;
        this.invalidate({ ...c, control: 'manual', pause }, true);
      }
      // invalidate deliberately preserves manual work during ordinary owner actions.
      // A profile transition instead cancels every unsent component, regardless of origin.
      for (const outbox of this.store.outboxes(this.accountId)) {
        for (const part of outbox.components) if (part.state === 'queued') this.release(outbox, part, 'cancelled');
        outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox);
      }
    });
  }
  private readonly changes = new Set<(conversationId: string, aiOnly?: boolean) => void>();
  constructor(readonly store: SqliteStore, readonly accountId: string, private readonly clock = Date.now,
    private readonly sleep = (ms: number, signal: AbortSignal): Promise<void> => wait(ms, undefined, { signal })) {
    this.store.transaction(() => {
      if (this.store.releaseContextVersion(accountId) >= 1) return;
      const affected = new Set([
        ...this.store.drafts(accountId).filter(draft => draft.state === 'pending').map(draft => draft.conversationId),
        ...this.store.outboxes(accountId).filter(outbox => outbox.origin !== 'owner_manual' && outbox.components.some(part => part.state === 'queued')).map(outbox => outbox.conversationId),
      ]);
      for (const id of affected) this.invalidate(this.conversation(id),false,true);
      this.store.saveReleaseContextVersion(accountId,1);
    });
    this.store.transaction(() => {
      this.store.mediaCacheId(accountId);
      if (this.store.historyProjectionVersion(accountId) >= 1) return;
      for (const c of this.store.conversations(accountId)) {
        const group = this.store.historyGroup(accountId,c.id);
        if (group.id !== c.id) continue;
        this.store.bumpHistory(accountId,c.id,true);
        if (group.memberIds.length > 1) this.invalidate(c,false,true);
      }
      this.store.saveHistoryProjectionVersion(accountId);
    });
  }
  onChange(listener: (conversationId: string, aiOnly?: boolean) => void): () => void {
    this.changes.add(listener);
    return () => { this.changes.delete(listener); };
  }
  conversation(id: string): Conversation {
    const c = this.store.conversation(this.accountId, id);
    if (!c) throw new DomainError('conversation_not_found', 404);
    return c;
  }
  effectiveConversation(id: string, read?: HistoryRead): Conversation {
    const group = this.store.historyGroup(this.accountId,id,read);
    const conversation = (member:string) => {
      if (!read) return this.conversation(member);
      const c = read.conversations.get(member);
      if (!c) throw new DomainError('conversation_not_found',404);
      return c;
    };
    const c = conversation(group.id);
    const members = group.memberIds.map(conversation);
    const mode = members.some(m => m.mode === 'never_reply') ? 'never_reply'
      : members.some(m => m.mode === 'draft_only') ? 'draft_only' : c.mode;
    const blocked = members.some(m => m.control === 'manual' || held(pauseState(m),this.clock()));
    return {...c,mode,excluded:c.excluded || group.aiBlocked,control:blocked?'manual':c.control,
      lastHumanActivityAt:Math.max(...members.map(m => m.lastHumanActivityAt)),
      // An invalid hours rule denies through the existing shared hours evaluator.
      hours:members.every(m => inPermittedHours(m,this.clock())) ? c.hours : {timezone:'invalid',start:0,end:0}};
  }
  effectiveConversations(read = this.store.historyRead(this.accountId), outboxes = this.store.outboxes(this.accountId)): Conversation[] {
    const unknown = new Set(outboxes.filter(o=>o.components.some(p=>p.state==='unknown' || p.state==='dispatching')).map(o=>o.conversationId));
    return [...read.conversations.values()].filter(c => this.store.historyGroup(this.accountId,c.id,read).id === c.id)
      .map(c => {
        const effective = this.effectiveConversation(c.id,read);
        return this.store.historyGroup(this.accountId,c.id,read).memberIds.some(id=>unknown.has(id))
          ? {...effective,control:'manual' as const} : effective;
      });
  }
  assertFreshAction(id: string): void {
    if (this.store.historyGroup(this.accountId,id).id !== id) throw new DomainError('retired_alias_read_only');
  }
  verifyAlias(alias: string, canonical: string): void {
    this.store.transaction(() => {
      if (this.store.waCanonical(this.accountId,alias) === canonical) return;
      const original = this.store.conversation(this.accountId,alias);
      if (original) {
        const target = this.conversation(canonical);
        for (const c of [original,target]) {
          const pause = pauseState(c); pause.indefinite = true; pause.catchUpMessageId = null;
          this.invalidatePhysical({...c,control:'manual',pause},true);
          let cancelledOwner=false;
          for (const outbox of this.store.outboxes(this.accountId,c.id)) {
            if (outbox.origin === 'owner_manual' && c.id !== alias) continue;
            if (outbox.origin === 'owner_manual' && outbox.components.some(p=>p.state==='queued')) cancelledOwner=true;
            for (const part of outbox.components) if (part.state === 'queued') this.release(outbox,part,'cancelled');
            outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox);
          }
          if (cancelledOwner && !this.store.outboxes(this.accountId,c.id).some(o=>o.components.some(p=>['queued','dispatching','unknown'].includes(p.state)))) {
            const current=this.conversation(c.id);
            this.store.saveConversation({...current,pause:{...pauseState(current),sending:false}});
          }
        }
      }
      this.store.saveWaAlias(this.accountId,alias,canonical);
      if (original) this.store.mergeReleaseContext(this.accountId,alias,canonical);
    });
    if (this.store.conversation(this.accountId,canonical)) this.refreshContactName(canonical);
  }
  groupUnknown(id: string, except?: string): boolean {
    const members = this.store.historyGroup(this.accountId,id).memberIds;
    return this.store.outboxes(this.accountId).some(o => members.includes(o.conversationId) && o.id !== except
      && o.components.some(p => p.state === 'unknown' || p.state === 'dispatching'));
  }
  private resumeMembers(id: string, changingMode = false): void {
    const group = this.store.historyGroup(this.accountId,id);
    const blocked = group.memberIds.some(member => {
      const c = this.conversation(member);
      return c.excluded || c.mode === 'never_reply' && !(changingMode && member === id)
        || c.kind !== 'direct' && !(c.kind === 'unknown' && member !== group.id && /^\d+@lid$/.test(member));
    });
    if (blocked) throw new DomainError(group.memberIds.length > 1 ? 'alias_policy_restricted' : 'ai_access_denied',group.memberIds.length > 1 ? 409 : 403);
    if (this.groupUnknown(id)) throw new DomainError('delivery_unknown');
    for (const member of group.memberIds) {
      const c = this.conversation(member); const pause = pauseState(c);
      if (pause.composing || this.store.hasComposer(this.accountId,member)) throw new DomainError('composer_has_text');
      if (pause.sending) throw new DomainError('delivery_unknown');
    }
    for (const member of group.memberIds) {
      if (member === id) continue;
      const c = this.conversation(member); const pause = pauseState(c);
      pause.indefinite = false; pause.handover = false; pause.until = null; pause.typingUntil = null; pause.catchUpMessageId = null;
      this.store.saveConversation({...c,control:'assistant_allowed',pause});
    }
  }
  private aliasPermission(id: string, mode: Conversation['mode']): void {
    const group = this.store.historyGroup(this.accountId,id);
    if (mode === 'never_reply') return;
    if (group.memberIds.some(member => member !== id && (() => {
      const c = this.conversation(member);
      return c.excluded || c.mode === 'never_reply' || mode === 'auto_reply' && c.mode === 'draft_only';
    })())) throw new DomainError('alias_policy_restricted');
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
      const source = this.store.historySource(this.accountId,c.id,targetMessageId,this.clock());
      const target = source?.message;
      if (!target || source.state !== 'available') throw new DomainError('invalid_reaction_target',422);
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
    if (this.suspended) throw new DomainError('profile_transition_in_progress', 409);
    if (!requestId || requestId.length > 128) throw new DomainError('invalid_request_id', 422);
    return this.store.transaction(() => {
      const saved = this.store.request(this.accountId, requestId);
      const payloadHash = hash(payload);
      if (saved) {
        if (saved.hash !== payloadHash) throw new DomainError('request_id_conflict');
        return schema.parse(saved.result);
      }
      const scoped = z.object({operation:z.string(),conversationId:z.string().optional(),id:z.string().optional()}).safeParse(payload);
      if (scoped.success && scoped.data.operation !== 'viewed-messages') {
        const {conversationId,id,operation:kind} = scoped.data;
        const chat = conversationId ?? (id ? (kind === 'confirm' ? this.store.proposal(this.accountId,id)
          : this.store.draft(this.accountId,id))?.conversationId : undefined);
        if (chat) this.assertFreshAction(chat);
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
      // Account-wide invalidation already visits every physical alias.
      for (const c of this.store.conversations(this.accountId)) this.invalidatePhysical(c, true);
      return { consent };
    });
  }
  setOwnerInstructions(input: z.infer<typeof OwnerInstructionsInput>): OwnerInstructions {
    const body = OwnerInstructionsInput.parse(input);
    return this.request(body.requestId,{operation:'owner-instructions',...body},OwnerInstructions,() => {
      const current = this.store.ownerInstructions(this.accountId);
      if (current.revision !== body.expectedRevision) throw new DomainError('owner_instructions_changed');
      if (current.text === body.text) return current;
      const next = {text:body.text,revision:current.revision+1};
      this.store.saveOwnerInstructions(this.accountId,next);
      for (const c of this.store.conversations(this.accountId)) this.invalidatePhysical(c,false,true);
      return next;
    });
  }
  setContactNames(input: z.infer<typeof ContactNamesInput>): ContactNameSettings {
    const body = ContactNamesInput.parse(input);
    return this.request(body.requestId,{operation:'contact-names',...body},ContactNameSettings,() => {
      const current = this.store.contactNameSettings(this.accountId);
      if (current.revision !== body.expectedRevision) throw new DomainError('contact_names_changed');
      if (current.enabled && body.enabled) return current;
      const next = current.enabled === body.enabled ? current
        : {...current,enabled:body.enabled,revision:current.revision+1,lastPhoneSyncAt:null,lastPhoneImportRequestId:null};
      this.store.saveContactNameSettings(this.accountId,next);
      if (!next.enabled) {
        this.store.clearContactNames(this.accountId,'wa_saved');
        this.store.clearContactNames(this.accountId,'phone_matched');
      }
      for (const c of this.store.conversations(this.accountId)) this.resolveContactName(c);
      return next;
    });
  }
  importContactNames(input: z.infer<typeof ContactNamesImportInput>): z.infer<typeof ContactNamesImportResult> {
    const body = ContactNamesImportInput.parse(input);
    return this.request(body.requestId,{operation:'contact-names-import',...body},ContactNamesImportResult,() => {
      const current = this.store.contactNameSettings(this.accountId);
      if (current.revision !== body.expectedRevision) throw new DomainError('contact_names_changed');
      if (!current.enabled) throw new DomainError('contact_names_disabled');
      const ids = new Set<string>();
      for (const entry of body.entries) {
        const c = this.conversation(entry.conversationId);
        if (ids.has(c.id) || c.kind !== 'direct' || !/^\d+@s\.whatsapp\.net$/.test(c.id)
          || this.store.waCanonical(this.accountId,c.id) !== c.id) throw new DomainError('invalid_contact_match',422);
        ids.add(c.id);
      }
      this.store.clearContactNames(this.accountId,'phone_matched');
      for (const entry of body.entries) this.store.saveContactName(this.accountId,entry.conversationId,'phone_matched',entry.name,this.clock(),body.requestId);
      for (const c of this.store.conversations(this.accountId)) this.resolveContactName(c);
      const settings = {...current,revision:current.revision+1,lastPhoneSyncAt:this.clock(),lastPhoneImportRequestId:body.requestId};
      this.store.saveContactNameSettings(this.accountId,settings);
      return {settings};
    });
  }
  observeContactNames(conversationId: string, names: Partial<Record<'wa_saved'|'wa_notify'|'wa_verified', string|null>>): void {
    this.store.transaction(() => {
      const c = this.store.conversation(this.accountId,conversationId);
      if (!c || c.kind !== 'direct' || !/^\d+@s\.whatsapp\.net$/.test(c.id) || this.store.waCanonical(this.accountId,c.id) !== c.id) return;
      for (const source of ['wa_saved','wa_notify','wa_verified'] as const) {
        const name = names[source];
        if (name === undefined || source === 'wa_saved' && !this.store.contactNameSettings(this.accountId).enabled) continue;
        if (name && !ContactNamesImportInput.shape.entries.element.shape.name.safeParse(name).success) continue;
        this.store.saveContactName(this.accountId,c.id,source,name ?? '',this.clock());
      }
      this.resolveContactName(c);
    });
  }
  refreshContactName(conversationId: string): void {
    this.store.transaction(() => this.resolveContactName(this.conversation(conversationId)));
  }
  private resolveContactName(c: Conversation): void {
    if (c.kind !== 'direct' || !/^\d+@s\.whatsapp\.net$/.test(c.id) || this.store.waCanonical(this.accountId,c.id) !== c.id) return;
    const enabled = this.store.contactNameSettings(this.accountId).enabled;
    const rows = this.store.contactNames(this.accountId,c.id);
    const priority: NameSource[] = enabled ? ['wa_saved','phone_matched','wa_notify','wa_verified'] : ['wa_notify','wa_verified'];
    const selected = priority.map(source => rows.find(row => row.source === source)).find(row => row !== undefined);
    const name = selected?.name ?? (c.id.endsWith('@s.whatsapp.net') ? c.id.split('@')[0] ?? 'Unknown contact' : 'Unknown contact');
    const nameSource = selected?.source ?? (c.id.endsWith('@s.whatsapp.net') ? 'number' : 'unknown');
    if (c.name === name && c.nameSource === nameSource) return;
    this.invalidate({...c,name,nameSource,nameRevision:(c.nameRevision ?? 0)+1},false,true);
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
  private invalidate(c: Conversation, revokeGrant: boolean, aiOnly = false): Conversation {
    for (const id of this.store.historyGroup(this.accountId,c.id).memberIds) {
      if (id !== c.id) this.invalidatePhysical(this.conversation(id),revokeGrant,aiOnly);
    }
    return this.invalidatePhysical(c,revokeGrant,aiOnly);
  }
  private invalidatePhysical(c: Conversation, revokeGrant: boolean, aiOnly = false): Conversation {
    const next = { ...c, workflowVersion: c.workflowVersion + 1 };
    this.store.saveConversation(next);
    for (const draft of this.store.drafts(this.accountId, c.id)) {
      if (draft.state === 'pending') this.store.saveDraft({ ...draft, state: 'stale' });
    }
    for (const outbox of this.store.outboxes(this.accountId, c.id)) {
      if (outbox.origin === 'owner_manual') {
        // Context changes must not interrupt a current owner-authored sequence.
        // Already-stale manual work stays stale after unrelated authority changes.
        if (aiOnly && outbox.action.kind === 'text_sequence' && outbox.components.some(part => part.state === 'queued') && outbox.workflowVersion === c.workflowVersion) this.store.saveOutbox({...outbox,workflowVersion:next.workflowVersion});
        continue;
      }
      for (const part of outbox.components) if (part.state === 'queued') this.release(outbox, part, 'cancelled');
      outbox.state = outboxState(outbox.components); this.store.saveOutbox(outbox);
    }
    if (revokeGrant) for (const g of this.store.grants(this.accountId, c.id)) {
      if (g.state === 'active') this.store.saveGrant({ ...g, state: 'revoked' });
    }
    for (const listener of this.changes) listener(c.id,aiOnly);
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
        this.resumeMembers(c.id);
        if (!aiAccess(this.effectiveConversation(c.id),this.accountId)) throw new DomainError('ai_access_denied',403);
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
    const messages = this.store.recentMessages(this.accountId,c.id,100,this.clock());
    const last = messages.at(-1);
    const pause = pauseState(c);
    pause.catchUpMessageId = last?.direction === 'inbound' && last.source === 'live' && automaticTrigger(last) && !this.store.drafts(this.accountId,c.id).some(d => d.triggerMessageId === last.id && d.state === 'pending') ? last.id : null;
    this.store.saveConversation({ ...c,pause });
  }
  expirePauses(): { conversationId: string; messageId: string; workflowVersion:number }[] {
    return this.store.transaction(() => {
      for (const c of this.store.duePauses(this.accountId,this.clock())) {
        if (this.store.historyGroup(this.accountId,c.id).id !== c.id) continue;
        const pause = pauseState(c);
        if (pause.until !== null && pause.until <= this.clock()) pause.until = null;
        if (pause.typingUntil !== null && pause.typingUntil <= this.clock()) pause.typingUntil = null;
        if (c.control === 'manual' && !held(pause,this.clock())) {
          const next = this.invalidate({ ...c,control:'assistant_allowed',pause },false); this.queueCatchUp(next);
        } else this.store.saveConversation({ ...c,pause });
      }
      return this.store.duePauses(this.accountId,this.clock()).flatMap(c => {
        const messageId = c.pause?.catchUpMessageId;
        return this.store.historyGroup(this.accountId,c.id).id === c.id && this.effectiveConversation(c.id).control === 'assistant_allowed' && messageId ? [{ conversationId:c.id,messageId,workflowVersion:c.workflowVersion }] : [];
      });
    });
  }
  finishCatchUp(conversationId: string, messageId: string): void {
    const c = this.conversation(conversationId);
    if (c.pause?.catchUpMessageId === messageId) this.store.saveConversation({ ...c,pause:{ ...c.pause,catchUpMessageId:null } });
  }
  observe(input: Message, verifiedOwner = false, rawPayload?: string): boolean {
    const message = Message.parse(input);
    if (message.accountId !== this.accountId) throw new DomainError('account_mismatch', 403);
    return this.store.transaction(() => {
      let c = this.conversation(message.conversationId);
      if (this.store.eventMessages(this.accountId,c.id,message.transportId).length) return false;
      const echo = this.store.outboxes(this.accountId, c.id).some(o => o.components.some(p => p.transportId === message.transportId));
      if (message.direction === 'outbound' && echo) return false;
      if (message.direction === 'outbound') {
        message.authorship = verifiedOwner ? 'owner_written' : 'unknown';
        if (message.source === 'live' && !partialMessage(message)) {
          c = this.takeOver(c);
          if (verifiedOwner) { this.ownerSent(c,message.occurredAt,!!message.text.trim() || message.media?.kind === 'image' || message.media?.kind === 'audio'); c = this.conversation(c.id); }
        }
      } else if (!partialMessage(message)) c = this.invalidate(c, false);
      this.store.saveMessage(message);
      if (rawPayload !== undefined) this.store.saveWaMessage(this.accountId,message.conversationId,message.transportId,rawPayload);
      if (!partialMessage(message) && (message.direction === 'inbound' || verifiedOwner)) this.store.saveConversation({ ...c,
        lastHumanActivityAt: Math.max(c.lastHumanActivityAt, message.occurredAt) });
      return true;
    });
  }
  restrictSource(conversationId:string,transportId:string,restriction:'deleted'|'conflict'|'view_once'|'expiry',expiresAt?:number):void {
    this.store.transaction(()=>{
      const group=this.store.historyGroup(this.accountId,conversationId);
      for(const id of group.memberIds){
        const payload=this.store.waMessage(this.accountId,id,transportId);
        if(restriction==='deleted')this.store.saveWaMessage(this.accountId,id,transportId,JSON.stringify({deleted:true}));
        else {
          const value=payload ? z.record(z.string(),z.unknown()).parse(JSON.parse(payload)) : {};
          const marker=restriction==='conflict' ? {historyConflict:true} : restriction==='view_once' ? {historyViewOnce:true}
            : {historyExpiresAt:Math.min(typeof value.historyExpiresAt==='number'?value.historyExpiresAt:Infinity,expiresAt ?? 0)};
          this.store.saveWaMessage(this.accountId,id,transportId,JSON.stringify({...value,...marker}));
        }
      }
      if(restriction==='deleted')for(const m of this.store.eventMessages(this.accountId,conversationId,transportId))
        this.store.saveMessage({...m,text:'[Message deleted]',media:null,reaction:null,observedReactions:[]});
      this.store.bumpHistory(this.accountId,conversationId,true);
      for(const id of group.memberIds)this.invalidatePhysical(this.conversation(id),false,true);
    });
  }
  recoverMessage(conversationId: string, input: Message, rawPayload?: string): boolean {
    return this.store.transaction(() => {
      const source = this.store.historySource(this.accountId,conversationId,input.id,this.clock());
      if (!source || source.state !== 'available') return false;
      const previous = source.message;
      if (input.accountId !== this.accountId || input.transportId !== previous.transportId || input.direction !== previous.direction
        || input.occurredAt !== previous.occurredAt || !partialMessage(previous) || partialMessage(input)
        || !input.text.trim() && (!input.media || !['image','sticker','animated_sticker','gif','audio'].includes(input.media.kind))
        || input.media?.access === 'unsupported' || input.media?.viewOnce || input.media?.expiresAt != null && input.media.expiresAt <= this.clock()) return false;
      this.store.saveMessage({...previous,text:input.text,media:input.media,quotedMessageId:previous.quotedMessageId ?? input.quotedMessageId,
        contentState:'complete',contentRecovered:true});
      if (rawPayload !== undefined) this.store.saveWaMessage(this.accountId,previous.conversationId,previous.transportId,rawPayload);
      for (const id of this.store.historyGroup(this.accountId,conversationId).memberIds) {
        const c = this.conversation(id); const pause = pauseState(c);
        if (pause.catchUpMessageId === previous.id) pause.catchUpMessageId = null;
        this.invalidatePhysical({...c,pause},false,true);
      }
      return true;
    });
  }
  viewedMessages(conversationId: string, messageIds: string[], requestId: string): {viewed:true} {
    return this.request(requestId,{operation:'viewed-messages',conversationId,messageIds},z.object({viewed:z.literal(true)}),() => {
      this.conversation(conversationId); this.store.markViewedMessages(this.accountId,conversationId,messageIds); return {viewed:true};
    });
  }
  context(conversationId: string, transcripts: ReadonlyMap<string,import('./contracts.ts').AudioTranscript> = new Map()) {
    const c = this.effectiveConversation(conversationId);
    if (!inPermittedHours(c,this.clock())) throw new DomainError('ai_access_denied',403);
    const inputs = this.store.contextMessages(this.accountId,c.id,this.clock());
    return buildContext(c,this.accountId,inputs.messages,[],8000,this.clock(),transcripts,
      this.store.modelConsent(this.accountId) ? this.store.ownerInstructions(this.accountId) : undefined,inputs);
  }
  private targets(c: Conversation, action: OwnerAction, quotedMessageId: string | null = null): void {
    const valid = (id: string) => this.store.historySource(this.accountId,c.id,id,this.clock())?.state === 'available';
    if ('quotedMessageId' in action && action.quotedMessageId && quotedMessageId && action.quotedMessageId !== quotedMessageId)
      throw new DomainError('quote_conflict',422);
    quotedMessageId ??= 'quotedMessageId' in action ? action.quotedMessageId ?? null : null;
    if (quotedMessageId && !('text' in action) && action.kind !== 'image' && action.kind !== 'audio') throw new DomainError('quote_requires_text', 422);
    if (quotedMessageId && !valid(quotedMessageId)) throw new DomainError('invalid_quote', 422);
    if (action.kind === 'text_sequence') {
      for (const part of action.messages) if (part.quotedMessageId && !valid(part.quotedMessageId)) throw new DomainError('invalid_quote',422);
    }
    if ('reaction' in action && !valid(action.reaction.targetMessageId)) throw new DomainError('invalid_reaction_target', 422);
  }
  private checkAudioSources(c:Conversation,ids:string[]):void {
    for(const id of ids){
      const source=this.store.historySource(this.accountId,c.id,id,this.clock());const media=source?.message.media;
      if(source?.state!=='available' || media?.kind!=='audio' || media.viewOnce || media.access!=='available'
        || media.expiresAt!==null && media.expiresAt<=this.clock())throw new DomainError('audio_source_unavailable',410);
    }
  }
  createDraft(conversationId: string, proposed: Action, expectedVersion: number, requestId: string, audioSourceIds:string[] = []): Draft {
    const action = normalizeGeneratedAction(proposed);
    return this.request(requestId, { operation: 'draft', conversationId, action, expectedVersion, ...(audioSourceIds.length ? {audioSourceIds} : {}) }, Draft, () => {
      let c = this.conversation(conversationId);
      const effective = this.effectiveConversation(c.id);
      if (!aiAccess(effective, this.accountId) || effective.control === 'manual' || !inPermittedHours(effective,this.clock())) throw new DomainError('ai_access_denied', 403);
      if (c.workflowVersion !== expectedVersion) throw new DomainError('stale_workflow');
      this.targets(c, action);this.checkAudioSources(c,audioSourceIds);
      const trigger = this.store.contextMessages(this.accountId,c.id,this.clock()).messages.filter(m => m.direction === 'inbound').at(-1);
      if (!trigger) throw new DomainError('no_inbound_message', 422);
      if (action.kind === 'handover') c = this.takeOver(c,true);
      const draft = Draft.parse({ id: randomUUID(), accountId: this.accountId, conversationId, triggerMessageId: trigger.id,
        workflowVersion: c.workflowVersion, policyVersion: c.policyVersion, sourceEpoch:this.store.historyGroup(this.accountId,c.id).sourceEpoch, revision: 1, action, ...(audioSourceIds.length ? {audioSourceIds} : {}),
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
      if (!aiAccess(this.effectiveConversation(c.id), this.accountId)) throw new DomainError('ai_access_denied', 403);
      if (draft.state !== 'pending' || draft.revision !== revision || draft.workflowVersion !== c.workflowVersion
        || draft.sourceEpoch !== undefined && draft.sourceEpoch !== this.store.historyGroup(this.accountId,c.id).sourceEpoch) throw new DomainError('stale_draft');
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
      this.aliasPermission(c.id,input.mode ?? c.mode);
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
      this.aliasPermission(c.id,p.mode ?? c.mode);
      if (p.kind === 'change_mode') c = this.invalidate({ ...c, mode: p.mode, policyVersion: c.policyVersion+1 }, true);
      if (p.kind === 'resume') {
        this.resumeMembers(c.id);
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
        const effective = this.effectiveConversation(c.id);
        if (!aiAccess(effective, this.accountId) || effective.mode !== 'auto_reply' || effective.control === 'manual' || !inPermittedHours(effective,this.clock())) throw new DomainError('delegation_denied', 403);
        if (this.groupUnknown(c.id)) throw new DomainError('delivery_unknown');
        c = this.invalidate(c, true);
        this.store.saveGrant({ id: randomUUID(), accountId: this.accountId, conversationId: c.id,
          expiresAt: p.expiresAt, maxUnits: p.maxUnits, successfulUnits: 0, reservedUnits: 0, state: 'active' });
      }
      if (p.kind === 'configure') {
        if (p.mode !== 'never_reply') this.resumeMembers(c.id,true);
        if (!p.mode) throw new DomainError('mode_required',422);
        if (p.mode !== 'never_reply' && (c.excluded || c.kind !== 'direct')) throw new DomainError('ai_access_denied',403);
        if (p.mode === 'auto_reply') {
          if (this.groupUnknown(c.id)) throw new DomainError('delivery_unknown');
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
      const effective = this.effectiveConversation(c.id);
      if (!aiAccess(effective, this.accountId) || effective.control === 'manual' || !inPermittedHours(effective, this.clock())) throw new DomainError('send_denied', 403);
      if (this.groupUnknown(c.id)) throw new DomainError('delivery_unknown');
      grant = this.grant(c.id);
      if (grant && grant.expiresAt!==null && grant.expiresAt <= this.clock()) {
        this.store.saveGrant({ ...grant, state: 'ended' }); grant = undefined;
      }
      if (origin === 'assistant_auto' && (effective.mode !== 'auto_reply' || !grant)) throw new DomainError('autonomy_denied', 403);
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
      workflowVersion: c.workflowVersion, policyVersion: c.policyVersion, ...(origin === 'owner_manual' ? {} : {sourceEpoch:this.store.historyGroup(this.accountId,c.id).sourceEpoch}), action, origin, authoredAs, ...(audioSourceIds.length ? {audioSourceIds} : {}),
      state: 'queued', components, quotedMessageId, grantId: grant?.id ?? null, units, transportId: null, createdAt: this.clock() });
    this.store.saveOutbox(outbox); return outbox;
  }
  approve(id: string, revision: number, requestId: string): Outbox {
    return this.request(requestId, { operation: 'approve', id, revision }, Outbox, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      const c = this.conversation(draft.conversationId);
      if (draft.state !== 'pending' || draft.revision !== revision || draft.workflowVersion !== c.workflowVersion || draft.policyVersion !== c.policyVersion
        || draft.sourceEpoch !== undefined && draft.sourceEpoch !== this.store.historyGroup(this.accountId,c.id).sourceEpoch) throw new DomainError('stale_draft');
      const outbox = this.queue(c, draft.action, requestId, 'assistant_approved', draft.edited ? 'owner_edited_assistant' : 'assistant_written', null, draft.audioSourceIds);
      this.store.saveDraft({ ...draft, state: 'approved' }); return outbox;
    });
  }
  autoSend(id: string, requestId: string): Outbox {
    return this.request(requestId, { operation: 'auto', id }, Outbox, () => {
      const draft = this.store.draft(this.accountId, id);
      if (!draft) throw new DomainError('draft_not_found', 404);
      const c = this.conversation(draft.conversationId);
      if (draft.state !== 'pending' || draft.workflowVersion !== c.workflowVersion || draft.policyVersion !== c.policyVersion
        || draft.sourceEpoch !== undefined && draft.sourceEpoch !== this.store.historyGroup(this.accountId,c.id).sourceEpoch) throw new DomainError('stale_draft');
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
    if (this.suspended) throw new DomainError('profile_transition_in_progress', 409);
    const c = this.conversation(outbox.conversationId);
    if (outbox.origin === 'owner_manual') {
      if (outbox.action.kind === 'text_sequence' && c.workflowVersion !== outbox.workflowVersion) throw new DomainError('stale_delivery');
      return;
    }
    this.checkAudioSources(c,outbox.audioSourceIds ?? []);
    if (this.groupUnknown(c.id,outbox.id)) throw new DomainError('delivery_unknown');
    const effective = this.effectiveConversation(c.id);
    if (outbox.sourceEpoch !== undefined && outbox.sourceEpoch !== this.store.historyGroup(this.accountId,c.id).sourceEpoch) throw new DomainError('stale_delivery');
    if (!aiAccess(effective, this.accountId) || effective.control === 'manual' || !inPermittedHours(effective, this.clock())
      || outbox.origin === 'assistant_auto' && effective.mode !== 'auto_reply'
      || c.workflowVersion !== outbox.workflowVersion || c.policyVersion !== outbox.policyVersion) throw new DomainError('stale_delivery');
    if (outbox.grantId) {
      const g = this.store.grants(this.accountId, c.id).find(g => g.id === outbox.grantId);
      if (!g || g.state !== 'active' || g.expiresAt!==null && g.expiresAt <= this.clock()) throw new DomainError('grant_expired');
    }
  }
  async dispatch(id: string, handoff: (component: Component) => Promise<TransportResult>, options: DispatchOptions = {}): Promise<Outbox> {
    const outbox = this.store.outbox(this.accountId, id);
    if (!outbox) throw new DomainError('outbox_not_found', 404);
    const key = this.store.historyGroup(this.accountId,outbox.conversationId).id;
    const previous = this.lanes.get(key) ?? Promise.resolve();
    const run = previous.then(() => this.dispatchInLane(id, handoff, options));
    const settled = run.then(() => {}, () => {}); this.lanes.set(key, settled);
    try { return await run; } finally { if (this.lanes.get(key) === settled) this.lanes.delete(key); }
  }
  private async dispatchInLane(id: string, handoff: (component: Component) => Promise<TransportResult>, options: DispatchOptions): Promise<Outbox> {
    const wake = new AbortController();
    const abort = () => wake.abort();
    const conversationId = this.store.outbox(this.accountId,id)?.conversationId;
    const unsubscribe = this.onChange((chat,aiOnly) => { if (chat === conversationId && (!aiOnly || this.store.outbox(this.accountId,id)?.origin !== 'owner_manual')) abort(); });
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
            if (component.reaction && this.store.historySource(this.accountId,outbox.conversationId,component.reaction.targetMessageId,this.clock())?.state !== 'available') throw new DomainError('invalid_reaction_target',422);
            if (quoteId) {
              if (this.store.historySource(this.accountId,outbox.conversationId,quoteId,this.clock())?.state !== 'available') throw new DomainError('invalid_quote',422);
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
          if (result.state === 'accepted' && component.transportId && component.transportId !== result.transportId) result = {state:'unknown'};
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
              const target = this.store.historySource(this.accountId,outbox.conversationId,component.reaction.targetMessageId,this.clock())?.message;
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
  recover(preserveHandovers = false): void {
    this.store.transaction(() => {
      const handedOver = new Set(this.store.drafts(this.accountId).filter(d => !preserveHandovers && d.state === 'needs_owner').map(d => d.conversationId));
      for (const id of handedOver) {
        const c = this.conversation(id);
        if (c.control === 'assistant_allowed') this.resolveHandovers(c.id);
        else {
          const ownerReply = this.store.messages(this.accountId,c.id).filter(m => m.direction === 'outbound' && m.authorship === 'owner_written' && m.source === 'live' && automaticTrigger(m) && (m.text.trim() || m.media?.kind === 'image' || m.media?.kind === 'audio')).sort((a,b) => b.occurredAt-a.occurredAt)[0];
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
