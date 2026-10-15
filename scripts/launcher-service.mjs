import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const sameScope = (a, b) => !!a && !!b && a.profileId === b.profileId && a.accountId === b.accountId && a.revision === b.revision;

export async function inspectService(port, token, expected) {
  const occupied = await new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(2000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); reject(new Error('Service port did not respond. Nothing was stopped.')); });
    socket.once('error', error => error.code === 'ECONNREFUSED' ? resolve(false) : reject(new Error('Cannot verify the service port. Nothing was stopped.')));
  });
  if (!occupied) return null;
  if (!token) throw new Error('Port is occupied but no saved owner token exists. Nothing was started or stopped.');
  let response;
  try {
    response = await fetch('http://127.0.0.1:'+port+'/v1/launcher', {
      headers: { authorization: 'Bearer '+token }, signal: AbortSignal.timeout(2500), redirect: 'error',
    });
  } catch { throw new Error('Occupied port is not a verified Otherme service. Nothing was started or stopped.'); }
  if (!response.ok) throw new Error('Occupied port did not accept this owner token and launcher protocol. Nothing was started or stopped.');
  let identity;
  try { identity = await response.json(); } catch { throw new Error('Service identity is invalid. Nothing was started or stopped.'); }
  const scope = identity.profileScope;
  const validId = scope?.profileId === 'original' || typeof scope?.profileId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scope.profileId);
  const accountId = scope?.profileId === 'original' ? 'whatsapp-owner' : 'whatsapp-'+scope?.profileId;
  if (identity.service !== 'otherme-backend' || identity.protocol !== 2 || !validId || scope.accountId !== accountId || identity.accountId !== accountId
    || !Number.isSafeInteger(scope.revision) || scope.revision < 0
    || expected?.profileScope && !sameScope(scope, expected.profileScope)
    || identity.demo !== false || typeof identity.whatsapp !== 'string'
    || !expected?.rootId || identity.rootId !== expected.rootId || typeof identity.instanceId !== 'string' || !identity.instanceId
    || expected.instanceId !== undefined && identity.instanceId !== expected.instanceId)
    throw new Error('Occupied port belongs to another service or account. Nothing was started or stopped.');
  return identity;
}

// Dependency injection keeps launcher checks isolated from the real service and account.
export async function ensureService({ port, rootId, instanceId, profileScope, readToken, start, attempts = 60, interval = 500 }) {
  if(!rootId || !instanceId)throw new Error('Launcher identity is missing. Nothing was started.');
  const existing = await inspectService(port, readToken(),{rootId, ...(profileScope ? { instanceId, profileScope } : {})});
  if (existing) return { owned: false, child: null, identity: existing };
  const child = start();
  let spawnFailed = false;
  child.once('error', () => { spawnFailed = true; });
  for (let i = 0; i < attempts; i++) {
    if (spawnFailed || child.exitCode !== null || child.signalCode !== null) throw new Error('Backend exited before becoming ready.');
    await delay(interval);
    try {
      const identity = await inspectService(port, readToken(),{rootId,instanceId,profileScope});
      if (identity) return { owned: true, child, identity };
    } catch (error) {
      // A newly bound server may still be starting, but no unrelated PID is stopped.
      if (i === attempts - 1) throw error;
    }
  }
  throw new Error('Backend did not become ready. Inspect its window output before trying again.');
}

export async function stopOwned(child, timeoutMs = 15000) {
  if (!child?.pid) return;
  if (child.exitCode !== null || child.signalCode !== null) {
    if (child.exitCode === 0 && !child.signalCode) return;
    throw new Error('Backend did not exit cleanly.');
  }
  if (!child.connected) throw new Error('Owned backend IPC is unavailable. Nothing was forcibly stopped.');
  let timer, onExit;
  try {
    await new Promise((resolve, reject) => {
      onExit = (code, signal) => code === 0 && !signal ? resolve() : reject(new Error('Backend did not exit cleanly.'));
      child.once('exit', onExit);
      timer = setTimeout(() => reject(new Error('Backend exit timed out. Nothing was forcibly stopped.')), timeoutMs);
      child.send({ type: 'otherme-stop' }, error => { if (error) reject(new Error('Owned backend IPC failed.')); });
    });
  } finally { clearTimeout(timer); if (onExit) child.off('exit', onExit); }
}

const restarts = new WeakMap();
export function restartOwned(options) {
  const previous = restarts.get(options.child);
  if (previous) return previous.requestId === options.requestId ? previous.work : Promise.reject(new Error('Another restart owns this child.'));
  const work = restart(options);
  restarts.set(options.child, { requestId: options.requestId, work });
  return work;
}
async function restart({ child, identity, port, readToken, registry, requestId, instanceId, start, timeoutMs = 15000, attempts = 60, interval = 500 }) {
  try {
    if (!child?.pid || !child.connected || child.exitCode !== null || child.signalCode !== null) throw new Error('Owned child is unavailable.');
    await inspectService(port, readToken(), { rootId: identity.rootId, instanceId: identity.instanceId, profileScope: identity.profileScope });
    const operation = registry.operation(requestId);
    if (operation.state !== 'restarting' || registry.current()?.requestId !== requestId
      || !sameScope(operation.sourceScope, identity.profileScope)) throw new Error('Restart operation does not match this child.');
    registry.acknowledge(requestId);
    let acknowledgementTimer;
    try {
      await new Promise((resolve, reject) => {
        acknowledgementTimer = setTimeout(() => reject(new Error('Launcher acknowledgement timed out.')), Math.min(timeoutMs, 5000));
        child.send({ type: 'otherme-profile-ack', requestId, rootId: identity.rootId, instanceId: identity.instanceId }, error => error ? reject(error) : resolve());
      });
    } finally { clearTimeout(acknowledgementTimer); }
    await stopOwned(child, timeoutMs);
    // A deadline failure leaves the journal blocked. Never prepare or start a target
    // until the verified child exit AND durable acknowledgement have both happened.
    const profileScope = registry.prepareAfterExit(requestId);
    const result = await ensureService({ port, rootId: identity.rootId, instanceId, profileScope, readToken, start, attempts, interval });
    if (!result.owned) throw new Error('Replacement child is not owned.');
    const response = await fetch('http://127.0.0.1:'+port+'/v1/profile-operations/'+encodeURIComponent(requestId), {
      headers: { authorization: 'Bearer '+readToken() }, signal: AbortSignal.timeout(2500), redirect: 'error',
    });
    if (!response.ok) throw new Error('Replacement completion acknowledgement missing.');
    const completed = await response.json();
    if (completed.state !== 'completed' || !sameScope(completed.resultScope, profileScope)) throw new Error('Replacement did not complete this operation.');
    return result;
  } catch (error) {
    // Preserve the selected files and stopped state. Recovery is an owner decision.
    if (registry.current()?.requestId === requestId && registry.current()?.state !== 'completed') registry.update(requestId, 'failed', 'launcher_restart_failed');
    throw error;
  }
}
