import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { OwnerAction, Outbox, type Message } from '@replybot/core/contracts';
import { ProfileScope } from '@replybot/core/api';
import { ApiClient, ApiError, SendResult, UnconfirmedMutationError } from './api';
import { randomUUID } from './uuid';
import type { AudioClip } from './audio-clip';
import type { PickedImage } from '../components/attachment-picker';
import { retainMedia, releaseImage } from './media-lease';

const Intent = z.object({
  service: z.string(), scope: ProfileScope, epoch: z.number(), conversationId: z.string(),
  requestId: z.string(), uploadRequestId: z.string(), order: z.number(), revision: z.number(), createdAt: z.number().optional(),
  text: z.string().max(4000), quotedMessageId: z.string().nullable(),
  mediaKind: z.enum(['image', 'audio']).nullable(), action: OwnerAction.nullable(),
  phase: z.enum(['preparing', 'waiting', 'uploading', 'sending', 'pending', 'accepted', 'uncertain', 'failed', 'stopped']),
  submitted: z.boolean(), detail: z.string().optional(), outbox: Outbox.optional(), simulated: z.boolean().optional(),
}).strict();
export type PendingIntent = z.infer<typeof Intent>;
export type IntentCapture = {
  conversationId: string; composerIdentity: string; revision: number; text: string; quotedMessageId: string | null;
  action?: OwnerAction; image?: PickedImage; clip?: AudioClip;
};
type Media = { image?: PickedImage; clip?: AudioClip; release: () => void };
const writes = new Map<string, Promise<void>>();
const captures = new Map<string, Promise<void>>();
const resolved = (intent: PendingIntent) => intent.phase === 'accepted';
export class PendingIntents {
  private values: PendingIntent[] = [];
  private listeners = new Set<() => void>();
  private media = new Map<string, Media>();
  private captured = new Set<string>();
  private running = new Set<string>();
  private dispatchable = new Set<string>();
  private active = true;
  private foreground = true;
  private departure = 0;
  private order = 0;
  private loadTask?: Promise<void>;
  private loaded = false;
  private loadFailed = false;
  onMutation: () => void = () => {};
  readonly key: string;
  constructor(private readonly client: ApiClient, private readonly scope: ProfileScope | undefined, private readonly epoch: number) {
    this.key = 'replybot-intents:' + JSON.stringify([client.baseUrl, scope?.profileId, scope?.accountId]);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get = (): readonly PendingIntent[] => this.values;
  private emit() { for (const listener of this.listeners) listener(); }
  load(): Promise<void> {
    return this.loadTask ??= (async () => {
      if (!this.scope) return;
      try {
        await captures.get(this.key);
        await writes.get(this.key)?.catch(() => {});
        const saved = await AsyncStorage.getItem(this.key);
        const rows = saved ? z.array(Intent).max(20).parse(JSON.parse(saved)) : [];
        // Restored records are evidence/content only. No mutation is ever resumed.
        const restored = rows.filter(row => row.service === this.client.baseUrl && row.scope.profileId === this.scope?.profileId && row.scope.accountId === this.scope?.accountId)
          .map(row => ({ ...row, phase: row.submitted ? 'uncertain' as const : 'stopped' as const,
            detail: row.submitted ? 'Outcome unconfirmed. No automatic retry.' : row.mediaKind ? 'Not submitted. Attachment unavailable after restart; reattach explicitly.' : 'Not submitted. Restore explicitly to compose again.' }));
        this.order = Math.max(this.order, ...restored.map(row => row.order));
        this.values = [...restored, ...this.values];
      } catch { this.loadFailed = true; }
      this.loaded = true; this.emit();
    })();
  }
  private persist(): Promise<void> {
    const json = JSON.stringify(this.values.filter(row => !resolved(row)));
    const task = (writes.get(this.key) ?? Promise.resolve()).catch(() => {}).then(() => AsyncStorage.setItem(this.key, json));
    writes.set(this.key, task);
    void task.finally(() => { if (writes.get(this.key) === task) writes.delete(this.key); }).catch(() => {});
    return task;
  }
  private update(requestId: string, patch: Partial<PendingIntent>): void {
    this.values = this.values.map(row => row.requestId === requestId ? { ...row, ...patch } : row);
    this.emit();
  }
  private release(requestId: string) { this.media.get(requestId)?.release(); this.media.delete(requestId); }
  async enqueue(capture: IntentCapture, clearCaptured: () => void): Promise<void> {
    const captureKey = JSON.stringify([capture.conversationId, capture.composerIdentity, capture.revision]);
    if (this.captured.has(captureKey)) return;
    if (!this.scope || !this.active || !this.foreground) throw new Error('Stay in the active account and foreground to submit a message.');
    if (this.values.filter(value => !resolved(value)).length >= 20) throw new Error('20 pending messages are unresolved. Your composition is unchanged.');
    this.captured.add(captureKey);
    const requestId = randomUUID(), departure = this.departure;
    const row: PendingIntent = {
      service: this.client.baseUrl, scope: this.scope, epoch: this.epoch, conversationId: capture.conversationId,
      requestId, uploadRequestId: randomUUID(), order: ++this.order, revision: capture.revision, createdAt: Date.now(),
      text: capture.text, quotedMessageId: capture.quotedMessageId,
      mediaKind: capture.image ? 'image' : capture.clip ? 'audio' : null, action: capture.action ?? null,
      phase: 'preparing', submitted: false,
    };
    const image=capture.image, clip=capture.clip;
    if (image) this.media.set(requestId, { image, release: retainMedia(image, () => releaseImage(image)) });
    if (clip) this.media.set(requestId, { clip, release: retainMedia(clip, () => clip.release()) });
    this.values = [...this.values, row]; this.emit();
    // Start our load before publishing this capture's barrier, so it cannot wait on itself.
    const loading = this.load();
    let complete = () => {};
    const capturing = new Promise<void>(resolve => { complete = resolve; });
    const barrier = Promise.all([captures.get(this.key), capturing]).then(() => {});
    captures.set(this.key, barrier);
    let journaled = false;
    try {
      await loading;
      if (this.loadFailed) throw new Error('Pending messages could not be read. Your composition is unchanged.');
      if (this.values.filter(value => !resolved(value)).length > 20) throw new Error('20 pending messages are unresolved. Your composition is unchanged.');
      try { await this.persist(); } catch { throw new Error('Pending message could not be saved on this device. Your composition is unchanged. No send was attempted.'); }
      journaled = true;
      if (!this.active || !this.foreground || departure !== this.departure) {
        this.update(requestId, { phase: 'stopped', detail: 'Not submitted. Restore explicitly when ready.' });
        await this.persist(); this.release(requestId); return;
      }
      // No callback reads the current composer. The screen clears only its captured revision.
      clearCaptured();
      this.update(requestId, { phase: 'waiting' });
      this.dispatchable.add(requestId);
      void this.run(capture.conversationId);
    } catch (error) {
      if (!journaled) {
        this.values = this.values.filter(value => value.requestId !== requestId);
        this.captured.delete(captureKey); this.emit();
      }
      this.release(requestId);
      throw error instanceof Error ? error : new Error('Pending message could not be saved. Your composition is unchanged.');
    } finally {
      complete();
      void barrier.then(() => { if (captures.get(this.key) === barrier) captures.delete(this.key); });
    }
  }
  private async run(conversationId: string): Promise<void> {
    if (this.running.has(conversationId)) return;
    this.running.add(conversationId);
    try {
      while (this.active && this.foreground) {
        const row = this.values.find(value => value.conversationId === conversationId && !resolved(value));
        if (!row || row.phase !== 'waiting' || !this.dispatchable.has(row.requestId)) return;
        const media = this.media.get(row.requestId);
        const canSubmit = () => this.active && this.foreground && this.dispatchable.has(row.requestId);
        let submitted = false;
        try {
          let action = row.action;
          if (row.mediaKind) {
            this.update(row.requestId, { phase: 'uploading' }); await this.persist();
            if (!canSubmit()) return;
            if (row.mediaKind === 'image' && media?.image) {
              const upload = await this.client.uploadImage(conversationId, media.image.base64, row.uploadRequestId);
              action = { kind: 'image', uploadId: upload.id, caption: row.text, reason: 'Owner image message.' };
            } else if (row.mediaKind === 'audio' && media?.clip) {
              const bytes = await media.clip.bytes();
              if (!canSubmit()) return;
              const upload = await this.client.uploadAudio(conversationId, bytes, row.uploadRequestId);
              action = { kind: 'audio', uploadId: upload.id, reason: 'Owner voice note.' };
            } else throw new Error('Attachment unavailable. Reattach explicitly.');
          }
          if (!canSubmit()) return;
          const parsed = OwnerAction.parse(action ?? { kind: 'text', text: row.text, reason: 'Owner manual message.' });
          this.update(row.requestId, { action: parsed, phase: 'sending', submitted: true });
          // A durable submitted marker precedes network handoff, even if the process exits next.
          await this.persist();
          if (!canSubmit()) { this.update(row.requestId, { submitted: false }); return; }
          submitted = true;
          const result = await this.client.request('/v1/conversations/' + encodeURIComponent(conversationId) + '/manual-send', SendResult,
            { action: parsed, quotedMessageId: row.quotedMessageId, requestId: row.requestId });
          if (!this.active) return;
          const known = this.values.find(value => value.requestId === row.requestId)?.outbox;
          if (result.outbox.accountId !== row.scope.accountId || result.outbox.conversationId !== conversationId
            || result.outbox.requestId !== row.requestId || known && known.id !== result.outbox.id) throw new UnconfirmedMutationError();
          this.accept(row.requestId, result.outbox, result.simulated);
          await this.persist().catch(() => { this.update(row.requestId, { detail: 'Accepted result received. Local status could not be saved; no action will be retried.' }); });
          this.onMutation();
          if (result.outbox.state !== 'accepted') return;
        } catch (error) {
          if (!this.active) return;
          const uncertain = submitted && (!(error instanceof ApiError) || ['delivery_unknown', 'service_error', 'profile_scope_changed', 'profile_transition_in_progress'].includes(error.code));
          this.update(row.requestId, { phase: uncertain ? 'uncertain' : 'failed',
            detail: uncertain ? 'Send outcome is unconfirmed. Do not resend. Later messages are waiting.' : error instanceof Error ? error.message : 'Not sent. Restore explicitly to compose again.' });
          await this.persist().catch(() => { this.update(row.requestId, { detail: 'Status could not be saved. No action will be retried.' }); });
          return;
        } finally {
          const latest = this.values.find(value => value.requestId === row.requestId);
          if (!this.active || latest && ['accepted', 'failed', 'stopped'].includes(latest.phase)) this.release(row.requestId);
          if (latest && !submitted && !['failed', 'accepted'].includes(latest.phase)) {
            this.update(row.requestId, { phase: 'stopped', submitted: false, detail: 'Not submitted. Restore explicitly when ready.' });
            if (this.active) await this.persist().catch(() => {});
            this.release(row.requestId);
          }
        }
      }
    } finally { this.running.delete(conversationId); }
  }
  private accept(requestId: string, outbox: Outbox, simulated?: boolean) {
    const phase = outbox.state === 'accepted' ? 'accepted' : ['unknown', 'partial'].includes(outbox.state) ? 'uncertain'
      : ['failed', 'cancelled'].includes(outbox.state) ? 'failed' : 'pending';
    this.update(requestId, { outbox, phase, simulated, detail: undefined });
    // Completed history is server-owned. Bound only the local display of resolved rows.
    const accepted = this.values.filter(resolved);
    if (accepted.length > 20) { const remove = new Set(accepted.slice(0, accepted.length - 20).map(row => row.requestId)); this.values = this.values.filter(row => !remove.has(row.requestId)); this.emit(); }
  }
  reconcile(outboxes: readonly Outbox[]): void {
    let changed = false;
    for (const row of this.values) {
      if (!row.submitted) continue;
      const match = outboxes.find(box => box.accountId === row.scope.accountId && box.conversationId === row.conversationId && box.requestId === row.requestId
        && (!row.outbox || box.id === row.outbox.id));
      if (match && JSON.stringify(match) !== JSON.stringify(row.outbox)) {
        if (row.phase === 'accepted' && match.state !== 'accepted' || ['uncertain', 'failed'].includes(row.phase) && ['queued', 'dispatching'].includes(match.state)) continue;
        const previous = row.outbox;
        if (previous?.components.some(component => {
          const incoming = match.components.find(value => value.id === component.id);
          return !incoming || component.transportId && incoming.transportId && component.transportId !== incoming.transportId;
        })) continue;
        const ranks = { sent: 1, delivered: 2, read: 3 };
        const evidence = { ...match, components: match.components.map(component => {
          const saved = previous?.components.find(value => value.id === component.id && value.transportId === component.transportId)?.outgoingReceipt;
          return saved && (!component.outgoingReceipt || ranks[saved.level] > ranks[component.outgoingReceipt.level]) ? { ...component, outgoingReceipt: saved } : component;
        }) };
        this.accept(row.requestId, evidence, row.simulated);
        if (['accepted', 'failed', 'cancelled'].includes(match.state)) this.release(row.requestId);
        changed = true;
      }
    }
    // Read evidence never starts a stopped lane or retries a request.
    if (changed) void this.persist().catch(() => {});
  }
  async restore(requestId: string, fillEmpty: (row: PendingIntent) => boolean): Promise<void> {
    const row = this.values.find(value => value.requestId === requestId);
    if (!this.active || !row || (row.submitted && row.phase !== 'failed') || !['failed', 'stopped', 'waiting'].includes(row.phase)) return;
    if (!fillEmpty(row)) throw new Error('Your composer has newer work. Clear it before restoring.');
    this.dispatchable.delete(requestId); this.release(requestId);
    this.values = this.values.filter(value => value !== row); this.emit(); await this.persist();
  }
  setForeground(value: boolean): void {
    this.foreground = value;
    if (!value) { this.departure++; this.stopWaiting(); }
  }
  private stopWaiting(): void {
    this.values = this.values.map(row => !row.submitted && ['preparing', 'waiting'].includes(row.phase)
      ? { ...row, phase: 'stopped', detail: 'Not submitted. Restore explicitly when ready.' } : row);
    for (const row of this.values) if (row.phase === 'stopped') this.release(row.requestId);
    this.dispatchable.clear(); this.emit();
    if (this.loaded && !this.loadFailed) void this.persist().catch(() => {});
  }
  stop(): void {
    this.active = false; this.stopWaiting();
    for (const row of this.values) if (!this.running.has(row.conversationId)) this.release(row.requestId);
  }
}
export function intentVisible(row: PendingIntent, messages: readonly Message[]): boolean {
  return !row.outbox || row.phase !== 'accepted' || !row.outbox.components.every(component => component.transportId
    && (component.kind === 'reaction'
      ? messages.some(message => message.accountId === row.scope.accountId && message.conversationId === row.conversationId
        && message.id === component.reaction?.targetMessageId && message.observedReactions?.some(observation => observation.transportId === component.transportId
          && (observation.actor === 'owner' || observation.actor === 'assistant')))
      : messages.some(message => message.accountId === row.scope.accountId && message.conversationId === row.conversationId
        && message.direction === 'outbound' && message.transportId === component.transportId)));
}
