import { fork, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { ensureService, inspectService, stopOwned, restartOwned, openDesktop } from './launcher-service.mjs';
import { createPcQrViewer } from './pc-qr.mjs';
import { tsImport } from 'tsx/esm/api';
const { ProfileRegistry } = await tsImport('../services/backend/src/profiles.ts', import.meta.url);
import { rootIdentifier } from '../services/backend/src/launcher-startup.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = join(root, '.runtime');
const tokenPath = join(runtime, 'owner-token.txt');
const lockPath = join(runtime, 'launcher.lock');
const qrPath = nonce => join(runtime, 'pairing-qr-'+process.pid+'-'+nonce+'.png');
const readToken = () => existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8').trim() : '';
const rootId=rootIdentifier(root);
let instanceId=randomUUID();
const registry = new ProfileRegistry(runtime);
let serviceIdentity;
let child, lock, input, timer;
let stopping = false;
let stopRequested = false;
let pairing = false;
let restarting;
let requestStop = () => { stopRequested = true; };
let backendExited = () => { console.info('Backend stopped.'); requestStop(); };
function openLocal(target) {
  return new Promise((resolve, reject) => {
    const viewer = spawn('explorer.exe', [target], { stdio: 'ignore', windowsHide: true });
    viewer.once('error', () => reject(new Error('Windows could not open the local viewer.')));
    viewer.once('spawn', () => { viewer.unref(); resolve(); });
  });
}
const qrViewer = createPcQrViewer({
  getIdentity: () => serviceIdentity ?? { rootId, instanceId, profileScope: registry.scope() },
  isStopping: () => stopping || stopRequested || !!restarting,
  readStatus: async identity => {
    const token = readToken();
    if (!await inspectService(3210, token, identity)) throw new Error('Service is offline.');
    const response = await fetch('http://127.0.0.1:3210/v1/whatsapp', {
      headers: { authorization: 'Bearer '+token, 'X-Otherme-Profile': identity.profileScope.profileId, 'X-Otherme-Revision': String(identity.profileScope.revision) },
      signal: AbortSignal.timeout(2500), redirect: 'error',
    });
    if (!response.ok) throw new Error('Pairing status unavailable.');
    return response.json();
  },
  write: (nonce, bytes) => { mkdirSync(runtime, { recursive: true, mode: 0o700 }); writeFileSync(qrPath(nonce), bytes, { mode: 0o600 }); },
  open: nonce => openLocal(qrPath(nonce)),
  remove: nonce => { if (existsSync(qrPath(nonce))) unlinkSync(qrPath(nonce)); },
  acknowledge: message => { if (child?.connected) child.send(message, () => {}); },
  report: message => console.info(message),
});
function spawnBackend(operationId) {
  const require = createRequire(join(root, 'services/backend/package.json'));
  const local = existsSync(join(root, '.env')) ? parseEnv(readFileSync(join(root, '.env'), 'utf8')) : {};
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('OTHERME_SIGNING_') || key === 'OTHERME_PROFILE_OPERATION') delete env[key];
  env.OTHERME_LAUNCH_INSTANCE_ID = instanceId;
  if (operationId) env.OTHERME_PROFILE_OPERATION = operationId;
  for (const [key, value] of Object.entries(local)) if (/^(OPENROUTER_|FFMPEG_PATH$)/.test(key)) env[key] = value;
  const spawned = fork(join(root, 'services/backend/src/index.ts'), ['--live', '--enable-openrouter', '--lan', ...(!operationId ? ['--restore-pairing'] : [])], {
    cwd: join(root, 'services/backend'), env, execArgv: ['--import', pathToFileURL(require.resolve('tsx')).href],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true,
  });
  child = spawned;
  spawned.on('message', message => {
    if (spawned === child && message?.type === 'otherme-pc-display') { void qrViewer.request(message); return; }
    if (stopping || stopRequested || restarting || spawned !== child || !serviceIdentity || !message || message.type !== 'otherme-profile-quiesced'
      || message.rootId !== rootId || message.instanceId !== serviceIdentity.instanceId || typeof message.requestId !== 'string') return;
    const sourceIdentity = serviceIdentity;
    qrViewer.cancel();
    instanceId = randomUUID();
    restarting = restartOwned({ child: spawned, identity: sourceIdentity, port: 3210, readToken, registry,
      requestId: message.requestId, instanceId, shouldStop: () => stopRequested || stopping, start: () => spawnBackend(message.requestId) }).then(result => {
      serviceIdentity = result.identity;
      console.info('Profile changed. WhatsApp is disconnected and AI is off. Connect in Settings when ready.');
    }).catch(() => { console.error('Profile restart blocked. No account was automatically reconnected. Check Settings operation status.'); })
      .finally(() => { restarting = undefined; if (child?.exitCode !== null) backendExited(); });
  });
  spawned.once('exit', () => { if (!restarting && spawned === child) backendExited(); });
  return spawned;
}
async function showPairing() {
  if (pairing || stopping || stopRequested || restarting) return;
  pairing = true;
  try {
    const token = readToken();
    const pairingIdentity = serviceIdentity;
    const current = () => !stopping && !stopRequested && !restarting && serviceIdentity === pairingIdentity;
    if (!pairingIdentity || !await inspectService(3210, token,{rootId,instanceId:pairingIdentity.instanceId,profileScope:pairingIdentity.profileScope})) throw new Error('Service is offline.');
    if(!current())return;
    const headers = { authorization: 'Bearer '+token, 'content-type': 'application/json',
      'X-Otherme-Profile': pairingIdentity.profileScope.profileId, 'X-Otherme-Revision': String(pairingIdentity.profileScope.revision) };
    const response = await fetch('http://127.0.0.1:3210/v1/whatsapp/connect', {
      method: 'POST', headers, body: JSON.stringify({ requestId: randomUUID(), confirm: true }), signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (!current()) return;
    if (!response.ok) throw new Error('Pairing request failed. Check phone Settings.');
    console.info('Waiting for a private pairing QR. In WhatsApp, choose the intended account, then Linked devices.');
    await qrViewer.request({ ...pairingIdentity, type: 'otherme-pc-display', requestId: randomUUID(), nonce: randomUUID() }, { manual: true });
  } catch {
    console.info('Pairing could not be displayed. Check phone Settings.');
  } finally { pairing = false; }
}
async function stop() {
  if (stopping) return;
  stopping = true;
  qrViewer.cancel();
  clearInterval(timer); input?.close();
  await restarting;
  if (child) {
    console.info('Stopping this launcher\'s backend gracefully. Waiting for active work...');
    await stopOwned(child, 15000, serviceIdentity ?? { rootId, instanceId });
  }
}
try {
  console.info('Otherme | JStar Studios | https://jstarstudios.com');
  console.info('Keep this PC awake and on the same trusted Wi-Fi as your phone. No Metro or Expo Go needed.');
  input = createInterface({ input: process.stdin, output: process.stdout });
  const stopped = new Promise(resolve => {
    requestStop = () => { stopRequested = true; qrViewer.cancel(); resolve(); };
    input.on('line', line => {
      const key = line.trim().toLowerCase();
      if (key === 'q') requestStop();
      if (key === 'p' && serviceIdentity) void showPairing();
      if (key === 'd' && serviceIdentity && !stopRequested && !restarting) {
        void openDesktop({ port: 3210, token: readToken(), identity: serviceIdentity, open: openLocal })
          .catch(error => console.info(error instanceof Error ? error.message : 'Desktop could not open.'));
      }
    });
    input.once('close', () => requestStop());
    process.once('SIGINT', () => requestStop()); process.once('SIGTERM', () => requestStop());
  });
  console.info('Starting Otherme. Q stops startup safely; active work may need time to drain.');
  const service = await ensureService({ port: 3210, rootId, instanceId, readToken, shouldStop: () => stopRequested, start: () => {
    mkdirSync(runtime, { recursive: true });
    try { lock = openSync(lockPath, 'wx', 0o600); }
    catch { throw new Error('Another launcher is open or its lock remains after a crash. Ownership could not be verified. Nothing was started or removed.'); }
    return spawnBackend();
  } });
  serviceIdentity=service.identity;
  console.info(service.owned ? 'Backend ready. Saved pairing is restored when available.' : 'Verified existing backend. This window will not stop that service.');
  console.info('WhatsApp: '+service.identity.whatsapp);
  for (const entries of Object.values(networkInterfaces())) for (const item of entries ?? []) {
    if (!item.internal && item.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))
      console.info('Phone Settings service address: http://'+item.address+':3210');
  }
  console.info('Use your Wi-Fi adapter address. DHCP may change it. Phone token stays in .runtime/owner-token.txt.');
  console.info('Phone setup: open .runtime/owner-token.txt on this PC and enter its private token in phone Settings, then Connect.');
  console.info('Link WhatsApp in Settings to request the PC QR. P is the manual fallback. D opens the local desktop app.');
  console.info(service.owned ? 'Type Q and press Enter to stop Otherme safely. Keep this window open while using the app.' : 'Type Q and press Enter to close this status window. Stop the backend from its original window.');
  let status = service.identity.whatsapp;
  timer = setInterval(() => {
    void inspectService(3210, readToken(),{rootId,instanceId:serviceIdentity.instanceId}).then(identity => {
      const next = identity?.whatsapp ?? 'service offline';
      if (next !== status) { status = next; console.info('WhatsApp: '+status); }
    }).catch(() => { console.info('Service identity check failed. Nothing was stopped.'); });
  }, 5000);
  await stopped;
  await stop();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Otherme could not start.');
  if (!stopRequested || stopping) process.exitCode = 1;
  await stop().catch(() => { console.error('Safe stop is still blocked. No process was forcibly stopped.'); process.exitCode = 1; });
} finally {
  clearInterval(timer); input?.close();
  qrViewer.cancel();
  if (lock !== undefined) {
    closeSync(lock);
    if (!child || child.exitCode !== null || child.signalCode !== null) unlinkSync(lockPath);
    else console.error('Backend exit was not verified. Launcher lock retained.');
  }
}
