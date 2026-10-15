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
function fixture(){
  const h=lifecycleHooks(),response=deferred(),reads=deferred(),requests=[],locates=[];let id='chat',serial=0,text='',foreground=true;
  const api=apiFixture(()=>assert.fail('No network'));
  const conversation={...snapshot(scope()).conversations[0],id:'chat',control:'assistant_allowed',workflowVersion:1};
  const app={snapshot:{...snapshot(scope()),historyVersions:{},conversations:[conversation,{...conversation,id:'other'}]},palette:{},status:'online',client:{},
    intents:{subscribe(){},get:()=>[]},history:{subscribe(){},get:()=>({messages:[{id:'source',text:'Invented source',conversationId:id}]}),load:()=>reads.promise},
    composer:async()=>{},viewed:async()=>{},reportError:()=>assert.fail('Draft feedback must not clear or replace unrelated domain/unknown warnings'),refresh:async()=>{},
    mutate:async(path,schema,payload)=>{requests.push({path,payload});return schema.parse(await response.promise);}};
  const component=load('app/conversation/[id].tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input',Pressable:'pressable',ScrollView:'scroll',Modal:'modal',ActivityIndicator:'spinner'},
    'expo-router':{useLocalSearchParams:()=>({id}),useRouter:()=>({}),useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'lucide-react-native':{},'expo-image':{Image:'image'},
    '@replybot/core/contracts':contracts,'../../lib/uuid':{randomUUID:()=> 'draft-request-'+(++serial)},'../../lib/app-state':{useApp:()=>app},
    '../../lib/api':api,'../../lib/pending-intents':{intentVisible:()=>true},'../../lib/media-lease':{},
    '../../lib/local-drafts':{useLocalDraft:()=>({text,setText:value=>{text=value;},ready:true})},'../../lib/theme':{fonts:{}},
    '../../lib/foreground':{isForeground:()=>foreground,useForeground:()=>foreground},
    '../../lib/composer-focus':{useComposerFocus:()=>h.react.useMemo(()=>({input:{current:null},focus(){},clear(){},onFocus(){},onBlur(){}}),[])},
    '../../lib/conversation-scroll':{useConversationScroll:()=>({scroll:{current:null},position:{},locate:value=>locates.push(value),latest(){}})},
    ...Object.fromEntries(['voice-composer','attachment-picker','avatar','ui','chat-badge','message-bubble','draft-card','pause-controls','permission-sheet','outgoing-status'].map(name=>['../../components/'+name,{
      VoiceComposer:'voice',AttachmentPicker:'attachment',Avatar:'avatar',Page:'page',Button:'button',ChatBadge:'badge',MessageBubble:'bubble',DraftCard:'draft',PauseControls:'pause',PermissionSheet:'permissions',OutboxStatus:'outbox'}])),
  },{Map,clearTimeout,setTimeout:()=>1});
  const render=()=>h.commit(component.default);
  const request=()=>{const node=nodes(render()).find(node=>node.type==='pressable' && nodes(node).some(child=>child.type==='text' && ['Draft reply','Drafting…'].includes(child.props.children)));node.props.onPress();return render();};
  return{h,app,response,reads,requests,locates,render,request,api,route:next=>{id=next;return render();}};
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
