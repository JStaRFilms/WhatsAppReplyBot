import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { SqliteStore } from '@replybot/core';
import { createApp } from './server.ts';
import { OpenRouterClient } from './openrouter.ts';
import { DEMO_ACCOUNT } from './seed.ts';
import { hasSavedPairing, rootIdentifier } from './launcher-startup.ts';

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
const store = new SqliteStore(join(runtime, live ? 'whatsapp.sqlite' : 'demo.sqlite'));
const accountId = live ? 'whatsapp-owner' : DEMO_ACCOUNT;
const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
  (entries ?? []).filter(i => !i.internal && i.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)).map(i => ({ name, address: i.address })));
const app = createApp({ store, token,
  launcher:{rootId:rootIdentifier(fileURLToPath(new URL('../../../',import.meta.url))),instanceId:process.env.OTHERME_LAUNCH_INSTANCE_ID || randomUUID()},
  allowedOrigins: lan ? addresses.map(i => 'http://'+i.address+':8081') : [],
  ...(live ? { whatsapp: { authDir: join(runtime,'whatsapp-auth') } } : {}),
  ...(remote ? { remoteModel: { generate: (context,visuals) => new OpenRouterClient({
    apiKey, allowRemote: true, ownerConsent: store.modelConsent(accountId),
    appName:process.env.OPENROUTER_APP_NAME || 'Otherme',appUrl:process.env.OPENROUTER_APP_URL || 'http://localhost:8081',
  }).generate(context,visuals), transcribe:(bytes,guard)=>new OpenRouterClient({
    apiKey,allowRemote:true,ownerConsent:store.modelConsent(accountId),audioModel:process.env.OPENROUTER_AUDIO_MODEL || 'google/gemini-3.8-flash',
    appName:process.env.OPENROUTER_APP_NAME || 'Otherme',appUrl:process.env.OPENROUTER_APP_URL || 'http://localhost:8081',
  }).transcribe(bytes,guard) } } : {}),
});
await app.listen({ host: lan ? '0.0.0.0' : '127.0.0.1', port: 3210 });
console.info((live ? 'Live' : 'Demo')+' backend ready. Pair through Settings or the Otherme launcher.');
if (lan) for (const { name, address } of addresses) console.info('Phone service address: http://'+address+':3210 ('+name+'). Owner token required.');
let closing: Promise<void> | undefined;
const close = () => closing ??= app.close().then(() => { if (process.connected) process.disconnect?.(); });
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { void close(); });
if (process.send) {
  process.on('message', message => {
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'otherme-stop') void close();
  });
  process.on('disconnect', () => { void close(); });
}
if (live && process.argv.includes('--restore-pairing')) {
  const authDir = join(runtime, 'whatsapp-auth');
  try {
    if (hasSavedPairing(authDir)) {
      const result = await app.inject({ method: 'POST', url: '/v1/whatsapp/connect', headers: { authorization: 'Bearer '+token },
        payload: { requestId: 'launcher-restore-'+randomBytes(12).toString('hex'), confirm: true } });
      if (result.statusCode !== 200) throw new Error('pairing_restore_failed');
      console.info('Saved WhatsApp pairing requested. Check connection status on the phone.');
    } else console.info('No verified saved pairing. Use Connect WhatsApp in phone Settings.');
  } catch {
    console.info('Saved pairing could not be restored. Use Connect WhatsApp in phone Settings.');
  }
}
