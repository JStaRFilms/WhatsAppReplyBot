import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

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
  if (identity.service !== 'otherme-backend' || identity.protocol !== 1 || identity.accountId !== 'whatsapp-owner' || identity.demo !== false || typeof identity.whatsapp !== 'string'
    || !expected?.rootId || identity.rootId !== expected.rootId || typeof identity.instanceId !== 'string' || !identity.instanceId
    || expected.instanceId !== undefined && identity.instanceId !== expected.instanceId)
    throw new Error('Occupied port belongs to another service or account. Nothing was started or stopped.');
  return identity;
}

// Dependency injection keeps launcher checks isolated from the real service and account.
export async function ensureService({ port, rootId, instanceId, readToken, start, attempts = 60, interval = 500 }) {
  if(!rootId || !instanceId)throw new Error('Launcher identity is missing. Nothing was started.');
  const existing = await inspectService(port, readToken(),{rootId});
  if (existing) return { owned: false, child: null, identity: existing };
  const child = start();
  let spawnFailed = false;
  child.once('error', () => { spawnFailed = true; });
  for (let i = 0; i < attempts; i++) {
    if (spawnFailed || child.exitCode !== null || child.signalCode !== null) throw new Error('Backend exited before becoming ready.');
    await delay(interval);
    try {
      const identity = await inspectService(port, readToken(),{rootId,instanceId});
      if (identity) return { owned: true, child, identity };
    } catch (error) {
      // A newly bound server may still be starting, but no unrelated PID is stopped.
      if (i === attempts - 1) throw error;
    }
  }
  throw new Error('Backend did not become ready. Inspect its window output before trying again.');
}

export async function stopOwned(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  if (child.connected) child.send({ type: 'otherme-stop' });
  else throw new Error('Owned backend IPC is unavailable. Nothing was forcibly stopped.');
  // Never taskkill or terminate an unverified PID. Unknown sends keep normal recovery rules.
  await exited;
}
