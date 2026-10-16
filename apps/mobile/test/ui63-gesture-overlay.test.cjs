const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');

function fixture(){
  const h=lifecycleHooks(),frames=new Map(),timers=new Map(),reads=[],moves=[],pins=[],layouts=[];
  let serial=0,page={},client={},id='chat',offset=4496,height=609,width=390,contentHeight=6000,cancelled=0,focused=null,padding=0;
  const content={measureInWindow:callback=>measure(()=>[0,134-offset,width,contentHeight+padding],callback)};
  const history={anchor:()=>undefined,pin:(_id,anchor)=>pins.push(anchor),get:()=>page};
  const module=load('lib/conversation-scroll.ts',{react:h.react,'react-native':{UIManager:{measureInWindow:(_target,callback)=>focused.measureInWindow(callback)}}},{

    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:key=>timers.delete(key),
  });
  const render=()=>{const value=h.commit(()=>module.useConversationScroll(history,id,true,()=>cancelled++,page,client));if(value.content)value.content.current=content;
    if(value.editorSpace!==undefined && padding!==value.editorSpace){padding=value.editorSpace;value.onContentSizeChange(width,contentHeight+padding);}return value;};
  const measure=(read,callback)=>reads.push(()=>callback(...read()));
  const viewport={measureInWindow:callback=>measure(()=>[0,134,width,height],callback)};
  const scroll={getNativeScrollRef:()=>viewport,scrollTo:({y})=>moves.push(y),scrollResponderScrollNativeHandleToKeyboard(){}};
  render().scroll.current=scroll;
  const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  const complete=()=>{for(let n=0;n<10 && (frames.size || reads.length);n++){frame();const pending=reads.splice(0);pending.forEach(fn=>fn());}assert.equal(frames.size+reads.length,0);};
  const scrolled=(y=offset)=>{offset=y;render().onScroll({nativeEvent:{contentOffset:{y:offset},layoutMeasurement:{width,height},contentSize:{height:contentHeight+padding}}});};
  const rows=new Map();
  const mount=(key,y,rowHeight=245)=>{
    const row={y,height:rowHeight};rows.set(key,row);
    const refs=render().rowRefs?.(key);
    row.refs=refs;
    refs?.turn(node(()=>[0,134+row.y-offset,390,row.height]));
    refs?.source(node(()=>[0,134+row.y-offset,390,row.height]));
    render().onRowLayout(key,y,rowHeight);
    return row;
  };
  function node(read){return{measureInWindow:callback=>measure(read,callback)};}
  const retain=(ids=[...rows.keys()])=>render().retainRows(ids,ids,value=>layouts.push(value));
  const reflow=()=>{page={};render();retain();};
  const initial=render();initial.onLayout({nativeEvent:{layout:{height}}});initial.onContentSizeChange(390,contentHeight);
  frame();scrolled(contentHeight-height);render().onScrollBeginDrag();scrolled(4496);render().onScrollEndDrag();
  return{h,render,frame,complete,scrolled,mount,retain,reflow,reads,frames,timers,moves,pins,layouts,rows,
    resize:next=>{height=next;render().onLayout({nativeEvent:{layout:{width,height}}});},
    physical:y=>{offset=y;},width:next=>{width=next;},
    focus:read=>{focused=node(read);render().editorFocus(42);},
    height:next=>{contentHeight=next;},
    chat:next=>{id=next;render();},
    profile:()=>{client={};render();},cancelled:()=>cancelled,
  };
}

