import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenRouterClient } from '../src/openrouter.ts';
import type { ModelContext } from '@replybot/core';

test('remote model cannot run without explicit permission; malformed permissions are rejected', async () => {
  const context: ModelContext = { instructions: 'Propose only', messages: [], memories: [], styleExamples: [], limitations: [], worstCaseTextTokens: 100 };
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ kind: 'text', text: 'hello', reason: 'test', grantPermission: true }) } }] })); };
  const disabled = new OpenRouterClient({ apiKey: 'synthetic-test-key', allowRemote: false, ownerConsent: true, fetcher });
  await assert.rejects(disabled.generate(context), /live_model_disabled/); assert.equal(calls, 0);
  const enabled = new OpenRouterClient({ apiKey: 'synthetic-test-key', allowRemote: true, ownerConsent: true, fetcher });
  await assert.rejects(enabled.generate(context), /invalid_model_response/); assert.equal(calls, 1);
});
