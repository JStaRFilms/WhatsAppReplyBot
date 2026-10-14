import Fastify from 'fastify';
import cors from '@fastify/cors';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Action, DomainError, Workflow, aiAccess, automaticDecision, latestTen, type Message, type SqliteStore } from '@replybot/core';
import { ClientSnapshot } from '@replybot/core/api';
import { assistantTurn, attention } from './assistant.ts';
import { draftGenerator, type RemoteModel } from './draft-model.ts';
import { WhatsAppAdapter } from './whatsapp.ts';
import { DEMO_ACCOUNT, seedDemo } from './seed.ts';

const Request = z.object({ requestId: z.string().min(1).max(96) });
const Id = z.object({ id: z.string().min(1).max(128) });
const localOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
export function createApp(options: { store: SqliteStore; token: string; now?: () => number; seed?: boolean; remoteModel?: RemoteModel; whatsapp?: { authDir: string }; allowedOrigins?: string[] }) {
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  const now = options.now ?? Date.now;
  const accountId = options.whatsapp ? 'whatsapp-owner' : DEMO_ACCOUNT;
  const flow = new Workflow(options.store, accountId, now);
  if (!options.whatsapp && options.seed !== false) seedDemo(options.store, now());
  flow.recover();
  const generateDraft = draftGenerator(flow, options.remoteModel);
  const allowedOrigin = (origin: string) => localOrigin(origin) || (options.allowedOrigins ?? []).includes(origin);
  const whatsapp = options.whatsapp ? new WhatsAppAdapter(flow, options.whatsapp.authDir, async message => {
    if (!options.remoteModel || !options.store.modelConsent(accountId)) return;
    const c = flow.conversation(message.conversationId);
    const grant = options.store.grants(accountId,c.id).find(g => g.state === 'active');
    const decision = automaticDecision(c, options.store.conversations(accountId), accountId, now(), message.source, grant);
    if (decision === 'none') return;
    const draft = await generateDraft(c.id,'wa-draft-'+message.id);
    if (decision === 'auto' && draft.state === 'pending') await whatsapp?.dispatch(flow.autoSend(draft.id,'wa-auto-'+draft.id).id);
  }) : undefined;
  app.register(cors, { origin: (origin, callback) => callback(null, !origin || allowedOrigin(origin)) });
  app.addHook('onRequest', async (request, reply) => {
    const ip = request.ip.replace(/^::ffff:/,'');
    if (!(ip === '::1' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))) return reply.code(403).send({ error: 'private_network_only' });
    const origin = request.headers.origin;
    if (origin && !allowedOrigin(origin)) return reply.code(403).send({ error: 'origin_denied' });
    if (request.url === '/v1/health' || request.url === '/v1/local-provision' || request.method === 'OPTIONS') return;
    const auth = request.headers.authorization;
    const provided = Buffer.from(auth?.startsWith('Bearer ') ? auth.slice(7) : '');
    const expected = Buffer.from(options.token);
    if (!provided.length || provided.length !== expected.length || !timingSafeEqual(provided, expected))
      return reply.code(401).send({ error: 'owner_auth_required' });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) return reply.code(error.status).send({ error: error.code });
    if (error instanceof z.ZodError) return reply.code(422).send({ error: 'invalid_request' });
    return reply.code(500).send({ error: 'service_error' });
  });
  const snapshot = () => ClientSnapshot.parse({ ...flow.snapshot(), demo: !whatsapp, connection: whatsapp?.snapshot().state ?? 'disconnected', model: options.remoteModel ? 'openai/gpt-6-luna' : 'local-demo',
    modelConsent: options.store.modelConsent(accountId),
    lastMessages: options.store.conversations(accountId).map(c => options.store.messages(accountId, c.id).at(-1)).filter(m => m !== undefined),
    latestTenIds: latestTen(options.store.conversations(accountId), accountId, now()) });
  const dispatch = (id: string) => whatsapp ? whatsapp.dispatch(id) : flow.dispatch(id, async () => ({ state: 'accepted', transportId: 'demo-'+randomUUID() }));
  const ready = () => whatsapp?.requireReady();
  app.get('/v1/health', async () => ({ demo: !whatsapp, service: 'ready', whatsapp: whatsapp?.snapshot().state ?? 'disconnected', model: options.remoteModel ? 'openai/gpt-6-luna' : 'local-demo' }));
  app.post('/v1/local-provision', async request => {
    z.object({ confirmLocalDemo: z.literal(true) }).strict().parse(request.body);
    if (!['127.0.0.1', '::1'].includes(request.ip) || !request.headers.origin || !localOrigin(request.headers.origin))
      throw new DomainError('local_browser_provision_only', 403);
    return { token: options.token, demo: !whatsapp };
  });
  app.get('/v1/snapshot', async () => snapshot());
  app.get('/v1/whatsapp', async () => whatsapp?.snapshot() ?? { state: 'disconnected', qr: null, error: null, historyMessages: 0 });
  app.post('/v1/whatsapp/connect', async request => {
    Request.extend({ confirm: z.literal(true) }).strict().parse(request.body);
    if (!whatsapp) throw new DomainError('start_live_backend',409);
    await whatsapp.start(); return whatsapp.snapshot();
  });
  app.post('/v1/whatsapp/disconnect', async request => {
    Request.strict().parse(request.body); await whatsapp?.stop(); return { disconnected: true };
  });
  app.post('/v1/model-consent', async request => {
    const body = Request.extend({ consent: z.boolean() }).strict().parse(request.body);
    return flow.setModelConsent(body.consent, body.requestId);
  });
  app.get('/v1/conversations/:id/messages', async request => {
    const { id } = Id.parse(request.params); flow.conversation(id);
    return options.store.messages(accountId, id).slice(-100);
  });
  app.post('/v1/conversations/:id/pause', async request => {
    const { id } = Id.parse(request.params); const body = Request.strict().parse(request.body);
    return { acknowledged: true, conversation: flow.pause(id, body.requestId) };
  });
  app.post('/v1/conversations/:id/manual-send', async request => {
    const { id } = Id.parse(request.params);
    const body = Request.extend({ action: Action, quotedMessageId: z.string().nullable().default(null) }).strict().parse(request.body);
    ready();
    const queued = flow.manualSend(id, body.action, body.requestId, body.quotedMessageId);
    return { simulated: !whatsapp, outbox: await dispatch(queued.id) };
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
    ready();
    const queued = flow.approve(id, body.revision, body.requestId);
    return { simulated: !whatsapp, outbox: await dispatch(queued.id), draft: options.store.draft(accountId, id) };
  });
  app.post('/v1/conversations/:id/owner-actions', async request => {
    const { id } = Id.parse(request.params);
    const body = z.discriminatedUnion('kind', [
      Request.extend({ kind: z.literal('change_mode'), mode: z.enum(['never_reply','draft_only','auto_reply']) }).strict(),
      Request.extend({ kind: z.literal('delegate'), maxUnits: z.number().int().min(1).max(20), expiresAt: z.number() }).strict(),
      Request.extend({ kind: z.literal('resume') }).strict(),
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
    if (inserted && aiAccess(c, DEMO_ACCOUNT)) {
      const current = flow.conversation(id);
      const grant = options.store.grants(DEMO_ACCOUNT, id).find(g => g.state === 'active');
      const decision = automaticDecision(current, options.store.conversations(DEMO_ACCOUNT), DEMO_ACCOUNT, now(), body.source, grant);
      if (decision !== 'none') {
        const d = await generateDraft(id, body.requestId+'-draft');
        if (decision === 'auto' && d.state === 'pending') {
          const queued = flow.autoSend(d.id, body.requestId+'-auto'); await dispatch(queued.id);
        }
      }
    }
    return snapshot();
  });
  app.addHook('onClose', async () => { await whatsapp?.stop(); options.store.close(); });
  return app;
}
