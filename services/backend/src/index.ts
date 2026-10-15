import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { ProfileRegistry, profilePaths, bounded } from './profiles.ts';
import { networkInterfaces } from 'node:os';
import { SqliteStore } from '@replybot/core';
import { createApp } from './server.ts';
import { OpenRouterClient, ASR_PROVENANCE, resolveAudioModel } from './openrouter.ts';
import { DEMO_ACCOUNT } from './seed.ts';
import { hasSavedPairing, rootIdentifier, manageServer } from './launcher-startup.ts';

const runtime = fileURLToPath(new URL('../../../.runtime/', import.meta.url));
mkdirSync(runtime, { recursive: true, mode: 0o700 });
const tokenPath = join(runtime, 'owner-token.txt');
if (!existsSync(tokenPath)) writeFileSync(tokenPath, randomBytes(32).toString('hex'), { mode: 0o600 });
const token = readFileSync(tokenPath, 'utf8').trim();
const live = process.argv.includes('--live');
const lan = process.argv.includes('--lan');
const remote = process.argv.includes('--enable-openrouter');
if (remote && !process.env.OPENROUTER_API_KEY) throw new Error('Set OPENROUTER_API_KEY in the backend .env before enabling OpenRouter.');
const apiKey = process.env.OPENROUTER_API_KEY ?? '';
const registry = live ? new ProfileRegistry(runtime) : undefined;
const profileScope = registry?.scope() ?? { profileId: 'original', accountId: DEMO_ACCOUNT, revision: 0 };
const paths = profilePaths(runtime, profileScope.profileId);
mkdirSync(dirname(paths.database), { recursive: true, mode: 0o700 });
const store = new SqliteStore(live ? paths.database : join(runtime, 'demo.sqlite'));
const accountId = profileScope.accountId;
const rootId = rootIdentifier(fileURLToPath(new URL('../../../',import.meta.url)));
const instanceId = process.env.OTHERME_LAUNCH_INSTANCE_ID || randomUUID();
const activationId = process.env.OTHERME_PROFILE_OPERATION;
const activation = !!(registry && activationId && process.connected && registry.acknowledged(activationId)
  && registry.current()?.state === 'restarting' && registry.current()?.targetProfileId === profileScope.profileId);
if (activationId && !activation) throw new Error('invalid_profile_activation');
const owningLauncher = !!(process.connected && process.env.OTHERME_LAUNCH_INSTANCE_ID);
async function notifyQuiesced(requestId: string): Promise<void> {
  const acknowledge = z.object({ type: z.literal('otherme-profile-ack'), requestId: z.literal(requestId), rootId: z.literal(rootId), instanceId: z.literal(instanceId) });
  let listener: ((message: unknown) => void) | undefined;
  try {
    await bounded(new Promise<void>((resolve, reject) => {
      listener = message => { if (acknowledge.safeParse(message).success && registry?.acknowledged(requestId)) resolve(); };
      process.on('message', listener);
      if (!process.connected || !process.send) return reject(new Error('launcher_ipc_unavailable'));
      process.send({ type: 'otherme-profile-quiesced', requestId, rootId, instanceId, profileScope }, error => { if (error) reject(new Error('launcher_ipc_unavailable')); });
    }), 5000, 'launcher_ack_timeout');
  } finally { if (listener) process.off('message', listener); }
}
const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
  (entries ?? []).filter(i => !i.internal && i.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)).map(i => ({ name, address: i.address })));
const app = createApp({ store, token, accountId, profileScope,
  ...(registry ? { profiles: { registry, activation, ...(owningLauncher ? { onQuiesced: operation => notifyQuiesced(operation.requestId) } : {}) } } : {}),
  launcher:{rootId,instanceId},
  desktopDir: fileURLToPath(new URL('../../../apps/mobile/dist/', import.meta.url)),
  ...(owningLauncher ? { onPcDisplay: (intent: import('./pc-display.ts').PcDisplayIntent) => new Promise<void>((resolve, reject) => {
    if (!process.connected || !process.send) return reject(new Error('launcher_ipc_unavailable'));
    process.send(intent, error => error ? reject(new Error('launcher_ipc_unavailable')) : resolve());
  }) } : {}),
  onShutdownPhase: phase => {
    console.info('Stopping Otherme: '+phase);
    if (process.connected && process.send) process.send({ type: 'otherme-stopping', rootId, instanceId, phase }, () => {});
  },
  allowedOrigins: lan ? addresses.map(i => 'http://'+i.address+':8081') : [],
  ...(live ? { whatsapp: { authDir: paths.auth, requireOwnerLock: registry?.requiresOwnerLock(profileScope.profileId) ?? false } } : {}),
  ...(remote ? { remoteModel: { generate: (context,visuals) => new OpenRouterClient({
    apiKey, allowRemote: true, ownerConsent: store.modelConsent(accountId),
    appName:process.env.OPENROUTER_APP_NAME || 'Otherme',appUrl:process.env.OPENROUTER_APP_URL || 'http://localhost:8081',
  }).generate(context,visuals), asrProvenance:ASR_PROVENANCE, transcribe:(bytes,guard)=>new OpenRouterClient({
    apiKey,allowRemote:true,ownerConsent:store.modelConsent(accountId),audioModel:resolveAudioModel(process.env.OPENROUTER_AUDIO_MODEL),
    appName:process.env.OPENROUTER_APP_NAME || 'Otherme',appUrl:process.env.OPENROUTER_APP_URL || 'http://localhost:8081',
  }).transcribe(bytes,guard) } } : {}),
});
process.on('message', app.acknowledgePcDisplay);
const lifecycle = manageServer({ events: process,
  listen: () => app.listen({ host: lan ? '0.0.0.0' : '127.0.0.1', port: 3210 }),
  gate: app.beginShutdown, close: () => app.close(),
  onClosed: () => { process.off('message', app.acknowledgePcDisplay); if (process.connected) process.disconnect?.(); },
  onError: () => { console.error('Otherme could not stop cleanly. Ownership is retained until exit is verified.'); process.exitCode = 1; },
});
try {
  if (await lifecycle.ready) {
    if (activation && registry && activationId) registry.complete(activationId, profileScope);
    console.info((live ? 'Live' : 'Demo')+' backend ready. Pair through Settings or the Otherme launcher.');
    if (lan) for (const { name, address } of addresses) console.info('Phone service address: http://'+address+':3210 ('+name+'). Owner token required.');
  }
} catch {
  console.error('Otherme startup failed. Closing owned resources.'); process.exitCode = 1;
  await lifecycle.stop().catch(() => { console.error('Startup cleanup is blocked. No resources were forcibly released.'); });
}
if (!lifecycle.stopping && live && !activation && !registry?.blocked() && process.argv.includes('--restore-pairing')) {
  const authDir = paths.auth;
  try {
    if (hasSavedPairing(authDir)) {
      const result = await app.inject({ method: 'POST', url: '/v1/whatsapp/connect', headers: { authorization: 'Bearer '+token, 'x-otherme-profile': profileScope.profileId, 'x-otherme-revision': String(profileScope.revision) },
        payload: { requestId: 'launcher-restore-'+randomBytes(12).toString('hex'), confirm: true } });
      if (result.statusCode !== 200) throw new Error('pairing_restore_failed');
      console.info('Saved WhatsApp pairing requested. Check connection status on the phone.');
    } else console.info('No verified saved pairing. Use Connect WhatsApp in phone Settings.');
  } catch {
    console.info('Saved pairing could not be restored. Use Connect WhatsApp in phone Settings.');
  }
}
