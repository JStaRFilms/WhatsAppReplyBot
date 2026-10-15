import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fork } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { tsImport } from 'tsx/esm/api';
import { ensureService, inspectService, restartOwned, stopOwned } from '../launcher-service.mjs';
const { ProfileRegistry } = await tsImport('../../services/backend/src/profiles.ts', import.meta.url);
const token = 'synthetic-owner-token';
const rootId = 'synthetic-root';
async function portNumber() {
  const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  assert.notEqual(port, 3210); assert.notEqual(port, 8081); assert.notEqual(port, 8083); return port;
}
function spawn(port, instanceId, extras = {}) {
  return fork(new URL('./fake-backend.cjs', import.meta.url), [], { env: { ...process.env,
    TEST_PORT: String(port), TEST_ROOT_ID: rootId, TEST_INSTANCE_ID: instanceId, ...extras },
    execArgv: [], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
}

test('restart verifies owning exit plus durable operation acknowledgement, starts once and publishes isolated scope', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'otherme-synthetic-restart-')); const registry = new ProfileRegistry(runtime);
  const source = registry.scope(); const port = await portNumber(); let old, replacement; let starts = 0;
  try {
    const service = await ensureService({ port, rootId, instanceId: 'old', readToken: () => token, interval: 20,
      start: () => (old = spawn(port, 'old')) });
    registry.begin({ kind: 'create', label: 'B', confirm: true, requestId: 'switch-b' }, source); registry.update('switch-b', 'restarting');
    const options = { child: old, identity: service.identity, port, readToken: () => token, registry,
      requestId: 'switch-b', instanceId: 'new', interval: 30, start: () => {
        assert.equal(old.exitCode, 0); assert.equal(registry.acknowledged('switch-b'), true); starts++;
        return replacement = spawn(port, 'new', { TEST_RUNTIME: runtime, TEST_OPERATION_ID: 'switch-b', TEST_PROFILE_SCOPE: JSON.stringify(registry.scope()) });
      } };
    const work = restartOwned(options); assert.equal(restartOwned(options), work);
    const result = await work;
    assert.equal(starts, 1); assert.notEqual(result.identity.profileScope.accountId, source.accountId);
    assert.equal(result.identity.profileScope.revision, 1); assert.equal(registry.current().state, 'completed');
    assert.equal((await inspectService(port, token, { rootId, instanceId: 'new', profileScope: registry.scope() })).instanceId, 'new');
    assert.equal(restartOwned(options), work); assert.equal(starts, 1);
  } finally {
    if (replacement?.connected) await stopOwned(replacement);
    if (old?.connected) await stopOwned(old);
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('exit timeout cannot prepare or start another profile and does not kill the child', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'otherme-synthetic-exit-timeout-')); const registry = new ProfileRegistry(runtime);
  const scope = registry.scope(); const port = await portNumber(); let child;
  try {
    const service = await ensureService({ port, rootId, instanceId: 'stubborn', readToken: () => token, interval: 20,
      start: () => (child = spawn(port, 'stubborn', { TEST_REFUSE_STOP: '1' })) });
    registry.begin({ kind: 'create', requestId: 'timeout', label: 'B', confirm: true }, scope); registry.update('timeout', 'restarting');
    await assert.rejects(restartOwned({ child, identity: service.identity, port, readToken: () => token, registry,
      requestId: 'timeout', instanceId: 'must-not-start', timeoutMs: 40, start: () => assert.fail('No replacement before exit') }), /timed out/);
    assert.equal(child.exitCode, null); assert.equal(child.connected, true);
    assert.equal(registry.scope().profileId, scope.profileId); assert.equal(registry.current().state, 'failed');
    assert.throws(() => registry.prepareAfterExit('timeout'));
  } finally {
    if (child?.connected) { const exited = once(child, 'exit'); child.send({ type: 'otherme-test-release' }); await exited; }
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('lost IPC acknowledgement times out without stopping the source or starting a target', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'otherme-synthetic-ack-timeout-')); const registry = new ProfileRegistry(runtime);
  const port = await portNumber(); let child, originalSend;
  try {
    const service = await ensureService({ port, rootId, instanceId: 'lost-ack', readToken: () => token, interval: 20,
      start: () => (child = spawn(port, 'lost-ack')) });
    registry.begin({ kind: 'create', requestId: 'lost-ack', label: 'B', confirm: true }, registry.scope()); registry.update('lost-ack', 'restarting');
    originalSend = child.send;
    child.send = function(message, ...args) {
      if (message.type === 'otherme-profile-ack') return true;
      return originalSend.call(this, message, ...args);
    };
    await assert.rejects(restartOwned({ child, identity: service.identity, port, readToken: () => token, registry,
      requestId: 'lost-ack', instanceId: 'new', timeoutMs: 40, start: () => assert.fail('No target without acknowledgement') }), /acknowledgement timed out/);
    assert.equal(child.exitCode, null); assert.equal(registry.current().state, 'failed'); assert.equal(registry.scope().profileId, 'original');
  } finally {
    if (child && originalSend) child.send = originalSend;
    if (child?.connected) await stopOwned(child);
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('Q during restart waits for verified exit but never prepares or starts the target', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'otherme-synthetic-restart-stop-')); const registry = new ProfileRegistry(runtime);
  const source = registry.scope(); const port = await portNumber(); let child;
  try {
    const service = await ensureService({ port, rootId, instanceId: 'stopping-source', readToken: () => token, interval: 20,
      start: () => (child = spawn(port, 'stopping-source')) });
    registry.begin({ kind: 'create', requestId: 'cancelled-restart', label: 'B', confirm: true }, source); registry.update('cancelled-restart', 'restarting');
    const pendingScope = registry.scope();
    await assert.rejects(restartOwned({ child, identity: service.identity, port, readToken: () => token, registry,
      requestId: 'cancelled-restart', instanceId: 'must-not-start', shouldStop: () => true, start: () => assert.fail('No target after Q') }), /cancelled/);
    assert.equal(child.exitCode, 0); assert.deepEqual(registry.scope(), pendingScope); assert.equal(registry.current().state, 'failed');
    assert.throws(() => registry.prepareAfterExit('cancelled-restart'));
  } finally { if (child?.connected) await stopOwned(child); rmSync(runtime, { recursive: true, force: true }); }
});

test('an already abnormal exit is never treated as a clean stop', async () => {
  await assert.rejects(stopOwned({ pid: 123, exitCode: 1, signalCode: null }), /did not exit cleanly/);
  await assert.rejects(stopOwned({ pid: 123, exitCode: null, signalCode: 'SIGTERM' }), /did not exit cleanly/);
});

test('mismatched operation source cannot acknowledge or stop the verified child', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'otherme-synthetic-op-mismatch-')); const registry = new ProfileRegistry(runtime);
  const port = await portNumber(); let child;
  try {
    const service = await ensureService({ port, rootId, instanceId: 'source', readToken: () => token, interval: 20,
      start: () => (child = spawn(port, 'source')) });
    registry.begin({ kind: 'create', requestId: 'wrong-scope', label: 'B', confirm: true }, registry.scope()); registry.update('wrong-scope', 'restarting');
    const identity = { ...service.identity, profileScope: { ...service.identity.profileScope, revision: 50 } };
    await assert.rejects(restartOwned({ child, identity, port, readToken: () => token, registry,
      requestId: 'wrong-scope', instanceId: 'new', start: () => assert.fail('Must not start') }));
    assert.equal(child.exitCode, null); assert.equal(registry.acknowledged('wrong-scope'), false);
  } finally { if (child?.connected) await stopOwned(child); rmSync(runtime, { recursive: true, force: true }); }
});