function screenFixture(){
  const h=lifecycleHooks(),frames=new Map(),timers=new Map(),reads=[],viewed=[],moves=[],attached=new Map();let serial=0,offset=4496,foreground=true,chat='chat';
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
  const viewport={measureInWindow:callback=>reads.push(()=>callback(0,134,390,609))};
  const content={measureInWindow:callback=>reads.push(()=>callback(0,134-offset,390,6000))};
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
  return{h,render,complete,frame,scrolled,positions,timers,viewed,fireViewed,frames,moves,app,
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
for(const kind of ['reaction','permissions','pause'])test('ui63 '+kind+' opening cancels pending viewed synchronously and fences escaped callback',async()=>{
 const f=await readyScreen();try{
  const queued=[...f.timers.values()].find(t=>t.delay===600),tree=f.render();
  if(kind==='reaction')nodes(tree).find(n=>n.type==='bubble').props.onSelect({id:'photo'});
  if(kind==='permissions')label(tree.props.header,'Contact permissions').props.onPress();
  if(kind==='pause')nodes(tree).find(n=>n.type==='pause').props.onDialogVisibilityChange(true);
  assert.equal([...f.timers.values()].filter(t=>t.delay===600).length,0,'cancel before render/effect');
  queued.fn();assert.deepEqual(f.viewed,[],'escaped callback must check current dialog');
  f.render();f.complete();f.fireViewed();assert.deepEqual(f.viewed,[]);
  const open=f.render();
  if(kind==='reaction')nodes(open).find(n=>n.props?.label==='Cancel').props.onPress();
  if(kind==='permissions')nodes(open).find(n=>n.type==='permissions').props.onClose();
  if(kind==='pause')nodes(open).find(n=>n.type==='pause').props.onDialogVisibilityChange(false);
  f.render();assert.equal([...f.timers.values()].filter(t=>t.delay===600).length,0,'close requires new measured geometry');
  f.complete();f.render();assert.ok([...f.timers.values()].some(t=>t.delay===600));f.fireViewed();f.complete();assert.deepEqual(f.viewed,[['old-coordinate']]);
 }finally{f.h.unmount();}
});
test('ui63 escaped viewed callback cannot survive background or scope change; old dialog cleanup cannot unmask a new scope',async()=>{
 for(const transition of ['background','scope']){const f=await readyScreen();try{
  const queued=[...f.timers.values()].find(t=>t.delay===600);const old=nodes(f.render()).find(n=>n.type==='pause').props.onDialogVisibilityChange;
  f[transition]();queued.fn();assert.deepEqual(f.viewed,[]);
  if(transition==='scope'){
   const current=nodes(f.render()).find(n=>n.type==='pause').props.onDialogVisibilityChange;
   current(true);old(false);f.render();f.complete();f.fireViewed();assert.deepEqual(f.viewed,[]);
  }
 }finally{f.h.unmount();}}
});
test('ui63 blurred editor retains session spacing and geometry but never reveals keyboard; manual scroll wins',()=>{
 const f=fixture();try{
  f.mount('photo',4496);f.retain();f.complete();let editorY=4712;
  f.focus(()=>[0,134+editorY-f.render().position.offset,390,54]);f.complete();
  editorY+=558;f.height(5417);f.reflow();f.render().onContentSizeChange(390,5417);f.complete();f.scrolled(5054);f.complete();
  assert.equal(f.render().editorSpace,246);const anchor=f.render().position.editorAnchor;
  f.render().editorBlur(42);f.complete();assert.equal(f.render().editorSpace,246);assert.equal(f.render().position.editorAnchor.offset,anchor.offset);
  const moves=f.moves.length;f.render().onScrollBeginDrag();f.scrolled(4700);f.render().onScrollEndDrag();f.complete();assert.equal(f.render().position.offset,4700);assert.equal(f.moves.length,moves,'blurred editor must not request scroll restoration');
  f.render().editorFocus(43);f.render().editorFocus(null,42);assert.equal(f.render().position.editor,43,'old session cannot close current editor');
  f.render().editorBlur(42);assert.equal(f.render().position.editorFocused,true);
  f.render().editorFocus(null,43);assert.equal(f.render().editorSpace,0);
 }finally{f.h.unmount();}
});
test('ui63 DraftCard blur reports actual focus separately; unmount closes only its captured editor session',()=>{
 const h=lifecycleHooks(),events=[];const onEditorFocus=(...args)=>events.push(['focus',...args]),onEditorBlur=target=>events.push(['blur',target]);
 const component=load('components/draft-card.tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input'},'@replybot/core/contracts':{},'../lib/app-state':{useApp:()=>({client:'synthetic',palette:{},status:'online'})},'../lib/api':{},'../lib/theme':{fonts:{}},'./ui':{Button:'button'},'./outgoing-status':{OutboxStatus:'outbox'}});
 const draft={id:'draft',revision:2,state:'pending',action:{kind:'text',text:'Local text'}};
 const render=()=>h.commit(()=>component.DraftCard({draft,onEditorFocus,onEditorBlur}));
 nodes(render()).find(n=>n.props?.label==='Edit').props.onPress();const editor=label(render(),'Edit draft');editor.props.onFocus({nativeEvent:{target:42}});editor.props.onBlur();
 assert.deepEqual(events,[['focus',42],['blur',42]]);assert.ok(label(render(),'Edit draft'));h.unmount();assert.deepEqual(events.at(-1),['focus',null,42]);
});
test('ui63 PauseControls announces open before rendering, closes explicitly and cleans up on unmount without control mutation',()=>{
 const h=lifecycleHooks(),events=[];const component=load('components/pause-controls.tsx',{react:h.react,'react-native':{View:'view',Text:'text',Pressable:'pressable',Modal:'modal'},'lucide-react-native':{},'@replybot/core/contracts':{},'../lib/app-state':{useApp:()=>({palette:{},status:'online',control:()=>assert.fail('No control mutation')})},'../lib/theme':{fonts:{}},'./ui':{Button:'button'}});
 const conversation={id:'chat',kind:'direct',mode:'draft_only',control:'assistant_allowed'},onDialogVisibilityChange=open=>events.push(open);
 const render=()=>h.commit(()=>component.PauseControls({conversation,onDialogVisibilityChange}));
 label(render(),'Pause options').props.onPress();assert.equal(events.at(-1),true);
 nodes(render()).find(n=>n.props?.label==='Close').props.onPress();assert.equal(events.at(-1),false);
 label(render(),'Pause options').props.onPress();h.unmount();assert.equal(events.at(-1),false);
});
