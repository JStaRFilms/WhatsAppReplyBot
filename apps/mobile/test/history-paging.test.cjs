const test=require('node:test');
const assert=require('node:assert/strict');
const {load,deferred,hooks,nodes}=require('./render-harness.cjs');
const {core,contracts,apiFixture,scope,json}=require('./profile-fixture.cjs');
const api=apiFixture(()=>assert.fail('Synthetic only'));
const {HistoryCache}=load('lib/history-cache.ts',{'./api':api,'@replybot/core/api':core});
const message=(n,extra={})=>({id:'message-'+String(n).padStart(4,'0'),accountId:scope().accountId,conversationId:'physical',transportId:'transport-'+n,
  direction:'inbound',authorship:'contact_written',source:'live',occurredAt:100,text:'Synthetic '+n,quotedMessageId:null,statusReply:false,statusContext:null,media:null,reaction:null,...extra});
function fixture(count=401){
  let rows=Array.from({length:count},(_,n)=>message(n)),epoch=1,revision=1,fail=null,held=null,active=true;const calls=[];
  const client={assertActive(){if(!active)throw new Error('Revoked');},async request(path,schema){calls.push(path);if(held)await held.promise;if(fail)throw fail;
    const url=new URL(path,'http://synthetic.local'),around=url.searchParams.get('around'),before=url.searchParams.get('before'),after=url.searchParams.get('after');let start;
    if(around){const index=rows.findIndex(row=>row.id===around);if(index<0)throw new api.ApiError('history_source_unavailable');start=Math.max(0,index-24);}
    else if(before)start=Math.max(0,Number(before)-50);else if(after)start=Number(after)+1;else start=Math.max(0,rows.length-50);
    const messages=rows.slice(start,start+50),end=start+messages.length-1;
    return schema.parse({conversationId:'chat',messages,unavailableSourceIds:[],sourceEpoch:epoch,revision,beforeCursor:String(start),afterCursor:String(end),hasOlder:start>0,hasNewer:end<rows.length-1,latestMessageId:rows.at(-1)?.id ?? null});
  }};
  const cache=new HistoryCache(client);cache.configure(true);
  return{cache,calls,client,append(){rows.push(message(rows.length));revision++;},remove(id){rows=rows.filter(row=>row.id!==id);epoch++;revision++;},epoch(){epoch++;revision++;},
    fail:error=>{fail=error;},hold:()=>held=deferred(),release:()=>{held?.resolve();held=null;},revoke:()=>{active=false;cache.dispose();}};
}
test('stored message 101 and earlier are reachable, equal times retain IDs and six pages evict the far edge',async()=>{
  const f=fixture();await f.cache.load('chat');f.cache.pin('chat',{id:message(351).id,offset:-7});
  await f.cache.older('chat');assert.equal(f.cache.get('chat').messages.length,100);
  for(let i=0;i<7;i++){const first=f.cache.get('chat').messages[0];f.cache.pin('chat',{id:first.id,offset:0});await f.cache.older('chat');}
  const value=f.cache.get('chat');assert.ok(value.messages.some(row=>row.id===message(1).id));assert.ok(value.messages.length<=300);
  assert.equal(new Set(value.messages.map(row=>row.id)).size,value.messages.length);assert.equal(value.hasNewer,true);
  assert.ok(value.messages.every(row=>row.conversationId==='physical'));
});
test('older-window refresh keeps its fence and anchor, while explicit Latest fetches a fresh tail',async()=>{
  const f=fixture();await f.cache.load('chat');await f.cache.around('chat',message(100).id);f.cache.pin('chat',{id:message(100).id,offset:-4});
  const ids=f.cache.get('chat').messages.map(row=>row.id);f.append();await f.cache.load('chat',true);
  assert.deepEqual(f.cache.get('chat').messages.map(row=>row.id),ids);assert.match(f.calls.at(-1),/around=message-0100/);assert.equal(f.cache.get('chat').hasNewer,true);
  await f.cache.latest('chat');assert.equal(f.cache.get('chat').messages.at(-1).id,message(401).id);
});
test('same direction/cursor coalesces; newer anchored reads supersede a delayed tail and disposed callbacks cannot publish',async()=>{
  const f=fixture(),held=f.hold();const a=f.cache.load('chat'),b=f.cache.load('chat');assert.equal(a,b);assert.equal(f.calls.length,1);
  const anchored=f.cache.around('chat',message(100).id);held.resolve();await Promise.all([a,anchored]);assert.ok(f.cache.get('chat').messages.some(row=>row.id===message(100).id));
  f.release();const late=f.hold();const pending=f.cache.latest('chat');f.revoke();late.resolve();await assert.rejects(pending,/Revoked/);assert.equal(f.cache.get('chat'),undefined);
});
test('a superseded around read is not reused by a later navigation to the same source',async()=>{
  const f=fixture(),held=deferred(),original=f.client.request.bind(f.client);let first=true;
  f.client.request=async(path,schema)=>{if(path.includes('around=') && first){first=false;await held.promise;}return original(path,schema);};
  const old=f.cache.around('chat',message(100).id);await f.cache.latest('chat');const current=await f.cache.around('chat',message(100).id);
  assert.ok(current.messages.some(row=>row.id===message(100).id));held.resolve();await old;assert.equal(f.cache.anchor('chat').id,message(100).id);
  assert.equal(f.calls.filter(path=>path.includes('around=')).length,2);
  const next=deferred();f.client.request=async(path,schema)=>{if(path.includes('before='))await next.promise;return original(path,schema);};
  const pending=f.cache.older('chat'),ids=f.cache.get('chat').messages.map(row=>row.id);f.cache.cancelPageReads('chat');next.resolve();await pending;
  assert.deepEqual(f.cache.get('chat').messages.map(row=>row.id),ids);
});

