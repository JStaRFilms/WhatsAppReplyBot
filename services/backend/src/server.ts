import Fastify from 'fastify';
import cors from '@fastify/cors';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Action, OwnerAction, DomainError, Workflow, aiAccess, inPermittedHours, automaticDecision, latestTen, type Message, type SqliteStore } from '@replybot/core';
import { ClientSnapshot, MediaVariant, ProfileTransitionInput, OwnerInstructionsInput, ContactNamesInput, ContactNamesImportInput, type ProfileScope, type ProfileOperation } from '@replybot/core/api';
import { ProfileRegistry, bounded } from './profiles.ts';
import { assistantTurn, attention } from './assistant.ts';
import { draftGenerator, type RemoteModel } from './draft-model.ts';
import { WhatsAppAdapter } from './whatsapp.ts';
import { DEMO_ACCOUNT, seedDemo } from './seed.ts';
import { MediaService,readableMedia } from './media.ts';
import { MediaDisplay } from './media-display.ts';
import { inspectHistoryRaw } from './whatsapp-normalize.ts';
import { ReplyWindow } from './reply-window.ts';
import { AudioService, readableAudio, registerAudioUploads } from './audio.ts';
import { registerImageUploads } from './image-uploads.ts';
import { desktopAvailable, isDesktopRequest, registerDesktop } from './desktop.ts';
import { PcQrDisplay, type PcDisplayIntent } from './pc-display.ts';

