import test from 'node:test';
import assert from 'node:assert/strict';
import { Action, SingleEmoji, actionUnits, type Component } from '../src/contracts.ts';
import { SqliteStore } from '../src/store.ts';
import { Workflow } from '../src/workflow.ts';
import { chat, message } from './fixtures.ts';

const sequence: Action = {kind:'text_sequence',messages:[{text:'first',quotedMessageId:'m1'},{text:'second',quotedMessageId:null},{text:'third',quotedMessageId:'m2'}],reason:'Synthetic conversation'};
function setup(maxUnits=3, sleep?: (ms:number, signal:AbortSignal)=>Promise<void>) {
  const store=new SqliteStore();let now=1000;store.saveModelConsent('a',true);
  store.saveConversation({...chat(),mode:'auto_reply'});store.saveMessage(message());store.saveMessage(message('m2'));
  const flow=new Workflow(store,'a',()=>now,sleep ?? (async ms=>{now+=ms;}));
  const proposal=flow.propose('c1',{kind:'delegate',maxUnits,expiresAt:100000},'grant');flow.confirm(proposal.id,proposal.payloadHash,'confirm');
  const draft=flow.createDraft('c1',sequence,flow.conversation('c1').workflowVersion,'draft');
  return {store,flow,draft,now:()=>now,advance:(ms:number)=>{now+=ms;}};
}

