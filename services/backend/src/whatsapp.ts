import makeWASocket, { useMultiFileAuthState, jidNormalizedUser, DisconnectReason, proto, generateMessageIDV2, normalizeMessageContent, type WAMessage, type Contact } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DomainError, automaticDecision, aiAccess, inPermittedHours, type Workflow, type Message, type Conversation, type OutgoingReceipt } from '@replybot/core';
import { directJid, normalizeWhatsApp, isViewOnce } from './whatsapp-normalize.ts';
import { downloadAttachment, mediaDeadline } from './whatsapp-media.ts';

export const WhatsAppStatus = z.object({
  state: z.enum(['disconnected','connecting','qr','connected','error']), qr: z.string().nullable(),
  error: z.string().nullable(), historyMessages: z.number(),
});
export type WhatsAppStatus = z.infer<typeof WhatsAppStatus>;
export class WhatsAppAdapter {
  private readonly loadAuth = useMultiFileAuthState;
  private readonly makeSocket = makeWASocket;
  private socket: ReturnType<typeof makeWASocket> | undefined;
  private verifiedSocket: ReturnType<typeof makeWASocket> | undefined;
  private status: WhatsAppStatus = { state: 'disconnected', qr: null, error: null, historyMessages: 0 };
  private starting: Promise<void> | undefined;
  private stopped = false;
  private sealed = false;
  private generation = 0;
  private stopping: Promise<void> | undefined;
  private reconnect: ReturnType<typeof setTimeout> | undefined;
  private openedAt = 0;
  private events: Promise<void> = Promise.resolve();
  private connectionLife = new AbortController();
  private readonly presence = new Map<string, () => void>();
  private readonly presenceLanes = new Map<string, Promise<void>>();
  constructor(private readonly flow: Workflow, private readonly authDir: string,
    private readonly incoming: (message: Message) => Promise<void>,private readonly onConnectionLost?:()=>void,
    private readonly clock = Date.now, private readonly requireOwnerLock = false) {}
  snapshot(): WhatsAppStatus { return { ...this.status }; }
  requireReady(): void { if (this.status.state !== 'connected' || !this.socket || this.verifiedSocket !== this.socket) throw new DomainError('whatsapp_not_connected', 503); }
  async start(): Promise<void> {
    if (this.sealed || this.stopping) throw new DomainError('profile_transition_in_progress', 409);
    if (this.starting) return this.starting;
    if (this.socket && ['connecting','connected','qr'].includes(this.status.state)) return;
    this.stopped = false;
    clearTimeout(this.reconnect);
    this.starting = this.connect(this.generation);
    try { await this.starting; } finally { this.starting = undefined; }
  }
  private async connect(generation: number): Promise<void> {
    const ownerPath = join(this.authDir, 'owner-identity.json');
    let owner: string | undefined;
    if (this.requireOwnerLock || existsSync(ownerPath)) {
      try { owner = z.object({ owner: z.string().min(1) }).parse(JSON.parse(readFileSync(ownerPath, 'utf8'))).owner; }
      catch { throw new DomainError('owner_identity_required', 409); }
    }
    mkdirSync(this.authDir, { recursive: true, mode: 0o700 });
    const { state, saveCreds } = await this.loadAuth(this.authDir);
    if (this.stopped || this.sealed || generation !== this.generation) return;
    if (owner && state.creds.me && jidNormalizedUser(state.creds.me.id) !== owner) {
      this.stopped = true;
      this.fail('Saved WhatsApp login belongs to a different number. In Settings, use Repair this number for the original number, or Use another number for a separate profile.');
      return;
    }
    this.status = { ...this.status, state: 'connecting', qr: null, error: null };
    const socket = this.makeSocket({ auth: state, logger: pino({ level: 'silent' }),
      browser: ['Otherme','Chrome','1.0'], markOnlineOnConnect: false, syncFullHistory: false,
      generateHighQualityLinkPreview: false, emitOwnEvents: true, maxMsgRetryCount: 0,
      enableRecentMessageCache: false, enableAutoSessionRecreation: false,
      shouldIgnoreJid: jid => !directJid(jid),
      getMessage: async key => {
        if (this.socket !== socket || this.verifiedSocket !== socket || !key.remoteJid || !key.id) return undefined;
        return this.raw(this.canonical(key.remoteJid, key.remoteJidAlt), key.id)?.message ?? undefined;
      },
    });
    this.socket = socket;
    socket.ev.on('creds.update', () => { this.enqueue(async () => {
      if (!this.stopped && this.socket === socket && generation === this.generation) await saveCreds();
    }); });
    socket.ev.on('connection.update', update => {
      if (this.stopped || this.socket !== socket || generation !== this.generation) return;
      if (update.qr) {
        const qr = update.qr;
        this.enqueue(async () => { const image = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          if (this.socket === socket && this.status.state !== 'connected') this.status = { ...this.status, state: 'qr', qr: image, error: null }; });
      }
      if (update.connection === 'open') {
        const me = state.creds.me?.id;
        if (!me) { this.fail('WhatsApp did not provide an owner identity.'); socket.end(new Error('identity_missing')); return; }
        const owner = jidNormalizedUser(me);
        const path = join(this.authDir, 'owner-identity.json');
        try {
          if (existsSync(path)) {
            if (z.object({ owner: z.string().min(1) }).parse(JSON.parse(readFileSync(path,'utf8'))).owner !== owner) throw new Error('owner_mismatch');
          } else {
            if (this.requireOwnerLock) throw new Error('owner_identity_required');
            writeFileSync(path, JSON.stringify({ owner }), { mode: 0o600, flag: 'wx' });
          }
        } catch {
          this.fail('Owner identity could not be verified. Account history was not mixed.');
          this.stopped = true; this.verifiedSocket = undefined; socket.end(new Error('owner_mismatch')); return;
        }
        this.connectionLife = new AbortController();
        this.verifiedSocket = socket;
        this.openedAt = this.clock(); this.status = { ...this.status, state: 'connected', qr: null, error: null };
      }
      if (update.connection === 'close') {
        this.connectionLife.abort(); this.clearPresence(); this.onConnectionLost?.();
        this.socket = undefined; this.verifiedSocket = undefined; this.status = { ...this.status, state: 'disconnected', qr: null };
        const parsed = z.object({ output: z.object({ statusCode: z.number() }) }).safeParse(update.lastDisconnect?.error);
        if (parsed.success && parsed.data.output.statusCode === DisconnectReason.loggedOut) {
          this.stopped = true; this.fail('WhatsApp logged out. In Settings, use Repair this number to re-link it, or Use another number for a separate profile.');
        } else if (!this.stopped) this.reconnect = setTimeout(() => { void this.start().catch(() => this.fail('WhatsApp reconnection failed. Use Connect WhatsApp again.')); }, 3000);
      }
    });
    socket.ev.on('lid-mapping.update', mapping => {
      this.enqueueData(socket, async () => { this.canonical(mapping.lid, mapping.pn); });
    });
    socket.ev.on('contacts.upsert', contacts => {
      this.enqueueData(socket, async () => { for (const contact of contacts) {
        const jid = this.canonical(contact.id, contact.lid ?? contact.phoneNumber);
        this.contactNames(jid,contact);
      } });
    });
    socket.ev.on('contacts.update', contacts => {
      this.enqueueData(socket, async () => { for (const contact of contacts) {
        if (!contact.id) continue;
        this.contactNames(this.canonical(contact.id,contact.lid ?? contact.phoneNumber),contact);
      } });
    });
    socket.ev.on('messaging-history.set', history => {
      this.enqueueData(socket, async () => {
        for (const contact of history.contacts) this.canonical(contact.id,contact.lid ?? contact.phoneNumber);
        for (const raw of history.messages) await this.receive(raw, 'backfill');
        // History messages may establish a chat. Names alone still cannot create one.
        for (const contact of history.contacts) this.contactNames(this.canonical(contact.id,contact.lid ?? contact.phoneNumber),contact);
      });
    });
    socket.ev.on('messages.upsert', event => {
      this.enqueueData(socket, async () => {
        for (const raw of event.messages) {
          const timestamp = Number(raw.messageTimestamp ?? 0)*1000;
          const live = event.type === 'notify' && !event.requestId && this.status.state === 'connected' && timestamp >= this.openedAt-5000;
          await this.receive(raw, live ? 'live' : 'replay');
        }
      });
    });
    socket.ev.on('messages.reaction', reactions => {
      this.enqueueData(socket, async () => {
        // This event has no upsert source. Only a matching live upsert may pause work.
        for (const event of reactions) this.receiveReaction(event.key,event.reaction,'unknown');
      });
    });
    socket.ev.on('messages.update', updates => {
      this.enqueueData(socket, async () => {
        for (const { key, update } of updates) {
          const level = update.status === proto.WebMessageInfo.Status.SERVER_ACK ? 'sent'
            : update.status === proto.WebMessageInfo.Status.DELIVERY_ACK ? 'delivered'
            : update.status === proto.WebMessageInfo.Status.READ ? 'read' : undefined;
          if (level) this.receipt(key,{level,source:'wa_status',observedAt:this.clock()});
          const revoked = update.message?.protocolMessage?.key;
          if (revoked?.remoteJid && revoked.id) this.erase(this.canonical(revoked.remoteJid),revoked.id);
          else if (update.messageStubType === proto.WebMessageInfo.StubType.REVOKE && key.remoteJid && key.id) this.erase(this.canonical(key.remoteJid,key.remoteJidAlt),key.id);
        }
      });
    });
    socket.ev.on('message-receipt.update', updates => {
      this.enqueueData(socket, async () => { for (const {key,receipt} of updates) {
        const chat = this.receiptChat(key);
        if (!chat || !receipt.userJid || this.receiptIdentity(receipt.userJid) !== chat) continue;
        const read = Number(receipt.readTimestamp ?? 0);
        const delivered = Number(receipt.receiptTimestamp ?? 0);
        if (Number.isFinite(read) && read > 0) this.receipt(key,{level:'read',source:'wa_recipient',observedAt:this.clock()});
        else if (Number.isFinite(delivered) && delivered > 0) this.receipt(key,{level:'delivered',source:'wa_recipient',observedAt:this.clock()});
      } });
    });
    socket.ev.on('messages.delete', event => {
      this.enqueueData(socket, async () => {
        const keys = 'keys' in event ? event.keys : this.flow.store.messages(this.flow.accountId, this.canonical(event.jid)).map(m => ({ remoteJid: event.jid, id: m.transportId }));
        for (const key of keys) if (key.remoteJid && key.id) {
          this.erase(this.canonical(key.remoteJid), key.id);
        }
      });
    });
  }
  private enqueueData(socket: ReturnType<typeof makeWASocket>, operation: () => Promise<void>): void {
    this.enqueue(async () => { if (!this.stopped && this.socket === socket && this.verifiedSocket === socket) await operation(); });
  }
  private receiptIdentity(jid: string): string | undefined {
    if (!directJid(jid) || jid.includes(':')) return undefined;
    const chat = this.flow.store.waCanonical(this.flow.accountId,jidNormalizedUser(jid));
    const owner = this.socket?.user?.id;
    const ownerLid = this.socket?.user?.lid;
    if (!owner || chat === jidNormalizedUser(owner) || ownerLid && chat === jidNormalizedUser(ownerLid)) return undefined;
    return /^\d+@s\.whatsapp\.net$/.test(chat) ? chat : undefined;
  }
  private receiptChat(key: WAMessage['key']): string | undefined {
    if (key.fromMe !== true || !key.remoteJid || !key.id) return undefined;
    const chat = this.receiptIdentity(key.remoteJid);
    if (!chat || key.remoteJidAlt && this.receiptIdentity(key.remoteJidAlt) !== chat
      || key.participant && this.receiptIdentity(key.participant) !== chat) return undefined;
    return chat;
  }
  private receipt(key: WAMessage['key'], receipt: OutgoingReceipt): void {
    const chat = this.receiptChat(key);
    if (chat && key.id) this.flow.store.observeOutgoingReceipt(this.flow.accountId,chat,key.id,receipt);
  }
  private contactNames(jid: string, contact: Partial<Contact>): void {
    if (!/^\d+@s\.whatsapp\.net$/.test(jid) || !this.flow.store.conversation(this.flow.accountId,jid)) return;
    this.flow.observeContactNames(jid,{
      ...(contact.name !== undefined ? {wa_saved:contact.name} : {}),
      ...(contact.notify !== undefined ? {wa_notify:contact.notify} : {}),
      ...(contact.verifiedName !== undefined ? {wa_verified:contact.verifiedName} : {}),
    });
  }
  private erase(chat: string, transportId: string): void {
    const message = this.flow.store.messages(this.flow.accountId,chat).find(m => m.transportId === transportId);
    if (message) {
      this.flow.pause(chat,'delete-'+message.id);
      this.flow.store.saveMessage({ ...message, text: '[Message deleted]', media: null, reaction: null });
    }
    this.flow.store.saveWaMessage(this.flow.accountId,chat,transportId,JSON.stringify({ deleted: true }));
  }
  private enqueue(operation: () => Promise<void>): void {
    this.events = this.events.then(operation).catch(() => { this.status = { ...this.status, error: 'A WhatsApp event could not be processed. No automatic retry or send was attempted.' }; });
  }
  private fail(message: string): void { this.status = { ...this.status, state: 'error', error: message, qr: null }; }
  private canonical(jid: string, alternate?: string | null): string {
    const first = jidNormalizedUser(jid);
    const second = alternate ? jidNormalizedUser(alternate) : undefined;
    const phone = [first,second].find(j => j?.endsWith('@s.whatsapp.net'));
    const lid = [first,second].find(j => j?.endsWith('@lid'));
    if (phone && lid && this.flow.store.waCanonical(this.flow.accountId,lid) === lid) {
      const original = this.flow.store.conversation(this.flow.accountId,lid);
      if (original) {
        const target = this.conversation(phone);
        const mode = original.mode === 'never_reply' || target.mode === 'never_reply' ? 'never_reply'
          : original.mode === 'draft_only' || target.mode === 'draft_only' ? 'draft_only' : target.mode ?? original.mode;
        this.flow.pause(lid,'alias-old-'+lid);
        const paused = this.flow.pause(phone,'alias-new-'+lid);
        this.flow.store.saveConversation({ ...paused, excluded: original.excluded || target.excluded, mode,
          name: original.name || target.name, policyVersion: paused.policyVersion+1 });
      }
      this.flow.store.saveWaAlias(this.flow.accountId, lid, phone);
      if (original) {
        this.flow.store.mergeReleaseContext(this.flow.accountId,lid,phone);
        this.flow.refreshContactName(phone);
      }
    } else if (phone && lid) this.flow.store.saveWaAlias(this.flow.accountId,lid,phone);
    return this.flow.store.waCanonical(this.flow.accountId, first);
  }
  private conversation(jid: string): Conversation {
    const current = this.flow.store.conversation(this.flow.accountId,jid);
    if (current) return current;
    const unresolved = jid.endsWith('@lid');
    const c: Conversation = { id: jid, accountId: this.flow.accountId, contactId: jid,
      name: unresolved ? 'Unknown contact' : jid.split('@')[0] || 'Unknown contact', nameSource: unresolved ? 'unknown' : 'number', nameRevision: 0, kind: unresolved ? 'unknown' : 'direct',
      mode: null, excluded: false, control: 'assistant_allowed', workflowVersion: 1, policyVersion: 1,
      lastHumanActivityAt: 0, hours: null };
    this.flow.store.saveConversation(c); return c;
  }
  private raw(chat: string, id: string): WAMessage | undefined {
    const payload = this.flow.store.waMessage(this.flow.accountId, chat, id);
    if (!payload) return undefined;
    const parsed = z.object({ protobuf: z.string() }).safeParse(JSON.parse(payload));
    if (!parsed.success) return undefined;
    const raw = proto.WebMessageInfo.decode(Buffer.from(parsed.data.protobuf,'base64'));
    return raw.key ? { ...raw, key: raw.key } : undefined;
  }
  private receiveReaction(key: WAMessage['key'], reaction: Omit<proto.IReaction,'key'> & {key?: WAMessage['key'] | null}, source: Message['source']): void {
    const reactor = reaction.key;
    if (!key.id || !reactor?.id) return;
    // Baileys uses the target key here, and the reactor's envelope key in reaction.key.
    // A missing chat is scoped by the other key, never by a global message-ID lookup.
    const reactorChat = reactor.remoteJid ? this.canonical(reactor.remoteJid,reactor.remoteJidAlt) : undefined;
    const targetChat = key.remoteJid ? this.canonical(key.remoteJid,key.remoteJidAlt) : undefined;
    const chat = targetChat ?? reactorChat;
    if (!chat || !directJid(chat) || reactorChat && reactorChat !== chat) return;
    const target = this.flow.store.messages(this.flow.accountId,chat).find(m => m.transportId === key.id);
    if (!target || !this.raw(chat,key.id)) return;
    const at = Number(reaction.senderTimestampMs ?? 0);
    if (!Number.isFinite(at) || at <= 0) return;
    this.flow.observeReaction(chat,target.id,{
      actor:reactor.fromMe === false ? 'contact' : 'unknown', actorId:reactor.fromMe ? 'owner' : chat,
      transportId:reactor.id,emoji:reaction.text || null,occurredAt:at,source,
    },reactor.fromMe === true);
  }
  private async receive(raw: WAMessage, source: Message['source']): Promise<void> {
    if (this.stopped || this.sealed) return;
    if (!raw.key.remoteJid || !directJid(raw.key.remoteJid)) return;
    const reaction = normalizeMessageContent(raw.message)?.reactionMessage;
    if (reaction?.key) {
      this.canonical(raw.key.remoteJid,raw.key.remoteJidAlt);
      this.receiveReaction(reaction.key,{key:raw.key,text:reaction.text ?? null,senderTimestampMs:reaction.senderTimestampMs ?? Number(raw.messageTimestamp ?? 0)*1000},source);
      return;
    }
    const chat = this.canonical(raw.key.remoteJid, raw.key.remoteJidAlt);
    this.conversation(chat);
    if (!raw.key.fromMe && raw.pushName !== undefined) this.flow.observeContactNames(chat,{wa_notify:raw.pushName});
    const message = normalizeWhatsApp(raw,this.flow.accountId,chat,source);
    if (!message) return;
    const previous = this.flow.store.waMessage(this.flow.accountId,chat,message.transportId);
    if (previous && z.object({ deleted: z.literal(true) }).safeParse(JSON.parse(previous)).success) return;
    if (!isViewOnce(raw)) this.flow.store.saveWaMessage(this.flow.accountId,chat,message.transportId,
      JSON.stringify({ protobuf: Buffer.from(proto.WebMessageInfo.encode(raw).finish()).toString('base64') }));
    const inserted = this.flow.observe(message, raw.key.fromMe === true);
    if (inserted && source === 'backfill') this.status.historyMessages++;
    if (inserted && source === 'live' && message.direction === 'inbound') {
      // Do not hold the event lane while a model runs; owner takeover must remain immediate.
      void this.incoming(message).catch(() => { this.status = { ...this.status, error: 'A reply could not be drafted. Review this chat manually.' }; });
    }
  }
  mediaCurrent(message:Message):boolean {
    const saved=this.flow.store.message(this.flow.accountId,message.id);
    const raw=this.raw(message.conversationId,message.transportId);
    const normalized=raw ? normalizeWhatsApp(raw,this.flow.accountId,message.conversationId,message.source) : null;
    return message.accountId===this.flow.accountId && saved?.conversationId===message.conversationId && !!saved.media && !!raw && !isViewOnce(raw) && !!normalized?.media
      && !saved.media.viewOnce && (saved.media.expiresAt===null || saved.media.expiresAt>this.clock())
      && (normalized.media.expiresAt===null || normalized.media.expiresAt>this.clock());
  }
  async downloadMedia(message:Message):Promise<Buffer> {
    this.requireReady();
    if(!this.mediaCurrent(message))throw new DomainError('media_unavailable',404);
    const raw=this.raw(message.conversationId,message.transportId);
    if(!raw)throw new DomainError('media_unavailable',404);
    const content=normalizeMessageContent(raw.message);
    const attachment=content?.imageMessage ?? content?.stickerMessage ?? content?.audioMessage ?? (content?.videoMessage?.gifPlayback ? content.videoMessage : undefined);
    if(!attachment || Number(attachment.fileLength ?? 0)>10*1024*1024)throw new DomainError('media_too_large',413);
    const signal=AbortSignal.timeout(15000);const socket=this.socket;
    const kind=content?.imageMessage ? 'image' : content?.stickerMessage ? 'sticker' : content?.audioMessage ? 'audio' : 'video';
    let bytes:Buffer;
    try{bytes=await downloadAttachment(attachment,kind,signal);}
    catch(error){
      if(!(error instanceof DomainError) || ![404,410].includes(error.status) || error.code!=='media_download_failed')throw error;
      if(!socket || this.socket!==socket || this.verifiedSocket!==socket || !this.mediaCurrent(message))throw new DomainError('media_unavailable',404);
      const updated=await mediaDeadline(socket.updateMediaMessage(raw),signal);
      if(this.socket!==socket || this.verifiedSocket!==socket || !this.mediaCurrent(message) || isViewOnce(updated)
        || updated.key.id!==raw.key.id || updated.key.remoteJid!==raw.key.remoteJid)throw new DomainError('media_unavailable',404);
      const fresh=normalizeMessageContent(updated.message);
      const next=fresh?.imageMessage ?? fresh?.stickerMessage ?? fresh?.audioMessage ?? (fresh?.videoMessage?.gifPlayback ? fresh.videoMessage : undefined);
      if(!next)throw new DomainError('media_unavailable',404);
      bytes=await downloadAttachment(next,kind,signal);
      if(this.socket!==socket || this.verifiedSocket!==socket || !this.mediaCurrent(message))throw new DomainError('media_unavailable',404);
      this.flow.store.saveWaMessage(this.flow.accountId,message.conversationId,message.transportId,
        JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(updated).finish()).toString('base64')}));
    }
    if(!this.mediaCurrent(message))throw new DomainError('media_unavailable',404);
    return bytes;
  }
  beginPresence(chat: string, isCurrent: () => boolean, outboxId?: string): () => void {
    this.presence.get(chat)?.();
    const socket = this.socket;
    const c = this.flow.conversation(chat);
    const eligible = () => {
      if (!socket || this.socket !== socket || this.verifiedSocket !== socket || this.status.state !== 'connected'
        || !isCurrent() || !this.flow.store.modelConsent(this.flow.accountId)) return false;
      const current = this.flow.conversation(chat);
      if (!chat.endsWith('@s.whatsapp.net') || !aiAccess(current,this.flow.accountId) || current.control !== 'assistant_allowed'
        || current.workflowVersion !== c.workflowVersion || current.policyVersion !== c.policyVersion
        || !inPermittedHours(current,this.clock())) return false;
      const grant = this.flow.store.grants(this.flow.accountId,chat).find(g => g.state === 'active');
      if (!outboxId) return automaticDecision(current,this.flow.store.conversations(this.flow.accountId),this.flow.accountId,this.clock(),'live',grant) === 'auto';
      const outbox = this.flow.store.outbox(this.flow.accountId,outboxId);
      return !!outbox && outbox.origin === 'assistant_auto' && outbox.conversationId === chat && outbox.grantId === grant?.id
        && outbox.workflowVersion === current.workflowVersion && !!grant && grant.reservedUnits > 0
        && (grant.expiresAt === null || grant.expiresAt > this.clock())
        && (grant.maxUnits === null || grant.successfulUnits + grant.reservedUnits <= grant.maxUnits)
        && outbox.components.some(p => p.state === 'queued' || p.state === 'dispatching');
    };
    if (!eligible()) return () => {};
    let timer: ReturnType<typeof setInterval>;
    let unsubscribe = () => {};
    const send = (state: 'composing' | 'paused') => {
      const previous = this.presenceLanes.get(chat) ?? Promise.resolve();
      const job = previous.then(async () => {
        if (!socket || this.socket !== socket || this.verifiedSocket !== socket) return;
        if (state === 'composing' ? this.presence.get(chat) !== finish || !eligible() : this.presence.has(chat)) return;
        await socket.sendPresenceUpdate(state,chat);
      }).catch(() => {}).finally(() => { if (this.presenceLanes.get(chat) === job) this.presenceLanes.delete(chat); });
      this.presenceLanes.set(chat,job);
    };
    const finish = () => {
      if (this.presence.get(chat) !== finish) return;
      this.presence.delete(chat); clearInterval(timer); unsubscribe(); send('paused');
    };
    this.presence.set(chat,finish);
    unsubscribe = this.flow.onChange(id => { if (id === chat) finish(); });
    let ticks = 0;
    timer = setInterval(() => { if (!eligible()) finish(); else if (++ticks % 4 === 0) send('composing'); },1000);
    timer.unref(); send('composing');
    return finish;
  }
  private clearPresence(): void { for (const finish of this.presence.values()) finish(); }
  async dispatch(outboxId: string) {
    const outbox = this.flow.store.outbox(this.flow.accountId,outboxId);
    if (!outbox) throw new DomainError('outbox_not_found',404);
    if (outbox.action.kind !== 'text_sequence') this.requireReady();
    const c = this.flow.conversation(outbox.conversationId);
    if (c.kind !== 'direct' || !c.id.endsWith('@s.whatsapp.net')) throw new DomainError('unverified_chat_identity',403);
    const dispatchSocket = this.socket;
    const finishPresence = outbox.action.kind === 'text_sequence' && outbox.origin === 'assistant_auto'
      ? this.beginPresence(c.id,() => true,outboxId) : () => {};
    try {
      return await this.flow.dispatch(outboxId, async component => {
        const socket = this.socket;
        if (!socket || this.verifiedSocket !== socket || this.status.state !== 'connected') return { state: 'failed' };
        const transportId = generateMessageIDV2(socket.user?.id);
        const current = this.flow.store.outbox(this.flow.accountId,outboxId);
        if (!current) return { state: 'failed' };
        const part = current.components.find(p => p.id === component.id);
        if (!part) return { state: 'failed' };
        part.transportId = transportId; this.flow.store.saveOutbox(current);
        const target = component.reaction ? this.flow.store.messages(this.flow.accountId,c.id).find(m => m.id === component.reaction?.targetMessageId) : undefined;
        const reactionRaw = target ? this.raw(c.id,target.transportId) : undefined;
        const quoteId = component.quotedMessageId !== undefined ? component.quotedMessageId : outbox.quotedMessageId;
        const quote = quoteId ? this.flow.store.messages(this.flow.accountId,c.id).find(m => m.id === quoteId) : undefined;
        const quoted = quote ? this.raw(c.id,quote.transportId) : undefined;
        if (component.kind === 'reaction' && !reactionRaw || quoteId && (!quote || !quoted || quote.media?.viewOnce || quote.media?.expiresAt!==undefined && quote.media.expiresAt!==null && quote.media.expiresAt<=this.clock())) return { state: 'failed' };
        const audio = component.kind==='audio' && component.uploadId ? this.flow.store.audioUpload(this.flow.accountId,c.id,component.uploadId) : undefined;
        if(component.kind==='audio' && (!audio || outbox.origin!=='owner_manual'))return {state:'failed'};
        const upload = component.kind==='image' && component.uploadId ? this.flow.store.imageUpload(this.flow.accountId,c.id,component.uploadId) : undefined;
        if (component.kind === 'image' && (!upload || outbox.origin !== 'owner_manual')) return {state:'failed'};
        const content = component.kind==='audio' && audio
          ? {audio:Buffer.from(audio.bytes),mimetype:audio.mime,ptt:true,seconds:Math.ceil(audio.duration)}
          : component.kind === 'image' && upload
          ? {image:Buffer.from(upload.bytes),mimetype:upload.mime,caption:component.text ?? ''}
          : component.kind === 'reaction' && component.reaction && reactionRaw
            ? {react:{text:component.reaction.emoji,key:reactionRaw.key}} : {text:component.text ?? ''};
        const sent = await socket.sendMessage(c.id,content,{messageId:transportId,...(quoted ? {quoted} : {})});
        if (this.socket !== socket || this.verifiedSocket !== socket || sent?.key.id !== transportId) return {state:'unknown'};
        if (sent?.key.id && (component.kind === 'image' || component.kind==='audio')) {
          const previous = this.flow.store.waMessage(this.flow.accountId,c.id,sent.key.id);
          if (!previous || !z.object({deleted:z.literal(true)}).safeParse(JSON.parse(previous)).success)
            this.flow.store.saveWaMessage(this.flow.accountId,c.id,sent.key.id,
              JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(sent).finish()).toString('base64')}));
        }
        return sent?.key.id ? { state: 'accepted', transportId: sent.key.id } : { state: 'unknown' };
      }, {signal:this.connectionLife.signal,check:() => {
        this.requireReady();
        if (!dispatchSocket || this.socket !== dispatchSocket || this.verifiedSocket !== dispatchSocket) throw new DomainError('whatsapp_not_connected',503);
        if (outbox.origin !== 'owner_manual') {
          if (!this.flow.store.modelConsent(this.flow.accountId)) throw new DomainError('model_consent_revoked',403);
          for (const id of outbox.audioSourceIds ?? []) {
            const message = this.flow.store.message(this.flow.accountId,id);
            if (!message || !this.mediaCurrent(message)) throw new DomainError('audio_source_unavailable',410);
          }
        }
      }});
    } finally { finishPresence(); }
  }
  quiesce(): Promise<void> { this.sealed = true; return this.stop(); }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    if (this.stopped && !this.socket && !this.starting) return this.events;
    this.stopped = true; this.generation++;
    clearTimeout(this.reconnect); this.connectionLife.abort(); this.clearPresence(); this.onConnectionLost?.();
    const socket = this.socket; this.socket = undefined; this.verifiedSocket = undefined;
    socket?.end(new Error('Owner disconnected'));
    const work = (async () => {
      await this.starting;
      await this.events;
      await Promise.allSettled(this.presenceLanes.values());
      this.status = { ...this.status, state: 'disconnected', qr: null };
    })();
    this.stopping = work.finally(() => { this.stopping = undefined; });
    return this.stopping;
  }
}
