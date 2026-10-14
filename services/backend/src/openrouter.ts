import { z } from 'zod';
import { Action, DomainError, type ModelContext } from '@replybot/core';

const Reply = z.object({ action: z.union(Action.options) }).strict();
const Envelope = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) });
export class OpenRouterClient {
  constructor(private readonly options: {
    apiKey: string; allowRemote: boolean; ownerConsent: boolean; fetcher?: typeof fetch;
  }) {}
  async generate(context: ModelContext): Promise<Action> {
    if (!this.options.allowRemote || !this.options.ownerConsent) throw new DomainError('live_model_disabled', 403);
    if (!this.options.apiKey) throw new DomainError('model_key_missing', 503);
    if (context.messages.some(m => m.media)) throw new DomainError('live_media_encoding_unverified', 422);
    if (context.worstCaseTextTokens > 8000) throw new DomainError('context_budget_exceeded', 422);
    const response = await (this.options.fetcher ?? fetch)('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: 'Bearer '+this.options.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-6-luna', max_tokens: 1000,
        messages: [{ role: 'system', content: context.instructions },
          { role: 'user', content: JSON.stringify({ messages: context.messages, memories: context.memories,
            styleExamples: context.styleExamples, limitations: context.limitations }) }],
        response_format: { type: 'json_schema', json_schema: { name: 'reply_action', strict: true, schema: z.toJSONSchema(Reply) } },
      }),
    });
    if (!response.ok) throw new DomainError('model_request_failed', 502);
    try {
      const envelope = Envelope.parse(await response.json());
      const choice = envelope.choices[0]; if (!choice) throw new Error('no_choice');
      return Reply.parse(JSON.parse(choice.message.content)).action;
    } catch { throw new DomainError('invalid_model_response', 502); }
  }
}
