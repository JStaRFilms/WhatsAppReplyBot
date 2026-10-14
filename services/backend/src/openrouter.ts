import { z } from 'zod';
import { Action, DomainError, type ModelContext } from '@replybot/core';
import type { VisualFrame } from './media.ts';

const Reply = z.object({ action: z.union(Action.options) }).strict();
const Envelope = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) });
export class OpenRouterClient {
  constructor(private readonly options: {
    apiKey: string; allowRemote: boolean; ownerConsent: boolean; fetcher?: typeof fetch;
    appName?:string; appUrl?:string;
  }) {}
  async generate(context: ModelContext, visuals:VisualFrame[] = []): Promise<Action> {
    if (!this.options.allowRemote || !this.options.ownerConsent) throw new DomainError('live_model_disabled',403);
    if (!this.options.apiKey) throw new DomainError('model_key_missing',503);
    if (context.worstCaseTextTokens > 8000) throw new DomainError('context_budget_exceeded',422);
    if (visuals.length > 4 || visuals.some(v => {
      const m=context.messages.find(m=>m.id===v.messageId)?.media;
      return !m || m.viewOnce || m.expiresAt!==null && m.expiresAt<=Date.now()
        || !['image','sticker','animated_sticker','gif'].includes(m.kind)
        || v.dataUrl.length>2*1024*1024 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(v.dataUrl);
    })) throw new DomainError('invalid_media_input',422);
    const attached=new Set(visuals.map(v=>v.messageId));
    const transcript=JSON.stringify({ participants:{you:'account holder; outgoing messages',contact:'other person; incoming messages',ai:'assistant drafting as you'},
      messages:context.messages.map(m=>({...m,
        speaker:m.direction==='inbound' ? 'contact' : m.authorship==='owner_written' ? 'you' : m.authorship==='assistant_written' ? 'AI as you' : m.authorship==='owner_edited_assistant' ? 'you, editing AI' : 'unverified outgoing',
        media:m.media ? {kind:m.media.kind,visualStatus:attached.has(m.id) ? 'attached below' : 'unavailable; do not infer content',viewOnce:m.media.viewOnce} : null})),
      memories:context.memories,styleExamples:context.styleExamples,
      limitations:context.limitations.filter(l=>l!=='media_context_unavailable'),
      visualLimitations:'Images are resized. Animated attachments contain at most two sampled frames from their first eight seconds. Missing detail must not be invented.' });
    const content=visuals.length ? [{type:'text',text:transcript},...visuals.flatMap(v=>[
      {type:'text',text:'Visual from message '+v.messageId+(v.sampled ? ' · sampled animation frame' : '')},
      {type:'image_url',image_url:{url:v.dataUrl,detail:'low'}},
    ])] : transcript;
    const response = await (this.options.fetcher ?? fetch)('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',signal:AbortSignal.timeout(30000),
      headers:{ Authorization:'Bearer '+this.options.apiKey,'Content-Type':'application/json',
        'HTTP-Referer':this.options.appUrl || 'http://localhost:8081',
        'X-OpenRouter-Title':this.options.appName || 'Otherme','X-OpenRouter-App-Visibility':'hidden' },
      body:JSON.stringify({ model:'openai/gpt-6-luna',max_tokens:1000,
        messages:[{role:'system',content:context.instructions},{role:'user',content}],
        response_format:{type:'json_schema',json_schema:{name:'reply_action',strict:true,schema:z.toJSONSchema(Reply,{override:({jsonSchema})=>{
          if(jsonSchema.type==='object' && jsonSchema.properties?.quotedMessageId)jsonSchema.required=Object.keys(jsonSchema.properties);
        }})}},
      }),
    });
    if (!response.ok) throw new DomainError('model_request_failed',502);
    try {
      const envelope=Envelope.parse(await response.json());
      const choice=envelope.choices[0]; if (!choice) throw new Error('no_choice');
      return Reply.parse(JSON.parse(choice.message.content)).action;
    } catch { throw new DomainError('invalid_model_response',502); }
  }
}
