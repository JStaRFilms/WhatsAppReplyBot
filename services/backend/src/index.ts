import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SqliteStore } from '@replybot/core';
import { createApp } from './server.ts';

const runtime = fileURLToPath(new URL('../../../.runtime/', import.meta.url));
mkdirSync(runtime, { recursive: true });
const tokenPath = join(runtime, 'owner-token.txt');
if (!existsSync(tokenPath)) writeFileSync(tokenPath, randomBytes(32).toString('hex'), { mode: 0o600 });
const token = readFileSync(tokenPath, 'utf8').trim();
const app = createApp({ store: new SqliteStore(join(runtime, 'demo.sqlite')), token });
await app.listen({ host: '127.0.0.1', port: 3210 });
console.info('Demo service ready at http://127.0.0.1:3210. WhatsApp and OpenRouter are disconnected.');
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { void app.close(); });
