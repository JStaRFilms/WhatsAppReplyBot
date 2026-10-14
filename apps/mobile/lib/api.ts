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
  live_media_encoding_unverified: 'Live media encoding is not ready. This chat needs your reply.',
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
  static async provision(baseUrl: string): Promise<string> {
    const response = await fetch(baseUrl.replace(/\/$/,'')+'/v1/local-provision', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_OS === 'web' ? {} : { Origin: 'http://localhost' }) }, body: JSON.stringify({ confirmLocalDemo: true }),
    });
    if (!response.ok) throw new Error('Local connection failed. Start pnpm backend on this computer, or enter its service token.');
    return z.object({ token: z.string().min(16), demo: z.boolean() }).parse(await response.json()).token;
  }
}
