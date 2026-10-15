import { z } from 'zod';
import { randomUUID } from './uuid';
import { Conversation, Draft, Outbox, Message, ImageUpload, AudioUpload } from '@replybot/core/contracts';
import { ProfileScope, ProfileOperation, SessionDiscovery, MediaSource, type MediaVariant } from '@replybot/core/api';
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
  image_too_large:'Choose an image under 10 MB.',
  invalid_image:'This image could not be read. Choose another.',
  unsupported_image:'This image format is not supported.',
  image_upload_busy:'Another image is processing. Try again shortly.',
  model_request_failed: 'The model request failed. No draft was approved or sent.',
  invalid_model_response: 'The model returned an invalid action. Nothing was sent.',
  local_browser_provision_only: 'Enter the service token from your computer to connect this phone.',
  client_upgrade_required: 'Update Otherme and the Windows service, then reconnect. Profile protocol 2 is required.',
  profile_scope_changed: 'The active account changed. Review it before continuing.',
  profile_transition_in_progress: 'An account change is still in progress. No action was retried.',
  launcher_restart_required: 'Start Otherme with its Windows launcher before changing accounts.',
  profile_busy: 'A send is still in progress. Wait for its outcome before changing accounts.',
};
export class ApiError extends Error {
  constructor(readonly code: string) { super(labels[code] ?? code.replaceAll('_',' ')); }
}
export function sameScope(a: ProfileScope | null | undefined, b: ProfileScope | null | undefined): boolean {
  return !!a && !!b && a.profileId === b.profileId && a.accountId === b.accountId && a.revision === b.revision;
}
export class ReadError extends Error {}
export class UnconfirmedMutationError extends Error {
  constructor(connectionChanged = false) { super((connectionChanged ? 'Connection changed. ' : '') + 'The Windows service did not acknowledge this request. Its outcome is unconfirmed. No action was retried.'); }
}
export class ApiClient {
  readonly scope: ProfileScope | undefined;
  private revoked = false;
  private readonly requests = new Map<AbortController, boolean>();
  constructor(readonly baseUrl: string, private readonly token: string, scope?: ProfileScope,
    private readonly invalidScope?: (error: ApiError) => void) {
    this.scope = scope ? Object.freeze(ProfileScope.parse(scope)) : undefined;
  }
  revoke(): void {
    this.revoked = true;
    this.abortReads();
  }
  abortReads(): void {
    for (const [request, read] of this.requests) if (read) request.abort();
  }
  assertActive(): void {
    if (this.revoked) throw new Error('Connection changed. Try again.');
  }
  private headers(contentType?: string): Record<string,string> {
    this.assertActive();
    if (!this.token) throw new Error('Connect to the Windows service first.');
    return { Authorization: 'Bearer '+this.token, ...(contentType ? {'Content-Type':contentType} : {}),
      ...(this.scope ? {'X-Otherme-Profile':this.scope.profileId,'X-Otherme-Revision':String(this.scope.revision)} : {}) };
  }
  private requireScope(): void {
    this.assertActive();
    if (!this.scope) throw new Error('Review the active account before continuing.');
  }
  private async fetchResponse(path: string, init: RequestInit, read: 'json' | 'bytes', byteLimit?: number, expectedVersion?: string): Promise<unknown> {
    this.assertActive();
    const abort = new AbortController();
    const cancel = () => abort.abort();
    init.signal?.addEventListener('abort',cancel,{once:true});
    if(init.signal?.aborted) abort.abort();
    const readOnly = init.method === undefined || init.method === 'GET';
    this.requests.set(abort,readOnly);
    const timeout = setTimeout(()=>abort.abort(),expectedVersion ? 45000 : 10000);
    const interrupted = () => readOnly
      ? new ReadError('Could not refresh from the Windows service. Showing cached data, if available.')
      : new UnconfirmedMutationError();
    const check = () => {
      this.assertActive();
      if (abort.signal.aborted) throw interrupted();
    };
    let rejectAbort: (()=>void) | undefined;
    const aborted = new Promise<never>((_resolve,reject)=>{
      rejectAbort=()=>reject(interrupted());
      abort.signal.addEventListener('abort',rejectAbort,{once:true});
      if(abort.signal.aborted)rejectAbort();
    });
    const wait = <T,>(work: Promise<T>): Promise<T> => Promise.race([work,aborted]);
    try {
      const response = await wait(fetch(this.baseUrl.replace(/\/$/,'')+path,{...init,signal:abort.signal}));
      check();
      if (!response.ok) {
        const upgradeRequired = response.status === 426 || (path.split('?')[0] === '/v1/session' && response.status === 404);
        let code = upgradeRequired ? 'client_upgrade_required' : 'service_error';
        const parsed = Failure.safeParse(await wait(response.json().catch(()=>null)));
        check();
        if (parsed.success && !upgradeRequired) code = parsed.data.error;
        const error = new ApiError(code);
        if (code === 'profile_scope_changed' || code === 'profile_transition_in_progress' || code === 'client_upgrade_required') {
          this.invalidScope?.(error);this.revoke();
        }
        throw error;
      }
      // Headers are a second guard for raw media as well as JSON responses.
      const profile = response.headers.get('X-Otherme-Profile');
      const revision = response.headers.get('X-Otherme-Revision');
      if (this.scope && ((profile !== null && profile !== this.scope.profileId) || (revision !== null && revision !== String(this.scope.revision)))) {
        const error = new ApiError('profile_scope_changed');
        this.invalidScope?.(error); this.revoke(); throw error;
      }
      if (expectedVersion && (response.headers.get('X-Otherme-Media-Version') !== expectedVersion
        || profile !== this.scope?.profileId || revision !== String(this.scope?.revision))) throw new Error('Media source changed.');
      const length = Number(response.headers.get('Content-Length'));
      if (byteLimit && length > byteLimit) throw new Error('Media exceeds its size limit.');
      const result: unknown = read === 'json' ? await wait(response.json()) : {
        mime:response.headers.get('Content-Type')?.split(';')[0], bytes:await (async()=>{
          if (!byteLimit || !response.body?.getReader) return new Uint8Array(await wait(response.arrayBuffer()));
          const reader=response.body.getReader(), bytes=new Uint8Array(byteLimit);let size=0;
          try { for (;;) { const part=await wait(reader.read());if(part.done)break;
            if(size+part.value.byteLength>byteLimit)throw new Error('Media exceeds its size limit.');bytes.set(part.value,size);size+=part.value.byteLength; }
          } finally { await reader.cancel().catch(()=>{}); }
          return bytes.subarray(0,size);
        })(),
      };
      check();
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (!readOnly) throw new UnconfirmedMutationError(this.revoked);
      check();
      throw new ReadError('Could not reach the Windows service to refresh. Showing cached data, if available.');
    } finally {
      clearTimeout(timeout);
      if(rejectAbort)abort.signal.removeEventListener('abort',rejectAbort);
      init.signal?.removeEventListener('abort',cancel);
      this.requests.delete(abort);
    }
  }
  async request<T>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    this.requireScope();
    const result = await this.fetchResponse(path,{
      method:payload === undefined ? 'GET' : 'POST',headers:this.headers('application/json'),
      ...(payload === undefined ? {signal} : {}),
      ...(payload === undefined ? {} : {body:JSON.stringify({requestId:randomUUID(),...payload})}),
    },'json');
    try {
      this.assertActive();
      return schema.parse(result);
    } catch (error) {
      if (payload !== undefined) throw new UnconfirmedMutationError(this.revoked);
      throw error;
    }
  }
  async session(signal?: AbortSignal): Promise<SessionDiscovery> {
    const result = await this.fetchResponse('/v1/session?capabilities=1&historyMedia=1',{headers:this.headers(),signal},'json');
    this.assertActive();
    const parsed = SessionDiscovery.safeParse(result);
    if (!parsed.success) throw new ApiError('client_upgrade_required');
    return parsed.data;
  }
  async operation(requestId: string, signal?: AbortSignal): Promise<ProfileOperation> {
    const result=await this.fetchResponse('/v1/profile-operations/'+encodeURIComponent(requestId),{headers:this.headers(),signal},'json');
    this.assertActive();return ProfileOperation.parse(result);
  }
  async uploadImage(conversationId:string,base64:string,requestId:string):Promise<z.infer<typeof ImageUpload>> {
    this.requireScope();
    if(base64.length>14*1024*1024)throw new Error(labels.image_too_large);
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    if(bytes.length>10*1024*1024)throw new Error(labels.image_too_large);
    const result=await this.fetchResponse('/v1/conversations/'+encodeURIComponent(conversationId)+'/uploads',{
      method:'POST',headers:{...this.headers('application/octet-stream'),'X-Request-Id':requestId},body:bytes,
    },'json');
    this.assertActive();return ImageUpload.parse(result);
  }
  async uploadAudio(conversationId:string,bytes:Uint8Array<ArrayBuffer>,requestId:string):Promise<z.infer<typeof AudioUpload>> {
    this.requireScope();
    if(!bytes.length || bytes.length>10*1024*1024)throw new Error('Choose non-empty audio under 10 MB.');
    const result=await this.fetchResponse('/v1/conversations/'+encodeURIComponent(conversationId)+'/audio-uploads',{
      method:'POST',headers:{...this.headers('application/octet-stream'),'X-Request-Id':requestId},body:bytes,
    },'json');
    this.assertActive();return AudioUpload.parse(result);
  }
  private async binary(conversationId:string,messageId:string,signal:AbortSignal) {
    this.requireScope();
    const result=await this.fetchResponse('/v1/conversations/'+encodeURIComponent(conversationId)+'/media/'+encodeURIComponent(messageId),{headers:this.headers(),signal},'bytes');
    this.assertActive();return z.object({mime:z.string(),bytes:z.instanceof(Uint8Array)}).parse(result);
  }
  async audio(conversationId:string,messageId:string,signal:AbortSignal):Promise<Uint8Array<ArrayBuffer>> {
    const {mime,bytes}=await this.binary(conversationId,messageId,signal);
    this.assertActive();
    if(mime!=='audio/mpeg')throw new Error('Audio unavailable.');
    if(bytes.length>10*1024*1024)throw new Error('Audio exceeds 10 MB.');return new Uint8Array(bytes);
  }
  async media(conversationId:string,messageId:string,signal:AbortSignal):Promise<string> {
    const {mime,bytes}=await this.binary(conversationId,messageId,signal);
    this.assertActive();
    if(mime!=='image/png' && mime!=='image/gif')throw new Error('Unsupported media');
    if(bytes.length>4*1024*1024)throw new Error('Media too large');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return 'data:'+mime+';base64,'+btoa(binary);
  }
  async mediaSource(conversationId:string,messageId:string,variant:MediaVariant,signal?:AbortSignal):Promise<MediaSource> {
    return this.request('/v1/conversations/'+encodeURIComponent(conversationId)+'/media/'+encodeURIComponent(messageId)+'/source?variant='+variant,MediaSource,undefined,signal);
  }
  async mediaContent(source:MediaSource,signal:AbortSignal):Promise<{mime:string;bytes:Uint8Array<ArrayBuffer>}> {
    this.requireScope();
    const result=await this.fetchResponse('/v1/conversations/'+encodeURIComponent(source.conversationId)+'/media/'+encodeURIComponent(source.messageId)
      +'/content?variant='+source.variant+'&sourceVersion='+source.sourceVersion,{headers:this.headers(),signal},'bytes',source.maxBytes,source.sourceVersion);
    this.assertActive();
    const parsed=z.object({mime:z.string(),bytes:z.instanceof(Uint8Array)}).parse(result);
    if(parsed.mime!==source.mime || !parsed.bytes.length || parsed.bytes.length>source.maxBytes)throw new Error('Invalid media content.');
    if(!(parsed.bytes.buffer instanceof ArrayBuffer))throw new Error('Invalid media buffer.');
    return {mime:parsed.mime,bytes:new Uint8Array(parsed.bytes.buffer,parsed.bytes.byteOffset,parsed.bytes.byteLength)};
  }
  static async provision(baseUrl: string): Promise<string> {
    const response = await fetch(baseUrl.replace(/\/$/,'')+'/v1/local-provision', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_OS === 'web' ? {} : { Origin: 'http://localhost' }) }, body: JSON.stringify({ confirmLocalDemo: true }),
    });
    if (!response.ok) throw new Error('Local connection failed. Start pnpm backend on this computer, or enter its service token.');
    return z.object({ token: z.string().min(16), demo: z.boolean() }).parse(await response.json()).token;
  }
}