test('single emoji validation supports Unicode sequences without accepting text or multiple emoji',()=>{
  for(const emoji of ['🔥','👨‍👩‍👧‍👦','👍🏾','🇳🇬','❤️','1️⃣','🏳️‍🌈','☕'])assert.equal(SingleEmoji.parse(emoji),emoji);
  for(const text of ['', 'hello', '🔥🔥','🔥 hello','🇳','🏾','👍 🏾','a','1'])assert.equal(SingleEmoji.safeParse(text).success,false,text);
  assert.equal(Action.safeParse({kind:'reaction',reaction:{targetMessageId:'m1',emoji:'🔥'},reason:'test'}).success,true);
});
test('sequence contract is exact, bounded and charges each component',()=>{
  assert.equal(actionUnits(Action.parse(sequence)),3);
  assert.equal(actionUnits(Action.parse({...sequence,messages:[...sequence.messages,{text:'four'},{text:'five'}]})),5);
  for(const messages of [[],[{text:'one'}],Array.from({length:6},()=>({text:'x'})),[{text:' '},{text:'x'}],[{text:'x'.repeat(2001)},{text:'y'.repeat(2000)}],[{text:'x'.repeat(4001)},{text:'y'}]])
    assert.equal(Action.safeParse({kind:'text_sequence',messages,reason:'test'}).success,false);
  assert.equal(Action.safeParse({...sequence,text:'extra'}).success,false);
});
test('whole sequence reserves before sending; capacity and cross-chat quotes never cause partial grants',()=>{
  const {store,flow,draft}=setup(2);
  try{
    assert.throws(()=>flow.autoSend(draft.id,'send'),/grant_limit/);assert.equal(store.outboxes('a').length,0);
    assert.equal(store.grants('a','c1')[0]?.reservedUnits,0);assert.equal(store.grants('a','c1')[0]?.maxUnits,2);
    store.saveConversation(chat('other'));store.saveMessage(message('foreign','other'));
    assert.throws(()=>flow.createDraft('c1',{...sequence,messages:[{text:'one',quotedMessageId:'foreign'},{text:'two'}]},flow.conversation('c1').workflowVersion,'foreign'),/invalid_quote/);
  }finally{store.close();}
});
test('durable due times follow acceptance, each quote is distinct, and concurrent dispatch cannot duplicate sends',async()=>{
  const {store,flow,draft,now,advance}=setup();const queued=flow.autoSend(draft.id,'send');const times:number[]=[];
  assert.equal(store.grants('a','c1')[0]?.reservedUnits,3);
  const handoff=async(part:Component)=>{
    times.push(now());advance(200);return {state:'accepted' as const,transportId:part.text ?? ''};
  };
  try{
    const [result]=await Promise.all([flow.dispatch(queued.id,handoff),flow.dispatch(queued.id,handoff)]);
    assert.deepEqual(times,[1000,6200,11400]);assert.equal(result.state,'accepted');
    assert.deepEqual(result.components.map(p=>p.dueAt),[1000,6200,11400]);
    assert.deepEqual(store.messages('a','c1').filter(m=>m.direction==='outbound').map(m=>m.quotedMessageId),['m1',null,'m2']);
    assert.equal(store.grants('a','c1')[0]?.successfulUnits,3);assert.equal(store.grants('a','c1')[0]?.reservedUnits,0);
  }finally{store.close();}
});
test('intervention wakes a pending gap immediately and releases only unsent reservations',async()=>{
  let waiting:()=>void=()=>{};const entered=new Promise<void>(resolve=>{waiting=resolve;});
  const {store,flow,draft}=setup(3,async(_ms,signal)=>{
    waiting();await new Promise<void>((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});});
  });
  const queued=flow.autoSend(draft.id,'send');let calls=0;
  try{
    const delivery=flow.dispatch(queued.id,async()=>({state:'accepted',transportId:'sent-'+ ++calls}));
    await entered;flow.composer('c1',true,'typing');const result=await delivery;
    assert.equal(calls,1);assert.deepEqual(result.components.map(p=>p.state),['accepted','cancelled','cancelled']);
    assert.equal(store.grants('a','c1')[0]?.successfulUnits,1);assert.equal(store.grants('a','c1')[0]?.reservedUnits,0);
  }finally{store.close();}
});
test('every sequence handoff rechecks input, consent, grant, policy, audio and quotes',async()=>{
  for(const cause of ['incoming','pause','owner','consent','expiry','exclusion','hours','audio','quote'] as const){
    let intervene=()=>{};
    const {store,flow,draft,advance}=setup(3,async ms=>{advance(ms);intervene();});
    const audio={...message('audio'),media:{kind:'audio' as const,access:'available' as const,fixture:null,description:'Synthetic speech',viewOnce:false,expiresAt:null}};
    store.saveMessage(audio);store.saveDraft({...draft,audioSourceIds:['audio']});const queued=flow.autoSend(draft.id,'send');let calls=0;
    intervene=()=>{
      if(cause==='incoming')flow.observe(message('new'));
      if(cause==='pause')flow.pause('c1','pause');
      if(cause==='owner')flow.observe({...message('owner'),direction:'outbound',authorship:'owner_written'},true);
      if(cause==='consent')flow.setModelConsent(false,'consent-revoke');
      if(cause==='expiry')advance(100000);
      if(cause==='exclusion')store.saveConversation({...flow.conversation('c1'),excluded:true});
      if(cause==='hours')store.saveConversation({...flow.conversation('c1'),hours:{timezone:'not-a-zone',start:1,end:2}});
      if(cause==='audio')store.saveMessage({...audio,media:{...audio.media,access:'missing'}});
      if(cause==='quote')store.saveWaMessage('a','c1','m2',JSON.stringify({deleted:true}));
    };
    try{
      const result=await flow.dispatch(queued.id,async()=>({state:'accepted',transportId:'sent-'+ ++calls}));
      // The last component quotes m2, so quote deletion permits the unquoted second component.
      const expected=cause==='quote'?2:1;
      assert.equal(calls,expected,cause);assert.equal(result.components.filter(p=>p.state==='accepted').length,expected,cause);
      assert.equal(store.grants('a','c1')[0]?.successfulUnits,expected,cause);assert.equal(store.grants('a','c1')[0]?.reservedUnits,0,cause);
    }finally{store.close();}
  }
});
test('expiry wakes before the five-second due time, preserving the accepted unit',async()=>{
  const waits:number[]=[];const {store,flow,draft,advance}=setup(3,async ms=>{waits.push(ms);advance(ms);});
  const grant=store.grants('a','c1')[0];assert.ok(grant);store.saveGrant({...grant,expiresAt:2500});const queued=flow.autoSend(draft.id,'send');
  try{
    let calls=0;const result=await flow.dispatch(queued.id,async()=>({state:'accepted',transportId:'sent-'+ ++calls}));
    assert.deepEqual(waits,[1500]);assert.equal(calls,1);assert.equal(result.components[1]?.dueAt,6000);
    assert.equal(store.grants('a','c1')[0]?.successfulUnits,1);assert.equal(store.grants('a','c1')[0]?.reservedUnits,0);
  }finally{store.close();}
});
test('recovery during a gap retains the accepted prefix and cannot resurrect unsent text',async()=>{
  let recover=()=>{};const {store,flow,draft,advance}=setup(3,async ms=>{advance(ms);recover();});
  const queued=flow.autoSend(draft.id,'send');recover=()=>new Workflow(store,'a').recover();
  try{
    let calls=0;const handoff=async()=>({state:'accepted' as const,transportId:'sent-'+ ++calls});
    const result=await flow.dispatch(queued.id,handoff);assert.deepEqual(result.components.map(p=>p.state),['accepted','cancelled','cancelled']);
    await flow.dispatch(queued.id,handoff);assert.equal(calls,1);assert.equal(store.grants('a','c1')[0]?.successfulUnits,1);assert.equal(store.grants('a','c1')[0]?.reservedUnits,0);
  }finally{store.close();}
});
test('unknown handoffs retain their one unit, stop the burst and never blindly retry',async()=>{
  const {store,flow,draft}=setup();const queued=flow.autoSend(draft.id,'send');let calls=0;
  try{
    const handoff=async()=> ++calls===1 ? {state:'accepted' as const,transportId:'first'} : {state:'unknown' as const};
    const result=await flow.dispatch(queued.id,handoff);assert.deepEqual(result.components.map(p=>p.state),['accepted','unknown','cancelled']);
    assert.equal(store.grants('a','c1')[0]?.successfulUnits,1);assert.equal(store.grants('a','c1')[0]?.reservedUnits,1);
    flow.recover();await flow.dispatch(queued.id,handoff);assert.equal(calls,2);
  }finally{store.close();}
});
test('restart cancels unhanded sequence components but retains accepted and uncertain accounting',async()=>{
  const {store,flow,draft}=setup();const queued=flow.autoSend(draft.id,'send');
  const first=queued.components[0];assert.ok(first);first.state='dispatching';store.saveOutbox(queued);
  try{
    new Workflow(store,'a').recover();const restored=store.outbox('a',queued.id);
    assert.deepEqual(restored?.components.map(p=>p.state),['unknown','cancelled','cancelled']);
    assert.equal(store.grants('a','c1')[0]?.reservedUnits,1);
    let calls=0;await flow.dispatch(queued.id,async()=>{calls++;return {state:'failed'};});assert.equal(calls,0);
  }finally{store.close();}
});
