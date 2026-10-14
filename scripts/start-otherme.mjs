import { fork, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { ensureService, inspectService, stopOwned } from './launcher-service.mjs';
import { rootIdentifier } from '../services/backend/src/launcher-startup.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = join(root, '.runtime');
const tokenPath = join(runtime, 'owner-token.txt');
const lockPath = join(runtime, 'launcher.lock');
const qrPath = join(runtime, 'pairing-qr-'+process.pid+'.png');
const readToken = () => existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8').trim() : '';
const rootId=rootIdentifier(root);
const instanceId=randomUUID();
let serviceIdentity;
let child, lock, input, timer;
let stopping = false;
let pairing = false;
async function showPairing() {
  if (pairing || stopping) return;
  pairing = true;
  try {
    const token = readToken();
    if (!serviceIdentity || !await inspectService(3210, token,{rootId,instanceId:serviceIdentity.instanceId})) throw new Error('Service is offline.');
    if(stopping)return;
    const headers = { authorization: 'Bearer '+token, 'content-type': 'application/json' };
    const response = await fetch('http://127.0.0.1:3210/v1/whatsapp/connect', {
      method: 'POST', headers, body: JSON.stringify({ requestId: randomUUID(), confirm: true }), signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Pairing request failed. Check phone Settings.');
    console.info('Waiting for pairing QR. Keep it private. Scan with original WhatsApp > Linked devices.');
    for (let i = 0; i < 30 && !stopping; i++) {
      const state = await fetch('http://127.0.0.1:3210/v1/whatsapp', { headers, signal: AbortSignal.timeout(2500), redirect: 'error' });
      if (!state.ok) throw new Error('Pairing status unavailable.');
      const status = await state.json();
      if(stopping)return;
      if (status.state === 'connected') { console.info('WhatsApp connected.'); return; }
      if (typeof status.qr === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(status.qr) && status.qr.length < 100000) {
        mkdirSync(runtime, { recursive: true });
        writeFileSync(qrPath, Buffer.from(status.qr.slice('data:image/png;base64,'.length), 'base64'), { mode: 0o600 });
        const viewer = spawn('explorer.exe', [qrPath], { stdio: 'ignore', windowsHide: true });
        viewer.on('error', () => console.info('Open the private QR image manually: '+qrPath));
        viewer.unref();
        console.info('Private QR image opened on this PC: '+qrPath);
        console.info('If the QR expires, type P again. Do not share this image.'); return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!stopping) console.info('No QR yet. Check phone Settings or type P to retry.');
  } catch {
    console.info('Pairing could not be displayed. Check phone Settings.');
  } finally { pairing = false; }
}
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer); input?.close();
  if (child) {
    console.info('Stopping this launcher\'s backend gracefully. Waiting for active work...');
    await stopOwned(child);
  }
}
try {
  console.info('Otherme | JStar Studios | https://jstarstudios.com');
  console.info('Keep this PC awake and on the same trusted Wi-Fi as your phone. No Metro or Expo Go needed.');
  const service = await ensureService({ port: 3210, rootId, instanceId, readToken, start: () => {
    mkdirSync(runtime, { recursive: true });
    try { lock = openSync(lockPath, 'wx', 0o600); }
    catch { throw new Error('Another launcher is open or its lock remains after a crash. Close it first. If no launcher or backend is running, remove .runtime/launcher.lock and retry.'); }
    const require = createRequire(join(root, 'services/backend/package.json'));
    const local = existsSync(join(root, '.env')) ? parseEnv(readFileSync(join(root, '.env'), 'utf8')) : {};
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith('OTHERME_SIGNING_')) delete env[key];
    env.OTHERME_LAUNCH_INSTANCE_ID=instanceId;
    for (const [key, value] of Object.entries(local)) if (/^(OPENROUTER_|FFMPEG_PATH$)/.test(key)) env[key] = value;
    child = fork(join(root, 'services/backend/src/index.ts'), ['--live', '--enable-openrouter', '--lan', '--restore-pairing'], {
      cwd: join(root, 'services/backend'), env, execArgv: ['--import', pathToFileURL(require.resolve('tsx')).href],
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true,
    });
    return child;
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
  console.info('For first WhatsApp pairing, type P and press Enter to show the QR on this PC. Scan with original WhatsApp > Linked devices.');
  console.info(service.owned ? 'Type Q and press Enter to stop Otherme safely. Keep this window open while using the app.' : 'Type Q and press Enter to close this status window. Stop the backend from its original window.');
  input = createInterface({ input: process.stdin, output: process.stdout });
  let status = service.identity.whatsapp;
  timer = setInterval(() => {
    void inspectService(3210, readToken(),{rootId,instanceId:serviceIdentity.instanceId}).then(identity => {
      const next = identity?.whatsapp ?? 'service offline';
      if (next !== status) { status = next; console.info('WhatsApp: '+status); }
    }).catch(() => { console.info('Service identity check failed. Nothing was stopped.'); });
  }, 5000);
  await new Promise(resolve => {
    input.on('line', line => {
      if (line.trim().toLowerCase() === 'q') resolve();
      if (line.trim().toLowerCase() === 'p') void showPairing();
    });
    input.once('close', resolve);
    process.once('SIGINT', resolve); process.once('SIGTERM', resolve);
    child?.once('exit', () => { console.info('Backend stopped.'); resolve(); });
  });
  await stop();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Otherme could not start.');
  process.exitCode = 1;
  await stop();
} finally {
  clearInterval(timer); input?.close();
  if (existsSync(qrPath)) unlinkSync(qrPath);
  if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); }
}
