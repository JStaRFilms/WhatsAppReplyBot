import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { SqliteStore, Workflow, type Conversation } from '@replybot/core';
import { ProfileTransitionInput, SessionDiscovery, type ProfileScope } from '@replybot/core/api';
import { ProfileRegistry, profilePaths } from '../src/profiles.ts';
import { createApp } from '../src/server.ts';
import { WhatsAppAdapter } from '../src/whatsapp.ts';

const token = 'synthetic-owner-token';
const authorization = 'Bearer '+token;
const headers = (scope: ProfileScope) => ({ authorization, 'x-otherme-profile': scope.profileId, 'x-otherme-revision': String(scope.revision) });
const chat = (accountId: string): Conversation => ({ id: 'same@s.whatsapp.net', accountId, contactId: 'same', name: 'Synthetic', kind: 'direct', mode: 'auto_reply', excluded: false, control: 'assistant_allowed', workflowVersion: 1, policyVersion: 1, lastHumanActivityAt: 0, hours: null });
function fixture() {
  const runtime = mkdtempSync(join(tmpdir(), 'otherme-synthetic-profiles-'));
  return { runtime, registry: new ProfileRegistry(runtime), dispose: () => rmSync(runtime, { recursive: true, force: true }) };
}
async function until(check: () => boolean) {
  for (let i = 0; i < 100; i++) { if (check()) return; await delay(10); }
  assert.fail('Fixture operation did not settle');
}
function finish(registry: ProfileRegistry, id: string) {
  registry.update(id, 'restarting'); registry.acknowledge(id);
  const scope = registry.prepareAfterExit(id); registry.complete(id, scope); return scope;
}

test('durable A/B/A revisions, request/source binding and separate databases isolate identical IDs', () => {
  const f = fixture();
  try {
    const a = f.registry.scope();
    assert.equal(existsSync(join(f.runtime, 'profiles.json')), false);
    const input = ProfileTransitionInput.parse({ kind: 'create', requestId: 'create-b', label: 'Second', confirm: true });
    assert.equal(input.kind, 'create');
    if (input.kind !== 'create') assert.fail('Expected create input');
    const operation = f.registry.begin(input, a);
    assert.equal(f.registry.replay(input, a.profileId, a.revision)?.requestId, operation.requestId);
    assert.throws(() => f.registry.replay({ ...input, label: 'Changed' }, a.profileId, a.revision));
    const b = finish(f.registry, operation.requestId);
    assert.equal(b.revision, 1); assert.notEqual(b.accountId, a.accountId);
    assert.throws(() => f.registry.replay(input, b.profileId, b.revision));
    for (const [scope, text] of [[a, 'A'], [b, 'B']] as const) {
      const paths = profilePaths(f.runtime, scope.profileId); mkdirSync(dirname(paths.database), { recursive: true });
      const store = new SqliteStore(paths.database);
      store.saveConversation(chat(scope.accountId));
      store.saveMessage({ id: 'same-message', accountId: scope.accountId, conversationId: chat(scope.accountId).id,
        transportId: 'same-transport', direction: 'inbound', authorship: 'contact_written', text, occurredAt: 1,
        source: 'backfill', quotedMessageId: null, statusReply: false, statusContext: null, media: null, reaction: null });
      store.saveWaAlias(scope.accountId, 'same@lid', text+'@s.whatsapp.net');
      store.close();
    }
    f.registry.begin({ kind: 'activate', profileId: 'original', requestId: 'back-a', confirm: true }, b);
    const returned = finish(f.registry, 'back-a');
    assert.equal(returned.profileId, a.profileId); assert.equal(returned.revision, 2);
    assert.deepEqual(new ProfileRegistry(f.runtime).scope(), returned);
    for (const [scope, text] of [[returned, 'A'], [b, 'B']] as const) {
      const store = new SqliteStore(profilePaths(f.runtime, scope.profileId).database);
      assert.equal(store.message(scope.accountId, 'same-message')?.text, text);
      assert.equal(store.waCanonical(scope.accountId, 'same@lid'), text+'@s.whatsapp.net');
      store.close();
    }
    assert.throws(() => profilePaths(f.runtime, '../escape'));
    assert.throws(() => f.registry.begin({ kind: 'create', requestId: 'old-a', label: 'No', confirm: true }, a));
    assert.throws(() => ProfileTransitionInput.parse({ kind: 'repair', requestId: 'bad', confirm: true, authDir: 'x' }));
  } finally { f.dispose(); }
});

