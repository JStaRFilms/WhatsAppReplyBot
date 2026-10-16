const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');

function screenFixture(){
  const h=lifecycleHooks(),frames=new Map(),timers=new Map(),reads=[],viewed=[],moves=[],attached=new Map();let serial=0,offset=4496,foreground=true,chat='chat',viewportY=134,contentHeight=6000;
  const positions=new Map([['photo',2087],['old-coordinate',4496],['outbound',4780]]);
  const messages=[...positions.keys()].map(id=>({id,conversationId:'chat',direction:id==='outbound'?'outbound':'inbound',text:'Synthetic '+id,
    media:id==='photo'?{kind:'image',access:'available',viewOnce:false,expiresAt:null}:null}));
  let cached={messages,sourceEpoch:1,revision:1};
  const animation={requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:(fn,delay)=>{timers.set(++serial,{fn,delay});return serial;},clearTimeout:key=>timers.delete(key)};
  const scrolling=load('lib/conversation-scroll.ts',{react:h.react,'react-native':{UIManager:{measureInWindow:(_target,callback)=>reads.push(()=>callback(0,134+positions.get('photo')+245-offset,390,54))}}},animation);
  const draft={id:'draft',conversationId:'chat',triggerMessageId:'photo',workflowVersion:1,revision:1,state:'pending',action:{kind:'text',text:'Keep this edit'}};
  const history={subscribe(){},get:()=>cached,load:async()=>cached,pin(){},anchor:()=>undefined};
  const app={snapshot:{accountId:'synthetic',outbox:[],conversations:[{id:'chat',kind:'direct',control:'assistant_allowed',mode:'draft_only',workflowVersion:1}],
    lastMessages:[],drafts:[draft],historyVersions:{chat:1}},history,status:'online',palette:{},client:{},discovery:{capabilities:{historyPaging:true}},
    intents:{subscribe(){},get:()=>[]},composer:async()=>{},viewedMessages:async(_id,ids)=>viewed.push([...ids]),mediaCache:{revalidate:async()=>{},setViewerOpen(){},invalidate(){}},
    reportError:()=>assert.fail('No network or domain operations')};
  const component=load('app/conversation/[id].tsx',{react:h.react,
    'react-native':{View:'view',Text:'text',TextInput:'input',Pressable:'pressable',ScrollView:'scroll'},
    'expo-router':{useLocalSearchParams:()=>({id:chat}),useRouter:()=>({}),useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'lucide-react-native':{},
    '@replybot/core/contracts':{},'expo-image':{Image:'image'},'../../lib/uuid':{randomUUID:()=> 'synthetic'},'../../lib/app-state':{useApp:()=>app},
    '../../lib/api':{},'../../lib/pending-intents':{intentVisible:()=>true},'../../lib/media-lease':{},'../../lib/theme':{fonts:{}},
    '../../lib/local-drafts':{useLocalDraftIds:()=>[],useLocalDraft:()=>({text:'Unsent composition',setText(){},ready:true})},
    '../../lib/foreground':{isForeground:()=>foreground,useForeground:()=>foreground},'../../lib/conversation-scroll':scrolling,
    '../../lib/composer-focus':{useComposerFocus:()=>h.react.useMemo(()=>({input:{current:null},clear(){},focus(){}}),[])},
    ...Object.fromEntries(['voice-composer','attachment-picker','avatar','ui','chat-badge','message-bubble','draft-card','pause-controls','permission-sheet','outgoing-status','media-viewer'].map(name=>['../../components/'+name,{
      VoiceComposer:'voice',AttachmentPicker:'attachment',Avatar:'avatar',Page:'page',Button:'button',ChatBadge:'badge',MessageBubble:'bubble',DraftCard:'draft',PauseControls:'pause',PermissionSheet:'permissions',OutboxStatus:'outbox',MediaViewer:'viewer'}])),
  },animation);
  const viewport={measureInWindow:callback=>reads.push(()=>callback(0,viewportY,390,609))};
  const content={measureInWindow:callback=>reads.push(()=>callback(0,134-offset,390,contentHeight))};
  const scroll={getNativeScrollRef:()=>viewport,scrollTo:({y})=>{moves.push(y);offset=y;},scrollResponderScrollNativeHandleToKeyboard(){}};
  const render=()=>{
    const tree=h.commit(component.default);label(tree,'Conversation history').props.ref.current=scroll;
    const contentView=nodes(tree).find(node=>node.props?.testID==='history-content');if(contentView)contentView.props.ref.current=content;
    for(const turn of nodes(tree).filter(node=>node.props?.testID?.startsWith('turn-'))){
      const id=turn.props.testID.slice(5),source=nodes(turn).find(node=>node.key==='source');
      for(const [kind,node] of [['turn',turn],['source',source]]){
        const ref=node.props.ref;if(!ref || attached.get(id+kind)===ref)continue;
        attached.set(id+kind,ref);ref({measureInWindow:callback=>reads.push(()=>callback(0,134+positions.get(id)-offset,390,kind==='turn' && id==='photo'?425:245))});
      }
    }
    return tree;
  };
  const scrolled=y=>{offset=y;label(render(),'Conversation history').props.onScroll({nativeEvent:{contentOffset:{y},layoutMeasurement:{height:609},contentSize:{height:6000}}});};
  const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  const complete=()=>{for(let n=0;n<10 && (frames.size || reads.length);n++){frame();const pending=reads.splice(0);pending.forEach(fn=>fn());render();}assert.equal(frames.size+reads.length,0);};
  const fireViewed=()=>{for(const [key,timer] of timers)if(timer.delay===600){timers.delete(key);timer.fn();}};
  return{h,render,complete,frame,scrolled,positions,timers,viewed,fireViewed,frames,moves,app,reads,viewportMove:()=>{viewportY+=10;},contentResize:()=>{contentHeight+=10;},physical:y=>{offset=y;},navigate:()=>{app.snapshot.conversations.push({...app.snapshot.conversations[0],id:'other'});chat='other';render();},
    background:()=>{foreground=false;render();},scope:()=>{app.client={};render();},
    replace:()=>{cached={...cached,sourceEpoch:cached.sourceEpoch+1,revision:cached.revision+1};return render();}};
}


async function readyScreen(){
 const f=screenFixture();let tree=f.render(),history=label(tree,'Conversation history');
 history.props.onLayout({nativeEvent:{layout:{height:609}}});history.props.onContentSizeChange(390,6000);
 f.frame();f.scrolled(5391);history=label(f.render(),'Conversation history');history.props.onScrollBeginDrag();f.scrolled(4496);history.props.onScrollEndDrag();
 await new Promise(resolve=>setImmediate(resolve));f.render();f.complete();f.render();
 assert.ok([...f.timers.values()].some(t=>t.delay===600));return f;
}

for(const movement of ['offset','source'])test('ui66 held-native-event '+movement+' cannot acknowledge old geometry; new IDs require another 600ms',async()=>{
 const f=await readyScreen();try{
  if(movement==='offset')f.physical(2087);
  else {f.positions.set('old-coordinate',2087);f.positions.set('photo',4496);}
  f.fireViewed();f.frame();f.reads.splice(0).forEach(fn=>fn());f.complete();assert.deepEqual(f.viewed,[]);
  assert.ok([...f.timers.values()].some(t=>t.delay===600),'restart settling, not immediate acknowledgment');
  f.fireViewed();f.complete();assert.deepEqual(f.viewed,[['photo']]);
  assert.equal([...f.timers.values()].filter(t=>t.delay===600).length,0);
 }finally{f.h.unmount();assert.equal(f.frames.size+f.timers.size,0);}
});
test('ui66 unchanged verification posts once without republishing visibility or restarting media/settle',async()=>{
 const f=await readyScreen();try{
  const before=nodes(f.render()).filter(n=>n.type==='bubble').map(n=>n.props.visible);
  f.fireViewed();f.frame();assert.ok(f.reads.length,'fresh physical read, not cached event state');
  assert.deepEqual(nodes(f.render()).filter(n=>n.type==='bubble').map(n=>n.props.visible),before);
  f.complete();assert.deepEqual(f.viewed,[['old-coordinate']]);
  for(let i=0;i<5;i++){f.render();f.complete();f.fireViewed();}
  assert.deepEqual(f.viewed,[['old-coordinate']]);assert.equal(f.frames.size+f.timers.size,0);
 }finally{f.h.unmount();}
});
for(const transition of ['background','scope','navigate','replace','dialog','dialog-cycle','page-without-render','offline','ref','viewport-ref','gesture','layout','unmount'])test('ui66 '+transition+' during fresh read rejects retained old callbacks',async()=>{
 const f=await readyScreen();try{
  f.fireViewed();f.frame();assert.ok(f.reads.length);
  f.reads.shift()();const old=f.reads.splice(0);
  if(transition==='dialog')nodes(f.render()).find(n=>n.type==='pause').props.onDialogVisibilityChange(true);
  else if(transition==='dialog-cycle'){
   const change=nodes(f.render()).find(n=>n.type==='pause').props.onDialogVisibilityChange;change(true);change(false);
  }else if(transition==='page-without-render'){const page=f.app.history.get();f.app.history.get=()=>({...page});}
  else if(transition==='offline'){f.app.status='offline';f.render();}
  else if(transition==='viewport-ref')label(f.render(),'Conversation history').props.ref.current=null;
  else if(transition==='ref'){
   const row=nodes(f.render()).find(n=>n.props?.testID==='turn-old-coordinate');nodes(row).find(n=>n.key==='source').props.ref(null);
  }else if(transition==='gesture')label(f.render(),'Conversation history').props.onScrollBeginDrag();
  else if(transition==='layout')label(f.render(),'Conversation history').props.onLayout({nativeEvent:{layout:{width:390,height:609}}});
  else if(transition==='unmount')f.h.unmount();
  else f[transition]();
  old.forEach(fn=>fn());if(transition!=='unmount')f.complete();
  assert.deepEqual(f.viewed,[]);
 }finally{f.h.unmount();assert.equal(f.frames.size+f.timers.size,0);}
});
test('ui66 dropped probe callbacks terminate within existing retries; late completion cannot post; later layout recovers',async()=>{
 const f=await readyScreen();try{
  f.fireViewed();f.frame();const old=f.reads.splice(0);
  for(let i=0;i<4;i++){
   const pending=[...f.timers.entries()].filter(([,t])=>t.delay===100);
   for(const [key,t]of pending){f.timers.delete(key);t.fn();}f.frame();f.reads.splice(0);
  }
  assert.equal(f.frames.size+f.timers.size,0);old.forEach(fn=>fn());f.complete();assert.deepEqual(f.viewed,[]);
  label(f.render(),'Conversation history').props.onLayout({nativeEvent:{layout:{width:390,height:609}}});
  f.complete();f.fireViewed();f.complete();assert.deepEqual(f.viewed,[['old-coordinate']]);
 }finally{f.h.unmount();}
});

for(const movement of ['viewportMove','contentResize'])test('ui66 physical '+movement+' without event restarts settling even for unchanged IDs',async()=>{
 const f=await readyScreen();try{
  f[movement]();f.fireViewed();f.frame();f.reads.splice(0).forEach(fn=>fn());f.complete();
  assert.deepEqual(f.viewed,[]);assert.ok([...f.timers.values()].some(t=>t.delay===600));
  f.fireViewed();f.complete();assert.deepEqual(f.viewed,[['old-coordinate']]);
 }finally{f.h.unmount();}
});
test('ui66 source reflow after first sample invalidates the mixed batch and recovers without a native event',async()=>{
 const f=await readyScreen();try{
  f.fireViewed();f.frame();
  for(let i=0;i<3;i++)f.reads.splice(0).forEach(fn=>fn());
  f.positions.set('old-coordinate',2087);f.positions.set('photo',4496);
  f.reads.splice(0).forEach(fn=>fn());f.reads.splice(0).forEach(fn=>fn());
  // The inconsistent first probe is discarded. Complete the bounded retry,
  // then the ordinary replacement read separately, without firing its timer.
  for(let i=0;i<6;i++){f.frame();f.reads.splice(0).forEach(fn=>fn());f.render();}
  f.complete();assert.deepEqual(f.viewed,[]);assert.ok([...f.timers.values()].some(t=>t.delay===600));
  f.fireViewed();f.complete();assert.deepEqual(f.viewed,[['photo']]);
 }finally{f.h.unmount();}
});

test('ui66 physical viewport movement during the closing source reads cannot use an earlier viewport sample',async()=>{
 const f=await readyScreen();try{
  f.fireViewed();f.frame();
  for(let i=0;i<4;i++)f.reads.splice(0).forEach(fn=>fn());
  f.viewportMove();
  for(let i=0;i<6;i++){f.frame();f.reads.splice(0).forEach(fn=>fn());f.render();}
  f.complete();assert.deepEqual(f.viewed,[]);assert.ok([...f.timers.values()].some(t=>t.delay===600));
  f.fireViewed();f.complete();assert.deepEqual(f.viewed,[['old-coordinate']]);
 }finally{f.h.unmount();}
});
