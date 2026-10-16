import { createHash } from 'node:crypto';
import { Draft, DomainError, aiAccess, requiredContextMessageIds, type AudioTranscript, type Action, type ModelContext, type Workflow } from '@replybot/core';
import { demoReply } from './demo-model.ts';
import type { VisualFrame } from './media.ts';
import { readableAudio, type AudioService, type Transcriber } from './audio.ts';
export interface RemoteModel { generate:(context:ModelContext,visuals?:VisualFrame[])=>Promise<Action>; transcribe?:Transcriber['transcribe']; asrProvenance?:Transcriber['asrProvenance'] }
export function draftGenerator(flow:Workflow,remote?:RemoteModel,media?:{visuals:(context:ModelContext)=>Promise<VisualFrame[]>},audio?:AudioService,now=Date.now) {
  const active=new Map<string,{hash:string;result:Promise<Draft>}>();
  const generations=new Map<string,Promise<Draft>>();
  return async(conversationId:string,requestId:string):Promise<Draft>=>{
    const payloadHash=createHash('sha256').update(JSON.stringify({operation:'model-draft',conversationId})).digest('hex');
    const saved=flow.store.request(flow.accountId,requestId);
    if(saved){if(saved.hash!==payloadHash)throw new DomainError('request_id_conflict');return Draft.parse(saved.result);}
    const running=active.get(requestId);
    if(running){if(running.hash!==payloadHash)throw new DomainError('request_id_conflict');return running.result;}
    const result=(async()=>{
      flow.assertFreshAction(conversationId);
      const c=flow.effectiveConversation(conversationId);
      const sourceEpoch=flow.store.historyGroup(flow.accountId,conversationId).sourceEpoch;
      if(c.control==='manual')throw new DomainError('ai_access_denied',403);
      if(flow.groupUnknown(conversationId))throw new DomainError('delivery_unknown');
      if(remote && !flow.store.modelConsent(flow.accountId))throw new DomainError('model_consent_required',403);
      const ownerInstructions=flow.store.ownerInstructions(flow.accountId);
      const nameRevision=c.nameRevision ?? 0;
      const context=flow.context(conversationId);
      const existing=flow.store.drafts(flow.accountId,conversationId).filter(d=>d.state==='pending' && d.workflowVersion===c.workflowVersion && d.policyVersion===c.policyVersion && (d.sourceEpoch===undefined || d.sourceEpoch===sourceEpoch)).at(-1);
      if(existing){flow.store.saveRequest(flow.accountId,requestId,payloadHash,existing);return existing;}
      const key=JSON.stringify([conversationId,c.workflowVersion,c.policyVersion,sourceEpoch,ownerInstructions.revision,nameRevision]);
      let job=generations.get(key);
      if(!job){
        job=(async()=>{
          const guard=()=>{
            const current=flow.effectiveConversation(conversationId);
            if(flow.groupUnknown(conversationId))throw new DomainError('delivery_unknown');
            if(!aiAccess(current,flow.accountId) || current.control==='manual')throw new DomainError('ai_access_denied',403);
            if(remote && !flow.store.modelConsent(flow.accountId))throw new DomainError('model_consent_revoked',403);
            if(flow.store.historyGroup(flow.accountId,conversationId).sourceEpoch!==sourceEpoch || current.workflowVersion!==c.workflowVersion || current.policyVersion!==c.policyVersion
              || flow.store.ownerInstructions(flow.accountId).revision!==ownerInstructions.revision || (current.nameRevision ?? 0)!==nameRevision)throw new DomainError('stale_workflow');
          };
          guard();
          const transcripts=new Map<string,AudioTranscript>();
          const audioFailures=new Map<string,string>();
          if(remote?.transcribe && audio)for(const message of context.messages.filter(m=>m.direction==='inbound' && readableAudio(m,now())).slice(-2)) {
            guard();
            try{transcripts.set(message.id,await audio.transcript(message,{transcribe:remote.transcribe,...(remote.asrProvenance ? {asrProvenance:remote.asrProvenance} : {})},guard));}
            catch(error){guard();audioFailures.set(message.id,error instanceof DomainError ? error.code : 'transcription_unknown');}
          }
          guard();
          for(const message of context.messages)if(transcripts.has(message.id)){
            try{audio?.check(message);}catch{transcripts.delete(message.id);}
          }
          const prepared=flow.context(conversationId,transcripts);
          const required=requiredContextMessageIds(prepared.messages);
          const missingAudio=prepared.messages.find(m=>required.has(m.id) && m.direction==='inbound' && m.media?.kind==='audio' && !m.audioTranscript);
          if(remote && missingAudio){
            const failure=audioFailures.get(missingAudio.id);
            const reason=failure==='transcription_unknown'
              ? 'The voice note transcription is unconfirmed. It will not be requested again automatically. Review the note before replying.'
              : failure==='invalid_transcript_response'
              ? 'The transcription service returned an unreadable result. It will not be requested again automatically. Review the voice note before replying.'
              : failure==='model_request_failed' || failure==='audio_attempt_unavailable'
              ? 'The voice note transcript is unavailable. The previous transcription attempt will not be repeated automatically. Review the note before replying.'
              : 'The voice note transcript is unavailable. Review the note before replying.';
            guard();
            return flow.createDraft(conversationId,{kind:'handover',reason},c.workflowVersion,requestId+'-result');
          }
          const visuals=remote && media ? await media.visuals(prepared) : [];
          guard();
          for(const message of prepared.messages)if(message.audioTranscript)audio?.check(message);
          const action=remote ? await remote.generate(prepared,visuals) : demoReply(prepared);
          guard();
          return flow.createDraft(conversationId,action,c.workflowVersion,requestId+'-result',prepared.messages.filter(m=>m.audioTranscript).map(m=>m.id));
        })().finally(()=>generations.delete(key));
        generations.set(key,job);
      }
      const draft=await job;flow.store.saveRequest(flow.accountId,requestId,payloadHash,draft);return draft;
    })();
    active.set(requestId,{hash:payloadHash,result});
    try{return await result;}finally{active.delete(requestId);}
  };
}
