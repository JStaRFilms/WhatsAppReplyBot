import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { SqliteStore } from '@replybot/core';
import { createApp } from './server.ts';
import { OpenRouterClient } from './openrouter.ts';
import { DEMO_ACCOUNT } from './seed.ts';

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
const app = createApp({ store, token, allowedOrigins: lan ? addresses.map(i => 'http://'+i.address+':8081') : [],
  ...(live ? { whatsapp: { authDir: join(runtime,'whatsapp-auth') } } : {}),
  ...(remote ? { remoteModel: { generate: (context,visuals) => new OpenRouterClient({
    apiKey, allowRemote: true, ownerConsent: store.modelConsent(accountId),
    appName:process.env.OPENROUTER_APP_NAME || 'JStar Reply Bot',appUrl:process.env.OPENROUTER_APP_URL || 'http://localhost:8081',
  }).generate(context,visuals) } } : {}),
});
await app.listen({ host: lan ? '0.0.0.0' : '127.0.0.1', port: 3210 });
console.info((live ? 'Live' : 'Demo')+' backend ready. WhatsApp pairing starts only from Settings.');
if (lan) for (const { name, address } of addresses) console.info('Phone service address: http://'+address+':3210 ('+name+'). Owner token required.');
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { void app.close(); });