test('scope admission rejects old clients and binary bodies before parsing, including first A after A/B/A', async () => {
  const f = fixture(); const first = f.registry.scope();
  f.registry.begin({ kind: 'create', requestId: 'b', label: 'B', confirm: true }, first); const b = finish(f.registry, 'b');
  f.registry.begin({ kind: 'activate', requestId: 'a', profileId: 'original', confirm: true }, b); const scope = finish(f.registry, 'a');
  const app = createApp({ store: new SqliteStore(), token, seed: false, accountId: scope.accountId, profileScope: scope, profiles: { registry: f.registry } });
  try {
    assert.equal((await app.inject({ url: '/v1/session' })).statusCode, 401);
    SessionDiscovery.parse((await app.inject({ url: '/v1/session', headers: { authorization } })).json());
    for (const url of ['/v1/snapshot', '/v1/conversations/same/history', '/v1/conversations/same/media/target', '/v1/model-consent', '/v1/conversations/same/uploads', '/v1/conversations/same/audio-uploads']) {
      const method = url.includes('consent') || url.endsWith('uploads') ? 'POST' : 'GET';
      for (const [requestHeaders, status] of [[{ authorization }, 426], [headers(first), 409], [headers(b), 409]] as const) {
        const response = await app.inject({ method, url, headers: { ...requestHeaders, 'content-type': 'application/octet-stream' }, payload: Buffer.from('not a valid body') });
        assert.equal(response.statusCode, status, url);
      }
    }
    const snapshot = await app.inject({ url: '/v1/snapshot', headers: headers(scope) });
    assert.equal(snapshot.statusCode, 200); assert.deepEqual(snapshot.json().profileScope, scope);
    assert.equal(snapshot.headers['x-otherme-revision'], '2');
    assert.equal((await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: { kind: 'create', requestId: 'direct', label: 'No launcher', confirm: true } })).json().error, 'launcher_restart_required');
  } finally { await app.close(); f.dispose(); }
});

test('transition returns 202, drains before notification, rejects new admission and only replays exact original input', async () => {
  const f = fixture(); const scope = f.registry.scope(); const store = new SqliteStore();
  store.saveConversation(chat(scope.accountId)); store.saveModelConsent(scope.accountId, true);
  let notifications = 0;
  const app = createApp({ store, token, seed: false, accountId: scope.accountId, profileScope: scope,
    profiles: { registry: f.registry, onQuiesced: async () => { notifications++; } } });
  const input = { kind: 'create', requestId: 'switch', label: 'B', confirm: true };
  try {
    const result = await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: input });
    assert.equal(result.statusCode, 202); assert.equal(result.json().operation.state, 'quiescing');
    await until(() => notifications === 1);
    assert.equal(f.registry.operation('switch').state, 'restarting');
    assert.equal(store.modelConsent(scope.accountId), false);
    assert.equal(store.conversation(scope.accountId, chat(scope.accountId).id)?.pause?.indefinite, true);
    assert.equal((await app.inject({ url: '/v1/snapshot', headers: headers(scope) })).json().error, 'profile_transition_in_progress');
    assert.equal((await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: input })).statusCode, 202);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: { ...input, label: 'Different' } })).json().error, 'request_id_conflict');
    assert.equal(notifications, 1);
  } finally { await app.close(); f.dispose(); }
});

test('discovery retains the runtime scope while quiescing, then advances with the replacement profile',async()=>{
  const f=fixture();let active=f.registry.scope();
  try{
    for(const [requestId,input] of [
      ['create-b',{kind:'create',label:'B',confirm:true}],
      ['return-a',{kind:'activate',profileId:'original',confirm:true}],
    ] as const){
      let notified=false;
      const app=createApp({store:new SqliteStore(),token,seed:false,accountId:active.accountId,profileScope:active,
        profiles:{registry:f.registry,onQuiesced:async()=>{notified=true;}}});
      try{
        const response=await app.inject({method:'POST',url:'/v1/profile-transitions',headers:headers(active),payload:{...input,requestId}});
        assert.equal(response.statusCode,202);await until(()=>notified);
        const discovery=SessionDiscovery.parse((await app.inject({url:'/v1/session',headers:{authorization}})).json());
        assert.deepEqual(discovery.scope,active);
        assert.equal(discovery.transition?.state,'restarting');
        assert.equal(f.registry.scope().revision,active.revision+1);
      }finally{await app.close();}
      const previous=active;active=finish(f.registry,requestId);
      const replacement=createApp({store:new SqliteStore(),token,seed:false,accountId:active.accountId,profileScope:active,profiles:{registry:f.registry,activation:true}});
      try{
        const discovery=SessionDiscovery.parse((await replacement.inject({url:'/v1/session',headers:{authorization}})).json());
        assert.deepEqual(discovery.scope,active);assert.equal(discovery.scope.revision,previous.revision+1);
        assert.notEqual(discovery.scope.profileId,previous.profileId);
        assert.equal(discovery.transition?.state,'completed');
        assert.equal((await replacement.inject({url:'/v1/snapshot',headers:headers(active)})).statusCode,200);
      }finally{await replacement.close();}
    }
  }finally{f.dispose();}
});

