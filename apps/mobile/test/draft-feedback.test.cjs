const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {providerFixture,core,contracts,scope,snapshot,json,descriptor,apiFixture}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const button=(tree,value)=>{const result=nodes(tree).find(node=>node.props?.label===value);assert.ok(result,'Missing button '+value);return result;};
const copy=tree=>nodes(tree).filter(node=>node.type==='text').map(node=>node.props.children).flat().join(' ');
const draft=(extra={})=>({id:'draft-current',accountId:scope().accountId,conversationId:'chat',triggerMessageId:'source',workflowVersion:1,policyVersion:1,revision:1,
  action:{kind:'text',text:'A suggested response',reason:'Synthetic draft'},state:'pending',createdAt:2,edited:false,...extra});
function fixture(options={}){
  const h=lifecycleHooks(),response=deferred(),reads=deferred(),requests=[],locates=[];let id='chat',serial=0,text='',foreground=true;
  const api=apiFixture(()=>assert.fail('No network'));
  const conversation={...snapshot(scope()).conversations[0],id:'chat',control:'assistant_allowed',workflowVersion:1};
  let cached=options.cold?undefined:{messages:[{id:'source',text:'Invented source',conversationId:id}]};
  const historyCalls=[],viewedIds=[],frames=[],timers=new Map();let timerSerial=0;
  const scrolling={scroll:{current:null},position:{positioned:true,dragging:false,target:null},positioned:true,visibleIds:[],settled:true,visibilityRevision:0,verifyVisibility:(verified,current)=>{if(current())verified();return()=>{};},locate:value=>locates.push(value),latest(){},...options.scrolling};
  const read=kind=>{historyCalls.push(kind);return reads.promise.then(value=>{if(value)cached=value;return value;});};
  const app={snapshot:{...snapshot(scope()),historyVersions:{},conversations:[conversation,{...conversation,id:'other'}]},palette:{},status:'online',client:{},
    intents:{subscribe(){},get:()=>[]},history:{subscribe(){},get:()=>cached,load:()=>read('refresh'),around:(_id,source)=>read('around:'+source)},
    mediaCache:{setViewerOpen(){},revalidate:async()=>{},invalidate(){}},discovery:options.paging?{capabilities:{historyPaging:true,privateMediaCache:true}}:null,
    composer:async()=>{},viewedMessages:async(_id,ids)=>{viewedIds.push([...ids]);},viewed:async()=>{},reportError:()=>assert.fail('Draft feedback must not clear or replace unrelated domain/unknown warnings'),refresh:async()=>{},
    mutate:async(path,schema,payload)=>{requests.push({path,payload});return schema.parse(await response.promise);}};
  const component=load('app/conversation/[id].tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input',Pressable:'pressable',ScrollView:'scroll',Modal:'modal',ActivityIndicator:'spinner'},
    'expo-router':{useLocalSearchParams:()=>({id,draftId:options.draftId}),useRouter:()=>({}),useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'lucide-react-native':{},'expo-image':{Image:'image'},
    '@replybot/core/contracts':contracts,'../../components/media-viewer':{MediaViewer:'viewer'},'../../lib/uuid':{randomUUID:()=> 'draft-request-'+(++serial)},'../../lib/app-state':{useApp:()=>app},
    '../../lib/api':api,'../../lib/pending-intents':{intentVisible:()=>true},'../../lib/media-lease':{},
    '../../lib/local-drafts':{useLocalDraftIds:()=>options.localIds ?? [],useLocalDraft:()=>({text,setText:value=>{text=value;},ready:true})},'../../lib/theme':{fonts:{}},
    '../../lib/foreground':{isForeground:()=>foreground,useForeground:()=>foreground},
    '../../lib/composer-focus':{useComposerFocus:()=>h.react.useMemo(()=>({input:{current:null},focus(){},clear(){},onFocus(){},onBlur(){}}),[])},
    '../../lib/conversation-scroll':{useConversationScroll:()=>scrolling},
    ...Object.fromEntries(['voice-composer','attachment-picker','avatar','ui','chat-badge','message-bubble','draft-card','pause-controls','permission-sheet','outgoing-status'].map(name=>['../../components/'+name,{
      VoiceComposer:'voice',AttachmentPicker:'attachment',Avatar:'avatar',Page:'page',Button:'button',ChatBadge:'badge',MessageBubble:'bubble',DraftCard:'draft',PauseControls:'pause',PermissionSheet:'permissions',OutboxStatus:'outbox'}])),
  },{Map,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},clearTimeout:id=>timers.delete(id),setTimeout:(fn,delay)=>{const id=++timerSerial;timers.set(id,{fn,delay});return id;}});
  const render=()=>h.commit(component.default);
  const request=()=>{const node=nodes(render()).find(node=>node.type==='pressable' && nodes(node).some(child=>child.type==='text' && ['Draft reply','Drafting…'].includes(child.props.children)));node.props.onPress();return render();};
  return{h,app,response,reads,requests,locates,render,request,api,historyCalls,viewedIds,scrolling,fireFrames:()=>frames.splice(0).forEach(fn=>fn()),fireVisible:()=>{for(const [id,timer] of timers)if(timer.delay===600){timers.delete(id);timer.fn();}},background:()=>{foreground=false;return render();},context:value=>{cached=value;return render();},route:next=>{id=next;return render();}};
}
test('Drafting is immediate, typing/history/quote stay available; validated result and View do not wait for snapshot/history reads',async()=>{
  const f=fixture();let tree=f.request();assert.match(copy(tree),/Drafting/);assert.equal(label(tree,'Message').props.editable,true);
  label(tree,'Message').props.onChangeText('New owner composition');nodes(tree).find(node=>node.type==='bubble').props.onQuote({id:'source',text:'Invented source'});
  f.response.resolve(draft());await settle();tree=f.render();assert.match(copy(tree),/Draft ready/);assert.equal(label(tree,'Message').props.value,'New owner composition');assert.ok(label(tree,'Remove quote'));
  assert.equal(nodes(tree).filter(node=>node.type==='spinner').length,0);assert.deepEqual(f.locates,[]);
  nodes(tree).find(node=>node.props?.testID==='turn-source').props.onLayout({nativeEvent:{layout:{y:234}}});
  nodes(tree).find(node=>node.type==='view' && node.props?.children?.type==='draft').props.onLayout({nativeEvent:{layout:{y:80}}});
  button(tree,'View draft').props.onPress();await settle();assert.deepEqual(f.locates,[314]);assert.equal(f.requests.length,1);
  assert.equal(label(f.render(),'Message').props.value,'New owner composition');f.h.unmount();
});
test('silence, handover and source invalidation explain the typed draft outcome',async()=>{
  for(const [extra,expected] of [[{action:{kind:'silence',reason:'No response needed'},state:'resolved'},/No reply suggested.*No response needed/],
    [{action:{kind:'handover',reason:'Owner must decide'},state:'needs_owner'},/Needs your input.*Owner must decide/],
    [{state:'stale'},/conversation changed.*outdated/]]){
    const f=fixture();f.request();f.response.resolve(draft(extra));await settle();assert.match(copy(f.render()),expected);f.h.unmount();
  }
  const f=fixture();f.request();f.app.snapshot={...f.app.snapshot,conversations:f.app.snapshot.conversations.map(c=>({...c,workflowVersion:2}))};
  f.response.resolve(draft());await settle();assert.match(copy(f.render()),/outdated/);f.h.unmount();
});
test('current explicit error is actionable, unknown timeout is unconfirmed with readonly refresh and no automatic duplicate request',async()=>{
  for(const explicit of [true,false]){
    const f=fixture();f.request();f.request();assert.equal(f.requests.length,1);
    f.response.reject(explicit?new f.api.ApiError('model_request_failed'):new f.api.UnconfirmedMutationError());await settle();const tree=f.render();
    assert.match(copy(tree),explicit?/model request failed.*Review/i:/outcome unconfirmed/);
    if(!explicit){
      button(tree,'Refresh draft status').props.onPress();await settle();assert.equal(f.requests.length,1);
      f.app.snapshot={...f.app.snapshot,drafts:[draft()]};const updated=f.render();button(updated,'View draft');assert.match(copy(updated),/earlier request outcome is still unconfirmed/);
    }
    assert.equal(nodes(tree).filter(node=>node.type==='spinner').length,0);f.h.unmount();
  }
});
test('late Draft result/error cannot repaint another chat or a new client, including leave-return',async()=>{
  for(const change of ['chat','client','leave-return'])for(const fail of [false,true]){
    const f=fixture();f.request();
    if(change==='client'){f.app.client={};f.render();}else{f.route('other');if(change==='leave-return')f.route('chat');}
    label(f.render(),'Message').props.onChangeText('Unfinished newer owner text');
    if(fail)f.response.reject(new Error('Old timeout'));else f.response.resolve(draft());await settle();
    const tree=f.render();assert.doesNotMatch(copy(tree),/Draft ready|outcome unconfirmed/);assert.equal(label(tree,'Message').props.value,'Unfinished newer owner text');f.h.unmount();
  }
});
test('perform/mutate release validated data before separate snapshot, and a read failure never replaces action feedback',async()=>{
  const f=providerFixture();await f.connect();const waiting=deferred();
  f.respond(async call=>call.path==='/v1/session'?json(descriptor(scope())):call.path==='/v1/model-consent'?json({consent:true}):waiting.promise);
  f.render().reportError('An earlier send is unknown. Do not resend.');
  const value=await f.render().perform('/v1/model-consent',require('zod').z.object({consent:require('zod').z.boolean()}),{consent:true});
  assert.equal(value.consent,true);assert.match(f.render().error,/earlier send is unknown/);
  waiting.resolve(json({error:'service_error'},503));await settle();assert.match(f.render().error,/earlier send is unknown/);
});
function pathToDraft(tree,id,path=[]){
  if(!tree || typeof tree!=='object')return null;
  if(Array.isArray(tree)){for(const child of tree){const found=pathToDraft(child,id,path);if(found)return found;}return null;}
  const next=[...path,{type:tree.type,key:tree.key,style:tree.props?.style}];
  if(tree.type==='draft' && tree.props.draft.id===id)return next;
  return pathToDraft(tree.props?.children,id,next);
}
function assertVisibleDraft(tree,id){const path=pathToDraft(tree,id);assert.ok(path,'Known draft is mounted before context resolves');
  for(const ancestor of path){assert.notEqual(ancestor.style?.opacity,0);assert.notEqual(ancestor.style?.display,'none');}
  return path.map(({type,key})=>type+':'+(key ?? '')).join('/');
}
test('cached-first specific draft paints before held history, stays visible after a context failure and keeps a stable keyed editor parent',async()=>{
  const f=fixture({cold:true,draftId:'draft-current',paging:true});f.app.snapshot.drafts=[draft()];let tree=f.render();
  const path=assertVisibleDraft(tree,'draft-current');assert.equal(nodes(tree).filter(node=>node.type==='draft').length,1);assert.equal(f.requests.length,0);
  assert.equal(nodes(tree).find(node=>node.type==='draft').props.sourceReady,false);
  label(tree,'Message').props.onChangeText('Unsent owner typing');f.reads.reject(new Error('Synthetic context unavailable'));await settle();tree=f.render();
  assert.equal(assertVisibleDraft(tree,'draft-current'),path);assert.match(copy(tree),/context unavailable|Original source unavailable/);assert.equal(label(tree,'Message').props.value,'Unsent owner typing');
  f.context({messages:[{id:'source',conversationId:'chat',text:'Genuine loaded source'}]});tree=f.render();
  assert.equal(assertVisibleDraft(tree,'draft-current'),path);assert.equal(nodes(tree).filter(node=>node.type==='draft').length,1);assert.equal(f.requests.length,0);f.h.unmount();
});
test('a selected cached draft is located before held context, then genuine source layout preserves its card location without duplicate identity',async()=>{
  const f=fixture({cold:true,paging:true,draftId:'draft-current'});f.app.snapshot.drafts=[draft()];let tree=f.render();const key=assertVisibleDraft(tree,'draft-current');
  nodes(tree).find(node=>node.props?.testID==='turn-source').props.onLayout({nativeEvent:{layout:{y:200,height:220}}});
  nodes(tree).find(node=>node.type==='view' && node.props?.children?.type==='draft').props.onLayout({nativeEvent:{layout:{y:40}}});
  assert.deepEqual(f.locates,[240]);assert.equal(f.requests.length,0);
  f.reads.resolve({messages:[{id:'source',conversationId:'chat',text:'Genuine stored source'}]});await settle();tree=f.render();assert.equal(assertVisibleDraft(tree,'draft-current'),key);
  const turn=nodes(tree).find(node=>node.props?.testID==='turn-source');turn.props.onLayout({nativeEvent:{layout:{y:500,height:300}}});
  nodes(turn).find(node=>node!==turn && node.key==='source').props.onLayout({nativeEvent:{layout:{y:0,height:90}}});f.fireFrames();
  assert.equal(f.locates.at(-1),590);assert.equal(nodes(tree).filter(node=>node.type==='draft').length,1);f.h.unmount();
});

