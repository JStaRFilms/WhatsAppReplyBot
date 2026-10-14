import { z } from 'zod';
import { randomUUID } from 'expo-crypto';
import { Conversation, Draft, Outbox, Message } from '@replybot/core/contracts';
export const PauseResult = z.object({ acknowledged: z.literal(true), conversation: Conversation });
export const DecisionResult = z.object({ draft: Draft.nullable().optional(), outbox: Outbox.nullable().optional(), simulated: z.boolean().optional() });
export const SendResult = z.object({ simulated: z.boolean(), outbox: Outbox });
export const Messages = z.array(Message);
export const History=z.object({messages:Messages,watermark:z.number().int().nonnegative()});
export type History=z.infer<typeof History>;
const Failure = z.object({ error: z.string() });
const labels: Record<string, string> = {
  composer_has_text: 'Send or clear your draft first.',
  whatsapp_not_connected: 'Connect WhatsApp in Settings before sending.',
  start_live_backend: 'Start pnpm backend:live on your computer first.',
  unverified_chat_identity: 'This contact identity is not verified yet. No send was attempted.',
  owner_auth_required: 'Reconnect this client to the Windows service.',
  ai_access_denied: 'AI is off or paused for this contact.',
  stale_draft: 'This draft is outdated. Request a fresh one.',
  stale_workflow: 'The conversation changed. Request a fresh draft.',
  grant_limit: 'The reply limit is reached.',
  delivery_unknown: 'A send outcome is unknown. It will not be retried automatically.',
  confirmation_expired: 'This confirmation expired. Open a new proposal.',
  model_consent_required: 'Allow OpenRouter text drafts in Settings first.',
  model_consent_revoked: 'OpenRouter consent was disabled. This draft was discarded.',
  media_unavailable: 'This attachment is unavailable.',
  media_encoder_unavailable: 'Install FFmpeg on the Windows service to display media.',
  model_request_failed: 'The model request failed. No draft was approved or sent.',
  invalid_model_response: 'The model returned an invalid action. Nothing was sent.',
  local_browser_provision_only: 'Enter the service token from your computer to connect this phone.',
};
export class ApiClient {
  constructor(readonly baseUrl: string, private readonly token: string) {}
  async request<T>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>): Promise<T> {
    if (!this.token) throw new Error('Connect to the Windows service first.');
    let response: Response;
    try {
      response = await fetch(this.baseUrl.replace(/\/$/,'')+path, {
        method: payload === undefined ? 'GET' : 'POST',
        headers: { Authorization: 'Bearer '+this.token, 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify({ requestId: randomUUID(), ...payload }) }),
      });
    } catch { throw new Error('The Windows service is unreachable. No action was acknowledged.'); }
    const json: unknown = await response.json();
    if (!response.ok) {
      const parsed = Failure.safeParse(json);
      const code = parsed.success ? parsed.data.error : 'service_error';
      throw new Error(labels[code] ?? code.replaceAll('_',' '));
    }
    return schema.parse(json);
  }
  async media(conversationId:string,messageId:string,signal:AbortSignal):Promise<string> {
    const response=await fetch(this.baseUrl.replace(/\/$/,'')+'/v1/conversations/'+encodeURIComponent(conversationId)+'/media/'+encodeURIComponent(messageId),
      {headers:{Authorization:'Bearer '+this.token},signal});
    if(!response.ok)throw new Error('Media unavailable');
    const mime=response.headers.get('Content-Type')?.split(';')[0];
    if(mime!=='image/png' && mime!=='image/gif')throw new Error('Unsupported media');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length>4*1024*1024)throw new Error('Media too large');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return 'data:'+mime+';base64,'+btoa(binary);
  }
  static async provision(baseUrl: string): Promise<string> {
    const response = await fetch(baseUrl.replace(/\/$/,'')+'/v1/local-provision', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_OS === 'web' ? {} : { Origin: 'http://localhost' }) }, body: JSON.stringify({ confirmLocalDemo: true }),
    });
    if (!response.ok) throw new Error('Local connection failed. Start pnpm backend on this computer, or enter its service token.');
    return z.object({ token: z.string().min(16), demo: z.boolean() }).parse(await response.json()).token;
  }
}
