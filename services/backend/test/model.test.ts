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

test('provider schema uses an object envelope with anyOf and validates the returned action', async () => {
  const context: ModelContext = { instructions: 'Propose only', messages: [], memories: [], styleExamples: [], limitations: [], worstCaseTextTokens: 100 };
  const action = { kind: 'text', text: 'yeah, tomorrow works', reason: 'Synthetic test.' };
  const fetcher: typeof fetch = async (_url, init) => {
    assert.equal(typeof init?.body, 'string');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.response_format.json_schema.schema.type, 'object');
    assert.ok(body.response_format.json_schema.schema.properties.action.anyOf);
    const textSchema=body.response_format.json_schema.schema.properties.action.anyOf.find((s:{properties?:{kind?:{const?:string}}})=>s.properties?.kind?.const==='text');
    assert.ok(textSchema.required.includes('quotedMessageId'));
    assert.ok(JSON.stringify(textSchema.properties.quotedMessageId).includes('null'));
    assert.equal(JSON.stringify(body.response_format.json_schema.schema).includes('"oneOf"'), false);
    const variants=body.response_format.json_schema.schema.properties.action.anyOf;
    const sequenceSchema=variants.find((s:{properties?:{kind?:{const?:string}}})=>s.properties?.kind?.const==='text_sequence');
    assert.equal(sequenceSchema.properties.messages.minItems,2);assert.equal(sequenceSchema.properties.messages.maxItems,5);
    assert.ok(sequenceSchema.properties.messages.items.required.includes('quotedMessageId'));
    const reactionSchema=variants.find((s:{properties?:{kind?:{const?:string}}})=>s.properties?.kind?.const==='reaction').properties.reaction.properties.emoji;
    assert.equal(reactionSchema.type,'string');assert.equal(reactionSchema.maxLength,64);assert.equal(reactionSchema.pattern,undefined);
    assert.ok(JSON.stringify(body.response_format.json_schema.schema).length<15000);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action }) } }] }));
  };
  assert.deepEqual(await new OpenRouterClient({ apiKey: 'synthetic-test-key', allowRemote: true, ownerConsent: true, fetcher }).generate(context), action);
});