test('source arrival during draft editing preserves the same card/input and unsaved conflict text, without mutation warming',async()=>{
  const f=fixture({cold:true,paging:true,draftId:'draft-current'});f.app.snapshot.drafts=[draft()];const initial=f.render(),keyPath=assertVisibleDraft(initial,'draft-current');
  const h=lifecycleHooks(),calls=[];const component=load('components/draft-card.tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input'},
    '@replybot/core/contracts':contracts,'../lib/app-state':{useApp:()=>({...f.app,mutate:async(...args)=>{calls.push(args);throw new f.api.ApiError('stale_draft');}})},
    '../lib/api':f.api,'../lib/theme':{fonts:{}},'./ui':{Button:'button'},'./outgoing-status':{OutboxStatus:'outbox'}},{setTimeout,clearTimeout});
  let card=nodes(initial).find(node=>node.type==='draft');const render=()=>h.commit(()=>component.DraftCard(card.props));
  button(render(),'Edit').props.onPress();label(render(),'Edit draft').props.onChangeText('Unsaved phone edit');
  f.reads.resolve({messages:[{id:'source',conversationId:'chat',text:'Real source, not the draft body'}]});await settle();const arrived=f.render();
  assert.equal(assertVisibleDraft(arrived,'draft-current'),keyPath);card=nodes(arrived).find(node=>node.type==='draft');assert.equal(label(render(),'Edit draft').props.value,'Unsaved phone edit');assert.equal(calls.length,0);
  f.app.snapshot.drafts=[draft({revision:2,action:{kind:'text',text:'New PC revision',reason:'Synthetic'}})];card=nodes(f.render()).find(node=>node.type==='draft');
  assert.equal(label(render(),'Edit draft').props.value,'Unsaved phone edit');assert.match(copy(render()),/changed on another client/);
  button(render(),'Save draft').props.onPress();await settle();assert.equal(calls[0][2].revision,1);assert.equal(label(render(),'Edit draft').props.value,'Unsaved phone edit');assert.match(copy(render()),/outdated/);
  h.unmount();f.h.unmount();
});
test('warm cached history and draft remain painted during forced refresh, and exact visible IDs never acknowledge unseen newer history',async()=>{
  const f=fixture({paging:true,scrolling:{visibleIds:['old-2','old-3']}});const messages=Array.from({length:120},(_,n)=>({id:'old-'+n,conversationId:'chat',direction:'inbound',text:'Stored '+n}));
  f.app.snapshot.drafts=[draft({triggerMessageId:'old-1'})];let tree=f.context({messages});assertVisibleDraft(tree,'draft-current');assert.equal(nodes(tree).filter(node=>node.type==='bubble').length,120);f.fireVisible();assert.equal(f.viewedIds.length,0);
  f.reads.resolve({messages,hasNewer:true});await settle();f.render();f.fireVisible();await settle();assert.deepEqual(f.viewedIds,[['old-2','old-3']]);assert.ok(!f.viewedIds.flat().includes('newest-unseen'));
  f.scrolling.visibilityRevision++;f.scrolling.settled=false;f.render();f.fireVisible();assert.equal(f.viewedIds.length,1);
  f.scrolling.settled=true;f.scrolling.visibilityRevision++;f.render();nodes(f.render()).find(node=>node.type==='bubble').props.onOpenMedia({id:'old-2',conversationId:'chat',media:{kind:'image'}});f.render();f.fireVisible();assert.equal(f.viewedIds.length,1);
  f.background();f.fireVisible();assert.equal(f.viewedIds.length,1);f.h.unmount();
});
test('same-revision server lifecycle changes beat a local edit acknowledgment while older reads cannot erase the edit',async()=>{
  for(const [state,title] of [['stale','Outdated draft'],['dismissed','Dismissed'],['resolved','Resolved']]){
    const h=lifecycleHooks(),client={},api=apiFixture(()=>assert.fail('No network'));
    const edited=draft({revision:2,edited:true,action:{kind:'text',text:'Acknowledged local edit',reason:'Owner edit'}});
    const component=load('components/draft-card.tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input'},
      '@replybot/core/contracts':contracts,'../lib/app-state':{useApp:()=>({palette:{},status:'online',client,mutate:async()=>({draft:edited})})},
      '../lib/api':api,'../lib/theme':{fonts:{}},'./ui':{Button:'button'},'./outgoing-status':{OutboxStatus:'outbox'}});
    let provided=draft();const render=()=>h.commit(()=>component.DraftCard({draft:provided}));
    button(render(),'Edit').props.onPress();label(render(),'Edit draft').props.onChangeText('Acknowledged local edit');
    button(render(),'Save draft').props.onPress();await settle();
    assert.match(copy(render()),/Acknowledged local edit/);
    provided={...edited,state};const tree=render();assert.match(copy(tree),new RegExp(title));
    assert.equal(nodes(tree).some(node=>node.props?.label==='Send reply'),false);
    h.unmount();
  }
});

test('a read begun before a newer validated draft result cannot replace that result, including another client revision',async()=>{
  const f=providerFixture();await f.connect();const old=deferred(),fresh=deferred();let snapshots=0;
  const value=draft({conversationId:'same-jid'});
  f.respond(async call=>call.path==='/v1/session'?json(descriptor(scope())):call.path.endsWith('/decision')?json({draft:{...value,revision:3,action:{kind:'text',text:'Validated newer edit',reason:'Synthetic'}}}):++snapshots===1?old.promise:fresh.promise);
  const reading=f.render().refresh();await settle();const result=await f.render().mutate('/v1/drafts/draft-current/decision',f.api.DecisionResult,{operation:'edit',revision:2});
  assert.equal(result.draft.revision,3);old.resolve(json({...snapshot(scope()),drafts:[value]}));await reading;
  assert.equal(f.render().snapshot.drafts[0].revision,3);
  fresh.resolve(json({...snapshot(scope()),drafts:[{...value,revision:2}]}));await settle();assert.equal(f.render().snapshot.drafts[0].revision,3);
});