test('source epoch drops stale cursors and reanchors; a missing anchor uses one closest cached neighbor with an explanation',async()=>{
  const f=fixture();await f.cache.around('chat',message(100).id);f.cache.pin('chat',{id:message(100).id,offset:-13});
  f.remove(message(100).id);await f.cache.load('chat',true);assert.equal(f.cache.get('chat').sourceEpoch,2);
  assert.equal(f.cache.anchor('chat').id,message(101).id);assert.match(f.cache.get('chat').notice,/closest stored neighbor/);
  assert.equal(f.calls.filter(path=>path.includes('around=')).length,3);
});
test('a stale cursor reanchors instead of fetching latest; refresh errors keep cached text visibly stale',async()=>{
  const f=fixture();await f.cache.load('chat');f.cache.pin('chat',{id:message(360).id,offset:9});
  const original=f.client.request.bind(f.client);let stale=true;f.client.request=(path,schema)=>{if(stale && path.includes('before=')){stale=false;throw new api.ApiError('history_cursor_stale');}return original(path,schema);};
  // API errors are promises in the actual client.
  const request=f.client.request;f.client.request=async(...args)=>request(...args);
  await f.cache.older('chat');assert.match(f.calls.at(-1),/around=message-0360/);
  const text=f.cache.get('chat').messages[0].text;f.fail(new Error('Synthetic offline'));await assert.rejects(f.cache.load('chat',true));
  assert.equal(f.cache.get('chat').messages[0].text,text);assert.equal(f.cache.get('chat').stale,true);
});
test('global group/message/serialized bounds preserve whole text and reject an oversized pinned page',async()=>{
  const f=fixture(50);for(let n=0;n<25;n++){
    f.client.request=async(_path,schema)=>schema.parse({conversationId:'chat-'+n,messages:Array.from({length:50},(_,i)=>message(i,{text:'Whole text '+i})),unavailableSourceIds:[],revision:1,sourceEpoch:1,beforeCursor:null,afterCursor:null,hasOlder:false,hasNewer:false,latestMessageId:message(49).id});
    await f.cache.load('chat-'+n);
  }
  assert.equal(f.cache.get('chat-0'),undefined);assert.ok(f.cache.get('chat-24'));
  const big=fixture(1);await big.cache.load('chat');const previous=big.cache.get('chat');
  big.client.request=async(_path,schema)=>schema.parse({conversationId:'chat',messages:Array.from({length:50},(_,n)=>message(n,{text:'界'.repeat(100000)})),unavailableSourceIds:[],sourceEpoch:2,revision:2,beforeCursor:null,afterCursor:null,hasOlder:false,hasNewer:false,latestMessageId:message(0).id});
  await assert.rejects(big.cache.load('chat',true),/Text was not shortened/);assert.equal(big.cache.get('chat').messages[0].text,previous.messages[0].text);
});
test('canonical inbox grouping uses the real last-message ID and keeps original-identity local drafts discoverable',()=>{
  const h=hooks(),localIds=['alias'],physical=message(1,{conversationId:'alias'}),conversation={id:'chat',name:'Synthetic',lastHumanActivityAt:1};
  const app={palette:{},history:{load:async()=>{}},snapshot:{accountId:scope().accountId,conversations:[conversation,{...conversation,id:'alias'}],drafts:[],lastMessages:[physical],unreadCounts:{chat:1},
    historyGroups:[{id:'chat',memberIds:['chat','alias'],lastMessageId:physical.id,revision:1,sourceEpoch:1,aiBlocked:false}]}};
  const component=load('components/chat-list.tsx',{react:{...h.react,useDeferredValue:value=>value},'react-native':{FlatList:'list',Pressable:'pressable',ScrollView:'scroll',Text:'text',TextInput:'input',View:'view'},
    'lucide-react-native':{},'expo-router':{useRouter:()=>({})},'./ui':{Page:'page',EmptyConnection:'empty'},'./chat-row':{ChatRow:'row'},'../lib/app-state':{useApp:()=>app},'../lib/local-drafts':{useLocalDraftIds:()=>localIds},'../lib/theme':{fonts:{}}});
  const render=()=>h.render(()=>component.ChatList({active:true}));let tree=render();
  nodes(tree).find(node=>node.type==='pressable' && node.props.accessibilityLabel==='Drafts 1').props.onPress();tree=render();const list=nodes(tree).find(node=>node.type==='list');
  assert.equal(list.props.data.length,1);assert.equal(list.props.data[0].id,'chat');const row=list.props.renderItem({item:conversation});
  assert.equal(row.props.localDraft,true);assert.equal(row.props.originalLocalDraft,true);assert.equal(row.props.last.id,physical.id);assert.equal(row.props.last.conversationId,'alias');
});

