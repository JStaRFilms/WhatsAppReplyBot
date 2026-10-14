import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat,message } from './fixtures.ts';

test('transcript-derived drafts and queued replies cannot outlive their audio source',async()=>{
  for(const stage of ['generation','approval','dispatch'] as const){
    let now=1000;const store=new SqliteStore();store.saveConversation({...chat(),mode:'draft_only'});
    store.saveMessage({...message(),text:'',media:{kind:'audio',access:'available',fixture:null,description:'Synthetic audio',viewOnce:false,expiresAt:1001}});
    const flow=new Workflow(store,'a',()=>now);const action={kind:'text' as const,text:'synthetic reply',reason:'test'};
    try{
      if(stage==='generation'){now=1002;assert.throws(()=>flow.createDraft('c1',action,1,'draft',['m1']),/audio_source_unavailable/);continue;}
      const draft=flow.createDraft('c1',action,1,'draft',['m1']);assert.deepEqual(draft.audioSourceIds,['m1']);
      if(stage==='approval'){now=1002;assert.throws(()=>flow.approve(draft.id,1,'approve'),/audio_source_unavailable/);continue;}
      const queued=flow.approve(draft.id,1,'approve');assert.deepEqual(queued.audioSourceIds,['m1']);now=1002;let sends=0;
      const result=await flow.dispatch(queued.id,async()=>{sends++;return{state:'accepted',transportId:'forbidden'};});
      assert.equal(result.state,'cancelled');assert.equal(sends,0);
    }finally{store.close();}
  }
});
test('audio provenance cannot cite another chat, deletion or view-once metadata',()=>{
  const store=new SqliteStore();store.saveConversation({...chat(),mode:'draft_only'});store.saveConversation(chat('c2'));
  const source={...message(),media:{kind:'audio' as const,access:'available' as const,fixture:null,description:'Synthetic',viewOnce:false,expiresAt:null}};
  store.saveMessage(source);const flow=new Workflow(store,'a',()=>1000);const action={kind:'text' as const,text:'reply',reason:'test'};
  try{
    assert.throws(()=>flow.createDraft('c2',action,1,'other-chat',['m1']),/audio_source_unavailable/);
    store.saveMessage({...source,media:{...source.media,viewOnce:true}});assert.throws(()=>flow.createDraft('c1',action,1,'view-once',['m1']),/audio_source_unavailable/);
    store.saveMessage({...source,text:'[Message deleted]',media:null});assert.throws(()=>flow.createDraft('c1',action,1,'deleted',['m1']),/audio_source_unavailable/);
  }finally{store.close();}
});
