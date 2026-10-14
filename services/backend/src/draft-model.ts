import { createHash } from 'node:crypto';
import { Draft, DomainError, type Action, type ModelContext, type Workflow } from '@replybot/core';
import { demoReply } from './demo-model.ts';
import type { VisualFrame } from './media.ts';
export interface RemoteModel { generate: (context: ModelContext, visuals?:VisualFrame[]) => Promise<Action> }
export function draftGenerator(flow: Workflow, remote?: RemoteModel, media?:{visuals:(context:ModelContext)=>Promise<VisualFrame[]>}) {
  const active = new Map<string, { hash: string; result: Promise<Draft> }>();
  return async (conversationId: string, requestId: string): Promise<Draft> => {
    const payloadHash = createHash('sha256').update(JSON.stringify({ operation: 'model-draft', conversationId })).digest('hex');
    const saved = flow.store.request(flow.accountId, requestId);
    if (saved) {
      if (saved.hash !== payloadHash) throw new DomainError('request_id_conflict');
      return Draft.parse(saved.result);
    }
    const running = active.get(requestId);
    if (running) {
      if (running.hash !== payloadHash) throw new DomainError('request_id_conflict');
      return running.result;
    }
    const result = (async () => {
      const c = flow.conversation(conversationId);
      if (c.control === 'manual') throw new DomainError('ai_access_denied', 403);
      const context = flow.context(conversationId);
      if (remote && !flow.store.modelConsent(flow.accountId)) throw new DomainError('model_consent_required', 403);
      const visuals=remote && media ? await media.visuals(context) : [];
      const current=flow.conversation(conversationId);
      if(current.workflowVersion!==c.workflowVersion || current.control==='manual')throw new DomainError('stale_workflow');
      if(remote && !flow.store.modelConsent(flow.accountId))throw new DomainError('model_consent_revoked',403);
      const action = remote ? await remote.generate(context,visuals) : demoReply(context);
      if (remote && !flow.store.modelConsent(flow.accountId)) throw new DomainError('model_consent_revoked', 403);
      const draft = flow.createDraft(conversationId, action, c.workflowVersion, requestId+'-result');
      flow.store.saveRequest(flow.accountId, requestId, payloadHash, draft);
      return draft;
    })();
    active.set(requestId, { hash: payloadHash, result });
    try { return await result; } finally { active.delete(requestId); }
  };
}
