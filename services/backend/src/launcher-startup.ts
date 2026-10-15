import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { EventEmitter } from 'node:events';

// Install ownership handlers before listen can yield. A stop gates work now,
// then waits for startup and a verified graceful close without a forced timeout.
export function manageServer(options: {
  events: EventEmitter; listen: () => Promise<unknown>; gate: () => void;
  close: () => Promise<unknown>; onClosed: () => void; onError: () => void;
}) {
  let stopping = false;
  let closing: Promise<void> | undefined;
  const stop = () => {
    if (closing) return closing;
    stopping = true;
    options.gate();
    closing = listening.catch(() => {}).then(async () => {
      await options.close();
      for (const event of ['SIGINT', 'SIGTERM', 'disconnect']) options.events.off(event, requestStop);
      options.events.off('message', message);
      options.onClosed();
    });
    return closing;
  };
  const requestStop = () => { void stop().catch(options.onError); };
  const message = (value: unknown) => {
    if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'otherme-stop') requestStop();
  };
  for (const event of ['SIGINT', 'SIGTERM', 'disconnect']) options.events.on(event, requestStop);
  options.events.on('message', message);
  const listening = Promise.resolve().then(() => stopping ? undefined : options.listen());
  return { ready: listening.then(() => !stopping), stop, get stopping() { return stopping; } };
}

export function rootIdentifier(root:string):string {
  const canonical=realpathSync(root);
  return createHash('sha256').update(process.platform==='win32' ? canonical.toLowerCase() : canonical).digest('hex');
}

export function hasSavedPairing(authDir: string): boolean {
  if (!existsSync(join(authDir, 'owner-identity.json'))) return false;
  try {
    const identity: unknown = JSON.parse(readFileSync(join(authDir, 'owner-identity.json'), 'utf8'));
    if (typeof identity !== 'object' || identity === null || !('owner' in identity) || typeof identity.owner !== 'string' || !identity.owner) return false;
    const saved: unknown = JSON.parse(readFileSync(join(authDir, 'creds.json'), 'utf8'));
    return typeof saved === 'object' && saved !== null && 'registered' in saved && saved.registered === true;
  } catch { return false; }
}