const Request = z.object({ requestId: z.string().min(1).max(96) });
const Id = z.object({ id: z.string().min(1).max(128) });
const localOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
export function createApp(options: { store: SqliteStore; token: string; accountId?: string; profileScope?: ProfileScope;
  profiles?: { registry: ProfileRegistry; onQuiesced?: (operation: ProfileOperation) => Promise<void>; activation?: boolean; drainTimeoutMs?: number };
  desktopDir?: string; onPcDisplay?: (intent: PcDisplayIntent) => Promise<void>;
  onShutdownPhase?: (phase: 'gating' | 'transport' | 'requests' | 'reply-work' | 'workflow' | 'profile-transition' | 'storage' | 'stopped') => void;
  now?: () => number; seed?: boolean; remoteModel?: RemoteModel; whatsapp?: { authDir: string; requireOwnerLock?: boolean }; allowedOrigins?: string[]; launcher?: { rootId:string; instanceId:string } }) {
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  const now = options.now ?? Date.now;
  const accountId = options.accountId ?? (options.whatsapp ? 'whatsapp-owner' : DEMO_ACCOUNT);
  const scope = Object.freeze(options.profileScope ?? { profileId: 'original', accountId, revision: 0 });
  if (scope.accountId !== accountId) throw new Error('profile_account_mismatch');
  const registry = options.profiles?.registry;
  let gated = registry?.blocked() ?? false;
  const admitted = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  let transitionWork: Promise<void> | undefined;
  const blocked = () => gated || (registry?.blocked() ?? false);
  const pcDisplay = new PcQrDisplay({ rootId: options.launcher?.rootId ?? '', instanceId: options.launcher?.instanceId ?? '', profileScope: scope }, now);
  const pcQrDisplay = !!(options.launcher && options.onPcDisplay);
  const desktopBrowser = !!options.desktopDir && desktopAvailable(options.desktopDir);
  options.store.inspectHistoryRaw = inspectHistoryRaw;
  const flow = new Workflow(options.store, accountId, now);
  if (!options.whatsapp && options.seed !== false) seedDemo(options.store, now());
  flow.recover(gated || options.profiles?.activation);
  if (gated || options.profiles?.activation) flow.suspendAccount(!options.profiles?.activation);
  if (options.profiles?.activation) gated = false;
  const allowedOrigin = (origin: string) => localOrigin(origin) || (options.allowedOrigins ?? []).includes(origin);
  const replyWindow=new ReplyWindow(async(message,isCurrent)=>{
    if(blocked() || !isCurrent() || whatsapp && (whatsapp.snapshot().state!=='connected' || !options.remoteModel || !options.store.modelConsent(accountId)))return;
    const c=flow.effectiveConversation(message.conversationId);
    const grant=options.store.grants(accountId,c.id).find(g=>g.state==='active');
    const decision=automaticDecision(c,flow.effectiveConversations(),accountId,now(),message.source,grant);
    if(decision==='none' || flow.groupUnknown(c.id))return;
    let draft;
    try{draft=await generateDraft(c.id,'window-'+message.id+':'+c.workflowVersion);}
    catch(error){if(error instanceof DomainError && ['stale_workflow','stale_draft','ai_access_denied','model_consent_revoked'].includes(error.code))return;throw error;}
    if(blocked() || !isCurrent() || whatsapp && whatsapp.snapshot().state!=='connected')return;
    const current=flow.effectiveConversation(c.id);const allowance=options.store.grants(accountId,c.id).find(g=>g.state==='active');
    const latest=options.store.draft(accountId,draft.id);
    if(automaticDecision(current,flow.effectiveConversations(),accountId,now(),message.source,allowance)==='auto'
      && latest?.state==='pending' && !latest.edited)await dispatch(flow.autoSend(latest.id,'window-auto-'+latest.id).id);
  },5000,(message,isCurrent)=>whatsapp?.beginPresence(message.conversationId,isCurrent) ?? (()=>{}));
  const whatsapp=options.whatsapp ? new WhatsAppAdapter(flow,options.whatsapp.authDir,async message=>{
    if(!blocked() && options.remoteModel && options.store.modelConsent(accountId))await replyWindow.enqueue(message);
  },()=>replyWindow.clear(),now,options.whatsapp.requireOwnerLock) : undefined;
  const media:MediaService=new MediaService(async (message,ownerVideo)=>{
    const upload=options.store.sentImageUpload(accountId,message.conversationId,message.transportId);
    if(upload)return Buffer.from(upload.bytes);
    if(!whatsapp)throw new DomainError('media_unavailable',404);
    return whatsapp.downloadMedia(message,ownerVideo);
  },message=>{
    const source=options.store.historySource(accountId,message.conversationId,message.id,now());
    const saved=source?.state==='available' ? source.message : undefined;
    const raw=options.store.waMessage(accountId,message.conversationId,message.transportId);
    if(raw && z.object({deleted:z.literal(true)}).safeParse(JSON.parse(raw)).success)return false;
    return !!saved && saved.conversationId===message.conversationId && readableMedia(saved,now())
      && (!!options.store.sentImageUpload(accountId,message.conversationId,message.transportId) || whatsapp?.mediaCurrent(message)===true);
  },now,message=>display.source(message.conversationId,message.id,'preview').sourceVersion);
  const display:MediaDisplay=new MediaDisplay(flow,media,now,()=>!blocked() && !shutdownStarted);
  const audio=new AudioService(async message=>{
    const upload=options.store.sentAudioUpload(accountId,message.conversationId,message.transportId);
    if(upload)return Buffer.from(upload.bytes);
    if(!whatsapp)throw new DomainError('media_unavailable',404);
    return whatsapp.downloadMedia(message);
  },message=>{
    const source=options.store.historySource(accountId,message.conversationId,message.id,now());
    const saved=source?.state==='available' ? source.message : undefined;
    const raw=options.store.waMessage(accountId,message.conversationId,message.transportId);
    if(raw && z.object({deleted:z.literal(true)}).safeParse(JSON.parse(raw)).success)return false;
    return message.accountId===accountId && !!saved && saved.conversationId===message.conversationId && readableAudio(saved,now())
      && (!!options.store.sentAudioUpload(accountId,message.conversationId,message.transportId) || whatsapp?.mediaCurrent(message)===true);
  },now,message=>String(options.store.historyGroup(accountId,message.conversationId).sourceEpoch));
  const generateDraft=draftGenerator(flow,options.remoteModel,media,audio,now);
  const mediaReplies=new Map<string,()=>void>();
  app.register(cors, { origin: (origin, callback) => callback(null, !origin || allowedOrigin(origin)) });
  app.addHook('onRequest', async (request, reply) => {
    const ip = request.ip.replace(/^::ffff:/,'');
    if (!(ip === '::1' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))) return reply.code(403).send({ error: 'private_network_only' });
    const origin = request.headers.origin;
    if (origin && !allowedOrigin(origin)) return reply.code(403).send({ error: 'origin_denied' });
    // The router decodes literal segments before these hooks. Check its matched
    // route too, so an encoded API prefix cannot inherit public-asset access.
    if (options.desktopDir && ['GET', 'HEAD'].includes(request.method)
      && isDesktopRequest(request.url) && isDesktopRequest(request.routeOptions.url ?? request.url)) return;
    if (request.url === '/v1/health' || request.url === '/v1/local-provision' || request.method === 'OPTIONS') return;
    const auth = request.headers.authorization;
    const provided = Buffer.from(auth?.startsWith('Bearer ') ? auth.slice(7) : '');
    const expected = Buffer.from(options.token);
    if (!provided.length || provided.length !== expected.length || !timingSafeEqual(provided, expected))
      return reply.code(401).send({ error: 'owner_auth_required' });
    const path = request.url.split('?')[0];
    if (shutdownStarted) return reply.code(503).send({ error: 'service_stopping' });
    if (path === '/v1/session' || path === '/v1/launcher' || /^\/v1\/profile-operations\/[^/]+$/.test(path ?? '')) return;
    if (options.profileScope) {
      const profile = request.headers['x-otherme-profile']; const revision = request.headers['x-otherme-revision'];
      if (typeof profile !== 'string' || typeof revision !== 'string' || !/^\d+$/.test(revision))
        return reply.code(426).send({ error: 'client_upgrade_required' });
      // Only an exact recorded transition may use its original source scope.
      if (path !== '/v1/profile-transitions') {
        if (blocked()) return reply.code(409).send({ error: 'profile_transition_in_progress' });
        if (profile !== scope.profileId || Number(revision) !== scope.revision)
          return reply.code(409).send({ error: 'profile_scope_changed' });
      }
      reply.header('X-Otherme-Profile', scope.profileId).header('X-Otherme-Revision', String(scope.revision));
    }
    if (path !== '/v1/profile-transitions') {
      let resolve = () => {};
      const promise = new Promise<void>(done => { resolve = done; });
      admitted.set(request.id, { promise, resolve });
    }
  });
  app.addHook('onSend', async (request, reply, payload) => {
    if ((request.routeOptions.url ?? request.url).startsWith('/v1/')) reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');
    const guard=mediaReplies.get(request.id);
    mediaReplies.delete(request.id);
    if (guard) guard();
    if (shutdownStarted) reply.header('Connection', 'close');
    return payload;
  });
  app.addHook('onResponse', async request => {
    admitted.get(request.id)?.resolve(); admitted.delete(request.id);
  });
  app.setErrorHandler((error, request, reply) => {
    if (request.routeOptions.url === '/v1/contact-names/import' && error && typeof error === 'object'
      && 'code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send({error:'body_too_large'});
    if (error instanceof DomainError) return reply.code(error.status).send({ error: error.code });
    if (error instanceof z.ZodError) return reply.code(422).send({ error: 'invalid_request' });
    return reply.code(500).send({ error: 'service_error' });
  });
  if (options.desktopDir) registerDesktop(app, options.desktopDir);
  registerImageUploads(app,flow);
  registerAudioUploads(app,flow);
  const snapshot = () => ClientSnapshot.parse({ ...flow.snapshot(), profileScope:scope, serverTime:now(), demo: !whatsapp, connection: whatsapp?.snapshot().state ?? 'disconnected', model: options.remoteModel ? 'openai/gpt-6-luna' : 'local-demo',
    modelConsent: options.store.modelConsent(accountId), unreadCounts:options.store.unreadCounts(accountId),historyVersions:options.store.historyVersions(accountId),
    conversations:options.store.conversations(accountId).map(c=>options.store.historyGroup(accountId,c.id).id===c.id ? flow.effectiveConversation(c.id):c),
    historyGroups:flow.effectiveConversations().map(c=>({...options.store.historyGroup(accountId,c.id),aiBlocked:!aiAccess(c,accountId) || c.control==='manual' || !inPermittedHours(c,now())})),
    lastMessages: options.store.lastMessages(accountId,now()),
    latestTenIds: latestTen(flow.effectiveConversations(), accountId, now()) });
  const dispatch = (id: string) => whatsapp ? whatsapp.dispatch(id) : flow.dispatch(id, async () => ({ state: 'accepted', transportId: 'demo-'+randomUUID() }));
  const ready = () => whatsapp?.requireReady();
  app.get('/v1/health', async () => ({ demo: !whatsapp, service: 'ready', whatsapp: whatsapp?.snapshot().state ?? 'disconnected', model: options.remoteModel ? 'openai/gpt-6-luna' : 'local-demo' }));
  // Minimal authenticated status for the Windows launcher. Never return chat data or pairing secrets.
  app.get('/v1/launcher', async () => {
    if(!options.launcher)throw new DomainError('launcher_identity_unavailable',503);
    return {service:'otherme-backend',protocol:2,accountId,profileScope:scope,...options.launcher,
      demo:!whatsapp,whatsapp:whatsapp?.snapshot().state ?? 'disconnected'};
  });
  app.get('/v1/session', async request => ({ protocol: 2, scope,
    label: registry?.list().find(p => p.profileId === scope.profileId)?.label ?? 'Original account', transition: registry?.current() ?? null,
    ...(z.object({ capabilities: z.literal('1') }).safeParse(request.query).success ? { capabilities: { pcQrDisplay, desktopBrowser, ownerInstructions: true, contactBookNames: true,
      ...(z.object({historyMedia:z.literal('1')}).safeParse(request.query).success ? {historyPaging:true,privateMediaCache:true} : {}) } } : {}) }));
  app.get('/v1/profile-operations/:requestId', async request => {
    if (!registry) throw new DomainError('profile_operation_not_found', 404);
    return registry.operation(z.object({ requestId: z.string() }).parse(request.params).requestId);
  });
  app.get('/v1/profiles', async () => ({ profiles: registry?.list() ?? [{ profileId: scope.profileId, accountId, label: 'Original account', active: true }] }));
  app.post('/v1/profile-transitions', async (request, reply) => {
    const input = ProfileTransitionInput.parse(request.body);
    if (!registry) throw new DomainError('launcher_restart_required', 409);
    const profile = request.headers['x-otherme-profile']; const revision = request.headers['x-otherme-revision'];
    if (typeof profile !== 'string' || typeof revision !== 'string' || !/^\d+$/.test(revision)) throw new DomainError('client_upgrade_required', 426);
    const replay = registry.replay(input, profile, Number(revision));
    if (replay) return reply.code(202).send({ operation: replay });
    if (!options.profiles?.onQuiesced) throw new DomainError('launcher_restart_required', 409);
    if (blocked()) throw new DomainError('profile_transition_in_progress', 409);
    if (profile !== scope.profileId || Number(revision) !== scope.revision) throw new DomainError('profile_scope_changed', 409);
    // Admission closes before the handoff check, with no await before suspension.
    gated = true;
    pcDisplay?.expire();
    let operation: ProfileOperation;
    try {
      if (flow.hasActiveHandoff()) throw new DomainError('profile_handoff_active', 409);
      operation = registry.begin(input, scope);
      flow.suspendAccount();
    } catch (error) {
      if (registry.current()?.requestId === input.requestId) {
        // A journal rename may have succeeded even if the caller lost its write
        // acknowledgement. Once durable, this operation must stay stopped.
        replyWindow.clear(); clearInterval(timer); void whatsapp?.quiesce().catch(() => {});
        try { flow.suspendAccount(); } finally { registry.update(input.requestId, 'failed', 'profile_suspend_failed'); }
      } else gated = registry.blocked();
      throw error;
    }
    replyWindow.clear(); clearInterval(timer);
    const socketStopped = whatsapp?.quiesce();
    const responseFinished = new Promise<void>(resolve => { reply.raw.once('finish', resolve); });
    transitionWork = (async () => {
      try {
        await bounded(Promise.all([socketStopped, replyWindow.close(), flow.drain(),
          Promise.allSettled(catchUps.values()), Promise.all([...admitted.values()].map(a => a.promise)), responseFinished]),
        options.profiles?.drainTimeoutMs ?? 15000, 'profile_drain_timeout');
        const quiesced = registry.update(input.requestId, 'restarting');
        await options.profiles?.onQuiesced?.(quiesced);
      } catch (error) {
        const code = error instanceof Error && ['profile_drain_timeout', 'launcher_ack_timeout', 'launcher_ipc_unavailable'].includes(error.message)
          ? error.message : 'profile_transition_failed';
        registry.update(input.requestId, 'failed', code);
      }
    })();
    return reply.code(202).send({ operation });
  });
  app.post('/v1/local-provision', async request => {
    z.object({ confirmLocalDemo: z.literal(true) }).strict().parse(request.body);
    if (!['127.0.0.1', '::1'].includes(request.ip.replace(/^::ffff:/, '')) || !request.headers.origin || !localOrigin(request.headers.origin))
      throw new DomainError('local_browser_provision_only', 403);
    return { token: options.token, demo: !whatsapp };
  });
  app.get('/v1/snapshot', async () => snapshot());
  app.get('/v1/owner-instructions', async () => options.store.ownerInstructions(accountId));
  app.post('/v1/owner-instructions', async request => flow.setOwnerInstructions(OwnerInstructionsInput.parse(request.body)));
  app.get('/v1/contact-names', async () => options.store.contactNameSettings(accountId));
  app.post('/v1/contact-names', async request => flow.setContactNames(ContactNamesInput.parse(request.body)));
  app.post('/v1/contact-names/import', {bodyLimit:512*1024}, async request => flow.importContactNames(ContactNamesImportInput.parse(request.body)));
  const whatsappStatus = () => {
    const status = whatsapp?.snapshot() ?? { state: 'disconnected', qr: null, error: null, historyMessages: 0 };
    if (status.state === 'connected' || status.state === 'error' || blocked()) pcDisplay?.expire();
    const display = pcDisplay?.snapshot();
    return { ...status, ...(display ? { pcDisplay: display } : {}) };
  };
  app.get('/v1/whatsapp', async () => whatsappStatus());
  const connects = new Map<string, { displayOnPc: boolean; work: Promise<void> }>();
  app.post('/v1/whatsapp/connect', async request => {
    const input = Request.extend({ confirm: z.literal(true), displayOnPc: z.boolean().optional() }).strict().parse(request.body);
    if (!whatsapp) throw new DomainError('start_live_backend',409);
    const displayOnPc = input.displayOnPc === true;
    let operation = connects.get(input.requestId);
    if (operation && operation.displayOnPc !== displayOnPc) throw new DomainError('request_id_conflict', 409);
    if (!operation) {
      const intent = displayOnPc ? pcDisplay.request(input.requestId, pcQrDisplay) : undefined;
      const work = (async () => {
        try {
          await whatsapp.start();
          if (intent && pcQrDisplay && options.onPcDisplay && !blocked() && !shutdownStarted) {
            try { await options.onPcDisplay(intent); } catch { pcDisplay?.unavailable(intent); }
          }
        } catch (error) { if (intent) pcDisplay?.expire(); throw error; }
      })();
      operation = { displayOnPc, work }; connects.set(input.requestId, operation);
    }
    await operation.work; return whatsappStatus();
  });
  app.post('/v1/whatsapp/disconnect', async request => {
    Request.strict().parse(request.body);pcDisplay?.expire();replyWindow.clear(); await whatsapp?.stop(); return { disconnected: true };
  });
  app.post('/v1/model-consent', async request => {
    const body = Request.extend({ consent: z.boolean() }).strict().parse(request.body);
    return flow.setModelConsent(body.consent, body.requestId);
  });
  app.get('/v1/conversations/:id/messages', async request => {
    const { id } = Id.parse(request.params); flow.conversation(id);
    return options.store.recentMessages(accountId,id,100,now());
  });
  app.get('/v1/conversations/:id/history',async request=>{
    const {id}=Id.parse(request.params);flow.conversation(id);
    const messages=options.store.recentMessages(accountId,id,100,now());
    return{messages,watermark:options.store.historyWatermark(accountId,id,messages.map(m=>m.id))};
  });
  app.get('/v1/conversations/:id/history-page',async request=>{
    const {id}=Id.parse(request.params);flow.conversation(id);
    const query=z.object({limit:z.coerce.number().int().min(1).max(100).optional(),before:z.string().max(2048).optional(),
      after:z.string().max(2048).optional(),around:z.string().min(1).max(256).optional()}).strict().parse(request.query);
    return options.store.historyPage(accountId,id,query,now());
  });
  app.post('/v1/conversations/:id/viewed-messages',async request=>{
    const {id}=Id.parse(request.params);
    const body=Request.extend({messageIds:z.array(z.string().min(1).max(256)).min(1).max(100)}).strict().parse(request.body);
    return flow.viewedMessages(id,body.messageIds,body.requestId);
  });
  const MediaParams=Id.extend({messageId:z.string().min(1).max(256)});
  app.get('/v1/conversations/:id/media/:messageId/source',async request=>{
    const {id,messageId}=MediaParams.parse(request.params);
    const {variant}=z.object({variant:MediaVariant}).strict().parse(request.query);
    return display.source(id,messageId,variant);
  });
  app.get('/v1/conversations/:id/media/:messageId/content',async(request,reply)=>{
    const {id,messageId}=MediaParams.parse(request.params);
    const {variant,sourceVersion}=z.object({variant:MediaVariant,sourceVersion:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(request.query);
    if(request.headers.range)throw new DomainError('media_range_unsupported',416);
    const result=await display.content(id,messageId,variant,sourceVersion);
    display.check(id,messageId,variant,sourceVersion);
    mediaReplies.set(request.id,()=>{display.check(id,messageId,variant,sourceVersion);});
    return reply.header('X-Otherme-Media-Version',sourceVersion).type(result.mime).send(result.bytes);
  });
  app.get('/v1/conversations/:id/media/:messageId',async(request,reply)=>{
    const {id,messageId}=Id.extend({messageId:z.string().min(1).max(256)}).parse(request.params);flow.conversation(id);
    const source=options.store.historySource(accountId,id,messageId,now());
    const message=source?.state==='available' ? source.message : undefined;
    if(!message)throw new DomainError('media_unavailable',404);
    if(message.media?.kind==='audio')return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').type('audio/mpeg').send(await audio.preview(message));
    const preview=await media.preview(message);
    return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').type(preview.mime).send(preview.bytes);
  });
  app.post('/v1/conversations/:id/viewed',async request=>{
    const {id}=Id.parse(request.params);flow.conversation(id);
    const body=Request.extend({watermark:z.number().int().nonnegative()}).strict().parse(request.body);
    options.store.markViewedPosition(accountId,id,body.watermark);return{viewed:true};
  });
  app.post('/v1/conversations/:id/pause', async request => {
    const { id } = Id.parse(request.params); const body = Request.strict().parse(request.body);
    return { acknowledged: true, conversation: flow.pause(id, body.requestId) };
  });
  app.post('/v1/conversations/:id/composer', async request => {
    const { id } = Id.parse(request.params);
    const body = Request.extend({ hasText:z.boolean(),clientId:z.string().uuid() }).strict().parse(request.body);
    return { acknowledged:true, conversation:flow.composer(id,body.hasText,body.requestId,body.clientId) };
  });
  app.post('/v1/conversations/:id/control', async request => {
    const { id } = Id.parse(request.params);
    const body = Request.extend({ action:z.enum(['resume','extend','indefinite']) }).strict().parse(request.body);
    return flow.quickControl(id,body.action,body.requestId);
  });
  app.post('/v1/conversations/:id/manual-send', async request => {
    const { id } = Id.parse(request.params);
    const body = Request.extend({ action: OwnerAction, quotedMessageId: z.string().nullable().default(null) }).strict().parse(request.body);
    const retired=options.store.historyGroup(accountId,id).id!==id;
    if(!retired)ready();
    const queued = flow.manualSend(id, body.action, body.requestId, body.quotedMessageId);
    return { simulated: !whatsapp, outbox: retired ? queued : await dispatch(queued.id) };
  });
  app.post('/v1/conversations/:id/draft', async request => {
    const { id } = Id.parse(request.params); const body = Request.strict().parse(request.body);
    return generateDraft(id, body.requestId);
  });
  app.post('/v1/drafts/:id/decision', async request => {
    const { id } = Id.parse(request.params);
    const body = Request.extend({ operation: z.enum(['approve','edit','dismiss','needs_owner']), revision: z.number().int().positive(), action: Action.optional() }).strict().parse(request.body);
    if (body.operation === 'dismiss') return { draft: flow.dismissDraft(id, body.requestId), outbox: null };
    if (body.operation === 'edit' || body.operation === 'needs_owner') {
      const action = body.operation === 'needs_owner' ? { kind: 'handover' as const, reason: 'The owner marked this conversation as their responsibility.' } : body.action;
      if (!action) throw new DomainError('action_required', 422);
      return { draft: flow.editDraft(id, action, body.revision, body.requestId), outbox: null };
    }
    const original=options.store.draft(accountId,id);
    const retired=original && options.store.historyGroup(accountId,original.conversationId).id!==original.conversationId;
    if(!retired)ready();
    const queued = flow.approve(id, body.revision, body.requestId);
    return { simulated: !whatsapp, outbox: retired ? queued : await dispatch(queued.id), draft: options.store.draft(accountId, id) };
  });
  app.post('/v1/conversations/:id/owner-actions', async request => {
    const { id } = Id.parse(request.params);
    const body = z.discriminatedUnion('kind', [
      Request.extend({ kind: z.literal('change_mode'), mode: z.enum(['never_reply','draft_only','auto_reply']) }).strict(),
      Request.extend({ kind: z.literal('delegate'), maxUnits: z.number().int().positive().nullable(), expiresAt: z.number().positive().nullable(), acknowledgeRisk:z.boolean().optional() }).strict(),
      Request.extend({ kind: z.literal('resume') }).strict(),
      Request.extend({ kind: z.literal('configure'), mode: z.enum(['never_reply','draft_only','auto_reply']), maxUnits: z.number().int().positive().nullable().optional(), expiresAt: z.number().positive().nullable().optional(), acknowledgeRisk:z.boolean().optional() }).strict(),
    ]).parse(request.body);
    const { requestId, ...input } = body;
    return flow.propose(id, input, requestId);
  });
  app.post('/v1/owner-actions/:id/confirm', async request => {
    const { id } = Id.parse(request.params);
    const body = Request.extend({ payloadHash: z.string().length(64) }).strict().parse(request.body);
    return flow.confirm(id, body.payloadHash, body.requestId);
  });
  app.get('/v1/assistant/turns', async () => options.store.assistantTurns(accountId));
  app.post('/v1/assistant/turns', async request => {
    const body = Request.extend({ text: z.string().trim().min(1).max(4000) }).strict().parse(request.body);
    return assistantTurn(flow, body.text, body.requestId, now(), generateDraft);
  });
  app.get('/v1/review', async () => attention(flow, now()-5*60*60*1000, now()));
  app.post('/v1/conversations/:id/demo-incoming', async request => {
    if (whatsapp) throw new DomainError('demo_endpoint_disabled',403);
    const { id } = Id.parse(request.params);
    const body = Request.extend({ text: z.string().max(4000), source: z.enum(['live','backfill','replay','unknown']).default('live'),
      media: z.enum(['image','sticker','gif']).nullable().default(null) }).strict().parse(request.body);
    const c = flow.conversation(id); const transportId = 'demo-inbound-'+body.requestId;
    const previous = options.store.messages(DEMO_ACCOUNT, id).find(m => m.transportId === transportId);
    if (previous && (previous.text !== body.text || previous.source !== body.source || previous.media?.kind !== (body.media ?? undefined)))
      throw new DomainError('request_id_conflict');
    const message: Message = { id: transportId, accountId: DEMO_ACCOUNT, conversationId: id, transportId,
      direction: 'inbound', authorship: 'contact_written', text: body.text, occurredAt: now(), source: body.source,
      quotedMessageId: null, statusReply: false, statusContext: null, reaction: null,
      media: body.media ? { kind: body.media, access: 'available', fixture: body.media, description: 'Synthetic demo media', viewOnce: false, expiresAt: null } : null };
    const inserted = flow.observe(message);
    if(inserted && aiAccess(c,DEMO_ACCOUNT))await replyWindow.enqueue(message);
    return snapshot();
  });
  const catchUps = new Map<string,Promise<void>>();
  const timer = setInterval(() => {
    if (blocked()) return;
    for (const job of flow.expirePauses()) {
      if (catchUps.size >= 4 || catchUps.has(job.conversationId)) continue;
      if (whatsapp && (!options.remoteModel || !options.store.modelConsent(accountId))) continue;
      const candidate = flow.conversation(job.conversationId);
      if (candidate.mode === null && !latestTen(flow.effectiveConversations(),accountId,now()).includes(candidate.id)) { flow.finishCatchUp(candidate.id,job.messageId); continue; }
      const current = options.store.recentMessages(accountId,job.conversationId,100,now()).at(-1);
      if (current?.id !== job.messageId || current.direction !== 'inbound') { flow.finishCatchUp(job.conversationId,job.messageId); continue; }
      const task = generateDraft(job.conversationId,'cooldown-'+job.messageId+':'+job.workflowVersion).then(() => {}).catch(() => {
        // A catch-up attempt never sends. The owner can request a new draft explicitly.
      }).finally(() => { flow.finishCatchUp(job.conversationId,job.messageId); catchUps.delete(job.conversationId); });
      catchUps.set(job.conversationId,task);
    }
  },1000);
  timer.unref();
  let shutdownStarted = false;
  let transportStopped: Promise<void> | undefined;
  const phase = options.onShutdownPhase ?? (() => {});
  const beginShutdown = () => {
    if (shutdownStarted) return;
    shutdownStarted = true; gated = true; pcDisplay?.expire(); clearInterval(timer); replyWindow.clear();
    phase('gating');
    phase('transport');
    transportStopped = (async () => { await whatsapp?.quiesce(); })();
    // Attach a handler now even if an admitted HTTP request delays onClose.
    void transportStopped?.catch(() => {});
  };
  app.addHook('preClose', async () => {
    beginShutdown(); phase('requests'); app.server.closeIdleConnections();
  });
  app.addHook('onClose', async () => {
    beginShutdown();
    phase('transport'); await transportStopped;
    phase('requests'); await Promise.all([...admitted.values()].map(a => a.promise));
    phase('reply-work'); await replyWindow.close(); await Promise.allSettled(catchUps.values());
    phase('workflow'); await flow.drain();
    phase('profile-transition'); await transitionWork;
    phase('storage'); audio.close(); options.store.close();
    phase('stopped');
  });
  return Object.assign(app, { beginShutdown, acknowledgePcDisplay: (message: unknown) => pcDisplay?.acknowledge(message) });
}
