import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

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
