import Fastify from 'fastify';
import cors from '@fastify/cors';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Action, DomainError, Workflow, aiAccess, automaticDecision, latestTen, type Message, type SqliteStore } from '@replybot/core';
import { ClientSnapshot } from '@replybot/core/api';
import { assistantTurn, attention } from './assistant.ts';
import { draftGenerator, type RemoteModel } from './draft-model.ts';
import { DEMO_ACCOUNT, seedDemo } from './seed.ts';

const Request = z.object({ requestId: z.string().min(1).max(96) });
const Id = z.object({ id: z.string().min(1).max(128) });
const localOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
export function createApp(options: { store: SqliteStore; token: string; now?: () => number; seed?: boolean; remoteModel?: RemoteModel }) {
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  const now = options.now ?? Date.now;
  const flow = new Workflow(options.store, DEMO_ACCOUNT, now);
  if (options.seed !== false) seedDemo(options.store, now());
  flow.recover();
  const generateDraft = draftGenerator(flow, options.remoteModel);
  app.register(cors, { origin: (origin, callback) => callback(null, !origin || localOrigin(origin)) });
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && !localOrigin(origin)) return reply.code(403).send({ error: 'origin_denied' });
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
  const snapshot = () => ClientSnapshot.parse({ ...flow.snapshot(), model: options.remoteModel ? 'openai/gpt-6-luna' : 'local-demo',
    modelConsent: options.store.modelConsent(DEMO_ACCOUNT),
    lastMessages: options.store.conversations(DEMO_ACCOUNT).map(c => options.store.messages(DEMO_ACCOUNT, c.id).at(-1)).filter(m => m !== undefined),
    latestTenIds: latestTen(options.store.conversations(DEMO_ACCOUNT), DEMO_ACCOUNT, now()) });
  const simulate = (id: string) => flow.dispatch(id, async () => ({ state: 'accepted', transportId: 'demo-'+randomUUID() }));
  app.get('/v1/health', async () => ({ demo: true, service: 'ready', whatsapp: 'disconnected', model: options.remoteModel ? 'openai/gpt-6-luna' : 'local-demo' }));
  app.post('/v1/local-provision', async request => {
    z.object({ confirmLocalDemo: z.literal(true) }).strict().parse(request.body);
    if (!['127.0.0.1', '::1'].includes(request.ip) || !request.headers.origin || !localOrigin(request.headers.origin))
      throw new DomainError('local_browser_provision_only', 403);
    return { token: options.token, demo: true };
  });
  app.get('/v1/snapshot', async () => snapshot());
  app.post('/v1/model-consent', async request => {
    const body = Request.extend({ consent: z.boolean() }).strict().parse(request.body);
    return flow.setModelConsent(body.consent, body.requestId);
  });
  app.get('/v1/conversations/:id/messages', async request => {
    const { id } = Id.parse(request.params); flow.conversation(id);
    return options.store.messages(DEMO_ACCOUNT, id).slice(-100);
  });
  app.post('/v1/conversations/:id/pause', async request => {
    const { id } = Id.parse(request.params); const body = Request.strict().parse(request.body);
    return { acknowledged: true, conversation: flow.pause(id, body.requestId) };
  });
  app.post('/v1/conversations/:id/manual-send', async request => {
    const { id } = Id.parse(request.params);
    const body = Request.extend({ action: Action, quotedMessageId: z.string().nullable().default(null) }).strict().parse(request.body);
    const queued = flow.manualSend(id, body.action, body.requestId, body.quotedMessageId);
    return { simulated: true, outbox: await simulate(queued.id) };
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
    const queued = flow.approve(id, body.revision, body.requestId);
    return { simulated: true, outbox: await simulate(queued.id), draft: options.store.draft(DEMO_ACCOUNT, id) };
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
  app.get('/v1/assistant/turns', async () => options.store.assistantTurns(DEMO_ACCOUNT));
  app.post('/v1/assistant/turns', async request => {
    const body = Request.extend({ text: z.string().trim().min(1).max(4000) }).strict().parse(request.body);
    return assistantTurn(flow, body.text, body.requestId, now(), generateDraft);
  });
  app.get('/v1/review', async () => attention(flow, now()-5*60*60*1000, now()));
  app.post('/v1/conversations/:id/demo-incoming', async request => {
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
          const queued = flow.autoSend(d.id, body.requestId+'-auto'); await simulate(queued.id);
        }
      }
    }
    return snapshot();
  });
  app.addHook('onClose', async () => options.store.close());
  return app;
}