test('legacy discovery remains strict and missing paging flags use only the legacy read',async()=>{
  for(const capabilities of [undefined,{ownerInstructions:true,contactBookNames:true},{ownerInstructions:true,historyPaging:true,privateMediaCache:true}]){
    const calls=[];const {ApiClient}=apiFixture(async(url)=>{calls.push(url);return json({protocol:2,scope:scope(),label:'Synthetic',transition:null,...(capabilities?{capabilities}:{})});});
    const result=await new ApiClient('http://synthetic.local','synthetic-token').session();assert.deepEqual(result.capabilities,capabilities);assert.match(calls[0],/capabilities=1&historyMedia=1/);
  }
  const legacy=core.SessionDiscovery.omit({capabilities:true}).extend({capabilities:require('zod').z.object({ownerInstructions:require('zod').z.boolean().optional(),contactBookNames:require('zod').z.boolean().optional()}).strict().optional()});
  assert.equal(legacy.safeParse({protocol:2,scope:scope(),label:'Old',transition:null,capabilities:{ownerInstructions:true}}).success,true);
  assert.equal(legacy.safeParse({protocol:2,scope:scope(),label:'Old',transition:null,capabilities:{historyPaging:true}}).success,false);
  const calls=[],cache=new HistoryCache({assertActive(){},request:async(path,schema)=>{calls.push(path);return schema.parse({messages:[message(1)],watermark:12});}});
  await cache.load('chat');assert.deepEqual(calls,['/v1/conversations/chat/history']);assert.equal(cache.get('chat').hasOlder,undefined);
});