test('admitted model work is drained; timeout stays blocked and late completion cannot create a draft', async () => {
  const f = fixture(); const scope = f.registry.scope(); const store = new SqliteStore();
  store.saveConversation(chat(scope.accountId)); store.saveModelConsent(scope.accountId, true);
  let complete: () => void = () => {}; let entered: () => void = () => {};
  const started = new Promise<void>(resolve => { entered = resolve; });
  const model = new Promise<void>(resolve => { complete = resolve; }); let notified = false;
  const app = createApp({ store, token, seed: false, accountId: scope.accountId, profileScope: scope,
    remoteModel: { generate: async () => { entered(); await model; return { kind: 'text', text: 'Late synthetic reply', reason: 'Fixture' }; } },
    profiles: { registry: f.registry, drainTimeoutMs: 30, onQuiesced: async () => { notified = true; } } });
  try {
    const drafting = app.inject({ method: 'POST', url: '/v1/conversations/'+chat(scope.accountId).id+'/draft', headers: headers(scope), payload: { requestId: 'draft' } });
    void drafting.then(() => {}); await started;
    assert.equal((await app.inject({ method: 'POST', url: '/v1/profile-transitions', headers: headers(scope), payload: { kind: 'create', label: 'B', requestId: 'timeout', confirm: true } })).statusCode, 202);
    await until(() => f.registry.current()?.state === 'failed');
    assert.equal(f.registry.current()?.error, 'profile_drain_timeout'); assert.equal(notified, false);
    complete(); assert.equal((await drafting).statusCode, 403); assert.deepEqual(store.drafts(scope.accountId), []);
    assert.equal((await app.inject({ url: '/v1/snapshot', headers: headers(f.registry.scope()) })).statusCode, 409);
  } finally { complete(); await app.close(); f.dispose(); }
});

test('repair preserves exact lock and database, requires exit acknowledgement and denies a missing lock', async () => {
  const f = fixture(); const scope = f.registry.scope(); const paths = profilePaths(f.runtime, scope.profileId);
  try {
    const input = { kind: 'repair', requestId: 'repair', confirm: true } as const;
    assert.throws(() => f.registry.begin(input, scope), /owner_identity_required/);
    mkdirSync(paths.auth); const lock = '{ "owner": "456@s.whatsapp.net" }\n';
    writeFileSync(join(paths.auth, 'owner-identity.json'), lock); writeFileSync(join(paths.auth, 'creds.json'), 'synthetic-expired');
    writeFileSync(paths.database, 'unchanged-synthetic-database');
    f.registry.begin(input, scope); f.registry.update('repair', 'restarting');
    assert.throws(() => f.registry.prepareAfterExit('repair')); assert.equal(existsSync(join(paths.auth, 'creds.json')), true);
    f.registry.acknowledge('repair'); const repaired = f.registry.prepareAfterExit('repair');
    assert.equal(repaired.accountId, scope.accountId); assert.equal(repaired.revision, 1);
    assert.equal(readFileSync(join(paths.auth, 'owner-identity.json'), 'utf8'), lock);
    assert.equal(existsSync(join(paths.auth, 'creds.json')), false);
    assert.equal(readFileSync(join(paths.auth+'.archived-repair', 'creds.json'), 'utf8'), 'synthetic-expired');
    assert.equal(readFileSync(paths.database, 'utf8'), 'unchanged-synthetic-database');
    assert.equal(f.registry.requiresOwnerLock(scope.profileId), true);
  } finally { f.dispose(); }
});

test('required repair owner lock denies connect before loading auth or creating a socket', async () => {
  const f = fixture(); const store = new SqliteStore();
  const adapter = new WhatsAppAdapter(new Workflow(store, 'a'), join(f.runtime, 'missing-auth'), async () => {}, undefined, Date.now, true);
  try { await assert.rejects(adapter.start(), /owner_identity_required/); assert.equal(existsSync(join(f.runtime, 'missing-auth')), false); }
  finally { await adapter.stop().catch(() => {}); store.close(); f.dispose(); }
});
