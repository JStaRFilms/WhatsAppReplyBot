import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SqliteStore } from '@replybot/core';
import { createApp } from './server.ts';
import { OpenRouterClient } from './openrouter.ts';
import { DEMO_ACCOUNT } from './seed.ts';

const runtime = fileURLToPath(new URL('../../../.runtime/', import.meta.url));
mkdirSync(runtime, { recursive: true });
const tokenPath = join(runtime, 'owner-token.txt');
if (!existsSync(tokenPath)) writeFileSync(tokenPath, randomBytes(32).toString('hex'), { mode: 0o600 });
const token = readFileSync(tokenPath, 'utf8').trim();
const store = new SqliteStore(join(runtime, 'demo.sqlite'));
const remote = process.argv.includes('--enable-openrouter');
if (remote && !process.env.OPENROUTER_API_KEY) throw new Error('Set OPENROUTER_API_KEY in the backend .env before enabling OpenRouter.');
const apiKey = process.env.OPENROUTER_API_KEY ?? '';
const app = createApp({ store, token, ...(remote ? { remoteModel: {
  generate: context => new OpenRouterClient({ apiKey, allowRemote: true, ownerConsent: store.modelConsent(DEMO_ACCOUNT) }).generate(context),
} } : {}) });
await app.listen({ host: '127.0.0.1', port: 3210 });
console.info('Demo service ready at http://127.0.0.1:3210. WhatsApp is disconnected. Model: '+(remote ? 'OpenRouter, subject to owner consent' : 'local demo')+'.');
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { void app.close(); });
