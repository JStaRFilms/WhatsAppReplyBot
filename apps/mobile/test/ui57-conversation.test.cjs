const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,label,deferred}=require('./render-harness.cjs');
const {core,contracts,apiFixture,scope}=require('./profile-fixture.cjs');
const {pendingModule,memoryStorage,outbox}=require('./pending-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const api=apiFixture(()=>assert.fail('No external transport'));
const {groupMessageReactions}=load('lib/message-reactions.ts');
const message=(id='source',extra={})=>({id,accountId:scope().accountId,conversationId:'chat',transportId:'wa-'+id,direction:'inbound',authorship:'contact_written',source:'live',occurredAt:100,text:'Synthetic source',quotedMessageId:null,statusReply:false,statusContext:null,media:null,reaction:null,...extra});
function fixture(rows=[message()]){
  const activity={foreground:true,blur:undefined};
  const h=hooks(),read=deferred(),mutation=deferred(),calls=[],errors=[],storage=memoryStorage();let cached={messages:rows,hasNewer:false},serial=0;
  const client={baseUrl:'http://synthetic.invalid',scope:scope(),assertActive(){},request:async(path,schema,body)=>{calls.push({path,body});return schema.parse(await mutation.promise);}};
  const {PendingIntents,intentVisible}=pendingModule(api,storage),intents=new PendingIntents(client,scope(),1);
  const history={subscribe(){},get:()=>cached,load:()=>read.promise,latest:()=>{calls.push({path:'latest'});return read.promise;},newer:()=>{calls.push({path:'newer'});return read.promise;},cancelPageReads:()=>calls.push({path:'cancel'}),pin(){}};
  const scrolling={position:{following:false,offset:0,height:400,contentHeight:1000,editor:null},positioned:true,atBottom:false,showLatest:true,visibleIds:['source'],visibilityRevision:0,settled:true,
    scroll:{current:null},content:{current:null},editorSpace:0,latest:()=>{calls.push({path:'scroll-latest'});scrolling.position.following=true;},preserve:()=>calls.push({path:'preserve'}),restore:()=>calls.push({path:'restore'}),retainRows(){},hasCurrentGeometry:()=>true,isVisibilityCurrent:()=>true};
  const app={snapshot:{accountId:scope().accountId,conversations:[{id:'chat',accountId:scope().accountId,kind:'direct',mode:'draft_only',control:'manual',name:'Synthetic'}],lastMessages:[rows.at(-1)],historyVersions:{chat:1},drafts:[],outbox:[]},palette:{},history,intents,client,status:'online',discovery:{capabilities:{historyPaging:true}},composer:async()=>{},reportError:error=>errors.push(error),mediaCache:{setViewerOpen(){},revalidate:async()=>{}},clock:{now:()=>Date.now()}};
  const component=load('app/conversation/[id].tsx',{
    react:h.react,'react-native':{View:'view',Text:'text',Pressable:'pressable',TextInput:'input',ScrollView:'scroll',Modal:'modal',ActivityIndicator:'spinner'},
    'expo-router':{useLocalSearchParams:()=>({id:'chat'}),useFocusEffect:fn=>h.react.useEffect(()=>{const cleanup=fn();activity.blur=cleanup;return cleanup;},[]),useRouter:()=>({})},'lucide-react-native':{},'expo-image':{Image:'image'},
    '../../lib/uuid':{randomUUID:()=> 'composer-'+(++serial)},'@replybot/core/contracts':contracts,
    '../../components/voice-composer':{VoiceComposer:'voice'},'../../components/attachment-picker':{AttachmentPicker:'attachments'},'../../components/ui':{Page:'page',Button:'button'},
    '../../components/avatar':{Avatar:'avatar'},'../../components/chat-badge':{ChatBadge:'badge'},'../../components/media-viewer':{MediaViewer:'viewer'},'../../components/message-bubble':{MessageBubble:'bubble'},
    '../../components/draft-card':{DraftCard:'draft'},'../../components/pause-controls':{PauseControls:'pause'},'../../components/permission-sheet':{PermissionSheet:'permissions'},
    '../../lib/app-state':{useApp:()=>app},'../../lib/api':api,'../../lib/pending-intents':{intentVisible},'../../lib/media-lease':{releaseMedia(){},releaseImage(){}},
    '../../components/outgoing-status':{OutgoingStatus:'status',OutboxStatus:'outbox-status'},'../../lib/local-drafts':{useLocalDraftIds:()=>[],useLocalDraft:()=>({text:'',setText(){},ready:true})},
    '../../lib/theme':{fonts:{}},'../../lib/history-cache':{},'../../lib/conversation-scroll':{useConversationScroll:()=>scrolling},
    '../../lib/composer-focus':{useComposerFocus:()=>({input:{current:null},focus(){},clear(){}})},'../../lib/foreground':{isForeground:()=>activity.foreground,useForeground:()=>activity.foreground},
  },{setTimeout,clearTimeout,requestAnimationFrame:fn=>fn()});
  return{h,app,intents,storage,read,mutation,calls,errors,scrolling,activity,render:()=>h.render(component.default),cache:value=>{cached=value;}};
}
const outgoing=tree=>nodes(tree).filter(n=>n.props?.accessibilityLabel==='Pending outgoing message');
const bubble=tree=>nodes(tree).find(n=>n.type==='bubble');
const allText=tree=>nodes(tree).filter(n=>n.type==='text').map(n=>n.props.children).filter(v=>typeof v==='string');
test('ui61 actual voice caller distinguishes route blur even while a picker has backgrounded the app',()=>{
  const f=fixture();f.render();f.h.flush();f.activity.foreground=false;
  let voice=nodes(f.render()).find(node=>node.type==='voice');assert.equal(voice.props.active,false);assert.equal(voice.props.inactiveReason,'background');
  f.activity.blur();voice=nodes(f.render()).find(node=>node.type==='voice');assert.equal(voice.props.active,false);assert.equal(voice.props.inactiveReason,'chat');
});
test('ui57 warm Latest scrolls before a held GET; repeat taps supersede old page work',async()=>{
  const f=fixture();label(f.render(),'Jump to latest message').props.onPress();
  assert.equal(f.calls.some(c=>c.path==='scroll-latest'),true,'Latest must not wait for GET');
  assert.ok(f.calls.findIndex(c=>c.path==='cancel')<f.calls.findIndex(c=>c.path==='latest'));
  label(f.render(),'Jump to latest message').props.onPress();f.read.resolve();await settle();
  assert.equal(f.errors.length,0);
});
test('ui57 near-end history requests one bounded newer page without a manual button',()=>{
  const f=fixture();f.cache({messages:[message()],hasNewer:true,afterCursor:'edge'});f.scrolling.atBottom=true;f.scrolling.settled=true;
  f.render();f.h.flush();f.render();f.h.flush();
  assert.equal(f.calls.filter(c=>c.path==='newer').length,1);
  assert.equal(nodes(f.render()).some(n=>n.props?.label==='Load newer'),false);
});
test('ui57 owner reaction appears on target while mutation is held, never in an outgoing bubble',async()=>{
  const f=fixture();bubble(f.render()).props.onSelect(message());label(f.render(),'React 🔥').props.onPress();
  assert.equal(groupMessageReactions(bubble(f.render()).props.message)[0]?.emoji,'🔥','feedback precedes journal/mutation completion');await settle();
  const tree=f.render(),target=bubble(tree).props.message;
  assert.equal(groupMessageReactions(target)[0]?.emoji,'🔥');assert.equal(outgoing(tree).length,0);
  assert.equal(f.calls.filter(c=>c.path.includes('manual-send')).length,1);
  assert.equal(f.calls.some(c=>c.path==='scroll-latest'),false);
  const row=f.intents.get()[0],box=outbox(row.requestId);box.action=row.action;box.components=[{...box.components[0],kind:'reaction',text:null,reaction:row.action.reaction}];
  f.mutation.resolve({outbox:box,simulated:false});await settle();
  assert.equal(groupMessageReactions(bubble(f.render()).props.message)[0]?.emoji,'🔥');
  f.cache({messages:[message('source',{reaction:'🔥',observedReactions:[{actor:'owner',actorId:'account',transportId:box.components[0].transportId,emoji:'🔥',occurredAt:Date.now(),source:'live'}]})]});
  assert.equal(groupMessageReactions(bubble(f.render()).props.message).length,1);assert.equal(outgoing(f.render()).length,0);
});
test('ui57 reaction failure rolls back overlay; unknown retains feedback without replay; scope cannot leak',async()=>{
  for(const unknown of [false,true]){
    const f=fixture();bubble(f.render()).props.onSelect(message());label(f.render(),'React ❤️').props.onPress();await settle();
    f.mutation.reject(unknown?new Error('Lost response'):new api.ApiError('rejected'));await settle();
    const tree=f.render();assert.equal(outgoing(tree).length,0);
    assert.equal(groupMessageReactions(bubble(tree).props.message).length,unknown?1:0);
    assert.ok(allText(tree).some(t=>unknown?/unconfirmed|uncertain/i.test(t):/not sent|rejected/i.test(t)));
    assert.equal(f.calls.filter(c=>c.path.includes('manual-send')).length,1);
    f.cache({messages:[message('source',{accountId:'different-account'})]});
    assert.equal(groupMessageReactions(bubble(f.render()).props.message).length,0);
  }
});
test('ui57 pending text and media each render once; exact accepted echo replaces only its component',async()=>{
  for(const kind of ['text','audio','image']){
    const f=fixture(),row={service:f.app.client.baseUrl,scope:scope(),epoch:1,conversationId:'chat',requestId:'pending-'+kind,uploadRequestId:'upload',order:1,revision:1,text:kind==='audio'?'':'Only once',quotedMessageId:null,mediaKind:kind==='text'?null:kind,action:null,phase:'sending',submitted:true};
    f.app.intents={subscribe(){},get:()=>[row]};let tree=f.render();
    assert.equal(outgoing(tree).length,1);assert.equal(nodes(tree).some(n=>n.type==='outbox-status'),false);
    assert.equal(allText(tree).filter(t=>t==='Sending').length,0);assert.equal(nodes(tree).filter(n=>n.type==='status').length,1);
    if(kind!=='text')assert.ok(nodes(tree).some(n=>n.props?.accessibilityLabel===(kind==='audio'?'Voice message':'Photo')));
    const box=outbox(row.requestId);box.components[0]={...box.components[0],kind,text:row.text};row.outbox=box;row.phase='accepted';
    tree=f.render();assert.equal(nodes(tree).filter(n=>n.type==='status').length,1);assert.equal(allText(tree).filter(t=>t==='Only once').length,kind==='audio'?0:1);
    f.cache({messages:[message(),message('echo',{direction:'outbound',transportId:box.components[0].transportId,media:kind==='text'?null:{kind},text:row.text})]});
    assert.equal(outgoing(f.render()).length,0);
  }
});
test('ui57 AI reaction belongs to its target; ordinary emoji text and target metadata stay visible',()=>{
  const f=fixture([message('source',{reaction:'👍'}),message('emoji',{text:'😂'})]);const box=outbox('ai');box.origin='assistant_auto';box.state='dispatching';box.components[0]={...box.components[0],kind:'reaction',reaction:{targetMessageId:'source',emoji:'🔥'},text:null,state:'dispatching'};f.app.snapshot.outbox=[box];
  const tree=f.render();assert.equal(groupMessageReactions(bubble(tree).props.message)[0]?.emoji,'🔥');
  assert.equal(nodes(tree).filter(n=>n.type==='bubble').length,2);assert.equal(nodes(tree).some(n=>n.type==='outbox-status'),false);
});
test('ui57 partial sequence echo removes only the exact outbound component, not equal text or inbound IDs',()=>{
  const f=fixture(),box=outbox('sequence','partial');box.components=[
    {...box.components[0],id:'sent-part',text:'First',state:'accepted',transportId:'first-wa'},
    {...box.components[0],id:'unknown-part',text:'Second',state:'unknown',transportId:null},
  ];f.app.snapshot.outbox=[box];f.cache({messages:[message(),message('echo',{direction:'outbound',transportId:'first-wa',text:'First'})]});
  let tree=f.render();assert.equal(allText(tree).filter(t=>t==='First').length,0);assert.equal(allText(tree).filter(t=>t==='Second').length,1);
  assert.ok(allText(tree).some(t=>/Do not resend/.test(t)));
  f.cache({messages:[message(),message('not-echo',{transportId:'first-wa',text:'First'})]});tree=f.render();assert.equal(allText(tree).filter(t=>t==='First').length,1);
  f.cache({messages:[message(),message('wrong-scope',{direction:'outbound',accountId:'different',transportId:'first-wa',text:'First'})]});
  assert.equal(allText(f.render()).filter(t=>t==='First').length,1);
});
test('ui57 reaction event identity does not hide ordinary emoji or target reaction metadata',()=>{
  const f=fixture(),box=outbox('reaction');box.components[0]={...box.components[0],kind:'reaction',reaction:{targetMessageId:'source',emoji:'🔥'},text:null};
  f.app.snapshot.outbox=[box];f.cache({messages:[message('source',{reaction:'❤️'}),message('emoji',{direction:'outbound',text:'🔥'}),message('event',{direction:'outbound',text:'🔥',transportId:box.components[0].transportId})]});
  assert.deepEqual(nodes(f.render()).filter(n=>n.type==='bubble').map(n=>n.props.message.id),['source','emoji']);
});
test('ui57 exact accepted reaction observations and later owner removals supersede overlays',()=>{
  const f=fixture(),box=outbox('reaction');box.components[0]={...box.components[0],kind:'reaction',reaction:{targetMessageId:'source',emoji:'🔥'},text:null};f.app.snapshot.outbox=[box];
  for(const observation of [
    {transportId:box.components[0].transportId,emoji:'🔥',occurredAt:2},
    {transportId:'native-later',emoji:null,occurredAt:3},
  ]){
    const target=message('source',{observedReactions:[{actor:'owner',actorId:'account',source:'live',...observation}]});f.cache({messages:[target]});
    assert.equal(bubble(f.render()).props.message,target);
    assert.equal(groupMessageReactions(target).length,observation.emoji?1:0);
  }
});
test('ui57 a newer waiting reaction cannot hide an earlier unknown, even if its source is not loaded',()=>{
  const f=fixture(),unknown=outbox('unconfirmed','unknown');unknown.components[0]={...unknown.components[0],kind:'reaction',reaction:{targetMessageId:'source',emoji:'❤️'},text:null};
  const waiting={...unknown,id:'waiting',requestId:'waiting',state:'queued',createdAt:2,components:[{...unknown.components[0],id:'waiting',state:'queued',reaction:{targetMessageId:'source',emoji:'🔥'},transportId:null}]};
  f.app.snapshot.outbox=[unknown,waiting];let tree=f.render();assert.ok(allText(tree).some(t=>/Reaction outcome unconfirmed/.test(t)));
  assert.equal(groupMessageReactions(bubble(tree).props.message)[0]?.emoji,'🔥');
  f.cache({messages:[message('other')]});tree=f.render();assert.ok(allText(tree).some(t=>/Reaction outcome unconfirmed/.test(t)));assert.equal(outgoing(tree).length,0);
});
test('ui57 reaction reconciliation needs the scoped target and account-actor observation, not an ordinary emoji echo',()=>{
  const {intentVisible}=pendingModule(api,memoryStorage()),box=outbox('reaction');box.components[0]={...box.components[0],kind:'reaction',reaction:{targetMessageId:'source',emoji:'🔥'},text:null};
  const row={outbox:box,phase:'accepted',scope:scope(),conversationId:'chat'};
  assert.equal(intentVisible(row,[message('emoji',{direction:'outbound',transportId:box.components[0].transportId,text:'🔥'})]),true);
  assert.equal(intentVisible(row,[message('source',{reaction:'🔥'})]),true);
  const observation={actor:'contact',actorId:'contact',transportId:box.components[0].transportId,emoji:'🔥',occurredAt:1,source:'live'};
  assert.equal(intentVisible(row,[message('source',{observedReactions:[observation]})]),true);
  observation.actor='owner';assert.equal(intentVisible(row,[message('source',{observedReactions:[observation]})]),false);
  assert.equal(intentVisible(row,[message('source',{accountId:'different',observedReactions:[observation]})]),true);
});
test('ui57 a failed replacement does not erase an earlier accepted reaction while its target refresh is held',()=>{
  const f=fixture(),accepted=outbox('first'),failed=outbox('second','failed');
  accepted.components[0]={...accepted.components[0],kind:'reaction',reaction:{targetMessageId:'source',emoji:'❤️'},text:null};
  failed.createdAt=2;failed.components[0]={...failed.components[0],kind:'reaction',reaction:{targetMessageId:'source',emoji:'🔥'},text:null};f.app.snapshot.outbox=[accepted,failed];
  const tree=f.render();assert.equal(groupMessageReactions(bubble(tree).props.message)[0]?.emoji,'❤️');assert.ok(allText(tree).some(t=>t==='Reaction not sent.'));
});
test('ui57 unrelated history reads do not freeze composition/send, while real connection blockers remain visible',()=>{
  const f=fixture();f.render();f.h.flush();let tree=f.render();
  assert.equal(nodes(tree).find(n=>n.type==='voice').props.disabled,false);assert.equal(label(tree,'Message').props.editable,true);
  f.app.status='connecting';tree=f.render();assert.equal(nodes(tree).find(n=>n.type==='voice').props.disabled,true);
  assert.ok(allText(tree).some(t=>/active account to be confirmed/.test(t)));
  f.app.status='offline';tree=f.render();assert.ok(allText(tree).some(t=>/Connect to the service to send/.test(t)));
  f.app.status='online';assert.equal(nodes(f.render()).find(n=>n.type==='voice').props.disabled,false);
});
