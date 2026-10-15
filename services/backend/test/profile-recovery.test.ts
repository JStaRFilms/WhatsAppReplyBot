import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { SqliteStore, Workflow, type Conversation } from '@replybot/core';
import { type ProfileScope } from '@replybot/core/api';
import { ProfileRegistry } from '../src/profiles.ts';
import { createApp } from '../src/server.ts';

const token = 'synthetic-owner-token';
const headers = (s: ProfileScope) => ({ authorization: 'Bearer '+token, 'x-otherme-profile': s.profileId, 'x-otherme-revision': String(s.revision) });
const conversation = (accountId: string): Conversation => ({ id: '123@s.whatsapp.net', accountId, contactId: '123', name: 'Synthetic', kind: 'direct', mode: 'auto_reply', excluded: false, control: 'assistant_allowed', workflowVersion: 1, policyVersion: 1, lastHumanActivityAt: 0, hours: null });
function fixture() {
  const runtime = mkdtempSync(join(tmpdir(), 'otherme-synthetic-recovery-')); const registry = new ProfileRegistry(runtime);
  return { runtime, registry, dispose: () => rmSync(runtime, { recursive: true, force: true }) };
}

test('HTTP handoff refusal leaves journal and consent untouched and reopens admission', async () => {
  const f = fixture(); const scope = f.registry.scope(); const store = new SqliteStore();
  const app = createApp({ store, token, accountId: scope.accountId, profileScope: scope, seed: false,
    profiles: { registry: f.registry, onQuiesced: async () => assert.fail('An active handoff cannot notify restart') } });
  try {
    store.saveConversation(conversation(scope.accountId)); store.saveModelConsent(scope.accountId, true);
    const flow = new Workflow(store, scope.accountId);
    const sending = flow.manualSend(conversation(scope.accountId).id, { kind: 'text', text: 'Fixture', reason: 'Synthetic' }, 'sending');
    const first = sending.components[0]; assert.ok(first); first.state = 'dispatching'; sending.state = 'dispatching'; store.saveOutbox(sending);
    const response = await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: { kind: 'create', requestId: 'busy', confirm: true, label: 'B' } });
    assert.equal(response.statusCode, 409); assert.equal(response.json().error, 'profile_handoff_active');
    assert.equal(store.modelConsent(scope.accountId), true); assert.equal(store.outbox(scope.accountId, sending.id)?.state, 'dispatching');
    assert.equal(existsSync(join(f.runtime, 'profiles.json')), false);
    assert.equal((await app.inject({ url: '/v1/snapshot', headers: headers(scope) })).statusCode, 200);
    first.state = 'unknown'; sending.state = 'unknown'; store.saveOutbox(sending);
  } finally { await app.close(); f.dispose(); }
});

test('lost launcher acknowledgement remains durably failed; recovery cannot connect, generate or resume timed work', async () => {
  const f = fixture(); const scope = f.registry.scope(); const store = new SqliteStore(); let notifications = 0;
  store.saveConversation(conversation(scope.accountId));
  let app = createApp({ store, token, seed: false, accountId: scope.accountId, profileScope: scope,
    profiles: { registry: f.registry, onQuiesced: async () => { notifications++; throw new Error('launcher_ack_timeout'); } } });
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: { kind: 'create', requestId: 'lost-ack', label: 'B', confirm: true } });
    assert.equal(response.statusCode, 202);
    for (let i = 0; i < 100 && f.registry.current()?.state !== 'failed'; i++) await delay(10);
    assert.equal(f.registry.current()?.error, 'launcher_ack_timeout'); assert.equal(notifications, 1);
    assert.throws(() => f.registry.prepareAfterExit('lost-ack'));
  } finally { await app.close(); }
  const recovered = new ProfileRegistry(f.runtime); const nextScope = recovered.scope(); const recoveredStore = new SqliteStore(); let models = 0;
  recoveredStore.saveConversation({ ...conversation(nextScope.accountId), control: 'manual', pause: { until: 1, indefinite: false, handover: false, composing: false, typingUntil: 1, sending: false, catchUpMessageId: 'inbound' } });
  recoveredStore.saveModelConsent(nextScope.accountId, true);
  app = createApp({ store: recoveredStore, token, seed: false, accountId: nextScope.accountId, profileScope: nextScope,
    profiles: { registry: recovered }, remoteModel: { generate: async () => { models++; return { kind: 'silence', reason: 'Fixture' }; } },
    whatsapp: { authDir: join(f.runtime, 'must-not-be-created') } });
  try {
    await delay(1050);
    assert.equal(models, 0); assert.equal(recoveredStore.modelConsent(nextScope.accountId), false);
    assert.equal(recoveredStore.conversation(nextScope.accountId, conversation(nextScope.accountId).id)?.pause?.indefinite, true);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/whatsapp/connect', headers: headers(nextScope), payload: { requestId: 'connect', confirm: true } })).statusCode, 409);
    assert.equal(existsSync(join(f.runtime, 'must-not-be-created')), false);
    assert.equal((await app.inject({ url: '/v1/profile-operations/lost-ack', headers: { authorization: 'Bearer '+token } })).json().state, 'failed');
  } finally { await app.close(); f.dispose(); }
});

test('completed retries are read-only and bound to original body and scope even on a replacement without restart ownership', async () => {
  const f = fixture(); const source = f.registry.scope(); const input = { kind: 'create', requestId: 'complete', label: 'B', confirm: true } as const;
  f.registry.begin(input, source); f.registry.update('complete', 'restarting'); f.registry.acknowledge('complete');
  const scope = f.registry.prepareAfterExit('complete'); f.registry.complete('complete', scope);
  const app = createApp({ store: new SqliteStore(), token, seed: false, accountId: scope.accountId, profileScope: scope, profiles: { registry: f.registry } });
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(source), payload: input });
    assert.equal(response.statusCode, 202); assert.equal(response.json().operation.state, 'completed');
    assert.equal((await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: input })).json().error, 'request_id_conflict');
    assert.equal((await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(source), payload: { ...input, label: 'Changed' } })).json().error, 'request_id_conflict');
    assert.equal(f.registry.scope().revision, 1);
  } finally { await app.close(); f.dispose(); }
});

test('orphaned registry temporary writes never select a target, and malformed journals never fall back to original', () => {
  const f = fixture(); const source = f.registry.scope();
  try {
    f.registry.begin({ kind: 'create', requestId: 'pending', label: 'B', confirm: true }, source);
    const durable = readFileSync(join(f.runtime, 'profiles.json'), 'utf8');
    writeFileSync(join(f.runtime, 'profiles.json.synthetic.tmp'), '{"activeProfileId":"not-committed"');
    const recovered = new ProfileRegistry(f.runtime);
    assert.equal(recovered.scope().profileId, 'original'); assert.equal(recovered.blocked(), true); assert.equal(recovered.current()?.state, 'quiescing');
    writeFileSync(join(f.runtime, 'profiles.json'), '{'); assert.throws(() => recovered.scope());
    writeFileSync(join(f.runtime, 'profiles.json'), durable.replace('"currentRequestId":"pending"', '"currentRequestId":"missing"'));
    assert.throws(() => recovered.blocked(), /invalid_profile_registry/);
  } finally { f.dispose(); }
});
