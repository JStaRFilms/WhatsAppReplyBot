const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');

function fixture(){
  const h=lifecycleHooks(),frames=new Map(),timers=new Map(),reads=[],moves=[],pins=[],layouts=[];
  let serial=0,page={},client={},id='chat',offset=4496,height=609,contentHeight=6000,cancelled=0;
  const history={anchor:()=>undefined,pin:(_id,anchor)=>pins.push(anchor),get:()=>page};
  const module=load('lib/conversation-scroll.ts',{react:h.react},{
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:key=>timers.delete(key),
  });
  const render=()=>h.commit(()=>module.useConversationScroll(history,id,true,()=>cancelled++,page,client));
  const measure=(read,callback)=>reads.push(()=>callback(...read()));
  const viewport={measureInWindow:callback=>measure(()=>[0,134,390,height],callback)};
  const scroll={getNativeScrollRef:()=>viewport,scrollTo:({y})=>moves.push(y)};
  render().scroll.current=scroll;
  const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  const complete=()=>{for(let n=0;n<10 && (frames.size || reads.length);n++){frame();const pending=reads.splice(0);pending.forEach(fn=>fn());}assert.equal(frames.size+reads.length,0);};
  const scrolled=(y=offset)=>{offset=y;render().onScroll({nativeEvent:{contentOffset:{y:offset},layoutMeasurement:{height},contentSize:{height:contentHeight}}});};
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
    resize:next=>{height=next;render().onLayout({nativeEvent:{layout:{height}}});},
    profile:()=>{client={};render();},cancelled:()=>cancelled,
  };
}

test('unchanged-height keyed photo moves from stale 2087 to actual 4496 after page replacement without onLayout',()=>{
  const f=fixture(),photo=f.mount('photo',2087),old=f.mount('old-coordinate',4496);
  f.retain();f.complete();assert.deepEqual([...f.render().visibleIds],['old-coordinate']);
  photo.y=4496;old.y=2087;
  f.reflow();f.complete();
  assert.deepEqual([...f.render().visibleIds],['photo']);
  assert.equal(f.layouts.at(-1).get('photo').y,4496);
  assert.equal(f.layouts.at(-1).get('photo').height,245);
  f.h.unmount();
});

test('pending batches suspend visibility and viewed eligibility; old page, scroll and profile callbacks cannot publish',()=>{
  const f=fixture(),photo=f.mount('photo',4496);f.retain();f.complete();
  const ready=f.render();assert.equal(ready.isVisibilityCurrent(),true);
  photo.y=2087;f.reflow();assert.deepEqual([...f.render().visibleIds],[]);assert.equal(f.render().settled,false);
  assert.equal(ready.isVisibilityCurrent(),false);f.frame();f.reads.shift()();const oldPage=f.reads.splice(0);
  const oldHandlers=f.render();
  photo.y=4496;f.reflow();oldPage.forEach(fn=>fn());oldHandlers.onRowLayout('photo',0,245);
  oldHandlers.onScroll({nativeEvent:{contentOffset:{y:0},layoutMeasurement:{height:609},contentSize:{height:6000}}});
  assert.equal(f.render().position.offset,4496);assert.deepEqual([...f.render().visibleIds],[]);
  f.frame();f.reads.shift()();const oldScroll=f.reads.splice(0);f.scrolled(2087);oldScroll.forEach(fn=>fn());assert.deepEqual([...f.render().visibleIds],[]);
  f.complete();assert.deepEqual([...f.render().visibleIds],[]);
  const beforeScroll=f.render();f.scrolled(4496);assert.equal(beforeScroll.isVisibilityCurrent(),false);
  assert.deepEqual([...f.render().visibleIds],['photo']);
  f.resize(400);f.frame();f.reads.shift()();const oldProfile=f.reads.splice(0);f.profile();oldProfile.forEach(fn=>fn());f.complete();
  assert.deepEqual([...f.render().visibleIds],[]);assert.ok(f.cancelled()>0);f.h.unmount();
});

test('prepend and resize restore the actual measured ID/offset anchor without replacing refs or editor intent',()=>{
  const f=fixture(),photo=f.mount('photo',4496);f.retain();f.complete();
  const refs=photo.refs;assert.equal(f.pins.at(-1).id,'photo');assert.equal(f.pins.at(-1).offset,0);
  f.render().preserve();photo.y=4896;f.reflow();f.complete();assert.equal(f.moves.at(-1),4896);
  f.scrolled(4896);f.complete();assert.equal(f.render().settled,true);assert.equal(f.render().rowRefs('photo'),refs);
  f.resize(350);f.complete();assert.equal(f.moves.at(-1),4896);assert.equal(f.render().position.editor,null);
  photo.y=4996;f.render().refreshRows();f.complete();assert.equal(f.moves.at(-1),4996);f.scrolled(4996);
  assert.equal(f.render().settled,true);
  f.h.unmount();assert.equal(f.frames.size+f.timers.size,0);
});

test('dropped measurements and missing refs retry finitely, accept slow current callbacks and recover on later mount/layout',()=>{
  const f=fixture(),photo=f.mount('photo',4496);f.retain();f.frame();const slow=f.reads.splice(0);
  for(let n=0;n<4;n++){const pending=[...f.timers.values()];f.timers.clear();pending.forEach(fn=>fn());f.frame();f.reads.splice(0);}
  assert.equal(f.frames.size+f.timers.size,0);assert.equal(f.render().settled,false);
  slow.forEach(fn=>fn());f.complete();assert.deepEqual([...f.render().visibleIds],['photo']);
  f.resize(400);f.complete();assert.deepEqual([...f.render().visibleIds],['photo']);
  photo.refs.source(null);f.complete();assert.deepEqual([...f.render().visibleIds],[]);
  photo.refs.source({measureInWindow:callback=>callback(0,134,390,245)});f.complete();
  assert.deepEqual([...f.render().visibleIds],['photo']);f.h.unmount();
});

function screenFixture(){
  const h=lifecycleHooks(),frames=new Map(),timers=new Map(),reads=[],viewed=[],moves=[],attached=new Map();let serial=0,offset=4496;
  const positions=new Map([['photo',2087],['old-coordinate',4496],['outbound',4780]]);
  const messages=[...positions.keys()].map(id=>({id,conversationId:'chat',direction:id==='outbound'?'outbound':'inbound',text:'Synthetic '+id,
    media:id==='photo'?{kind:'image',access:'available',viewOnce:false,expiresAt:null}:null}));
  let cached={messages,sourceEpoch:1,revision:1};
  const animation={requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:(fn,delay)=>{timers.set(++serial,{fn,delay});return serial;},clearTimeout:key=>timers.delete(key)};
  const scrolling=load('lib/conversation-scroll.ts',{react:h.react},animation);
  const draft={id:'draft',conversationId:'chat',triggerMessageId:'photo',workflowVersion:1,revision:1,state:'pending',action:{kind:'text',text:'Keep this edit'}};
  const history={subscribe(){},get:()=>cached,load:async()=>cached,pin(){},anchor:()=>undefined};
  const app={snapshot:{accountId:'synthetic',outbox:[],conversations:[{id:'chat',kind:'direct',control:'assistant_allowed',mode:'draft_only',workflowVersion:1}],
    lastMessages:[],drafts:[draft],historyVersions:{chat:1}},history,status:'online',palette:{},client:{},discovery:{capabilities:{historyPaging:true}},
    intents:{subscribe(){},get:()=>[]},composer:async()=>{},viewedMessages:async(_id,ids)=>viewed.push([...ids]),mediaCache:{revalidate:async()=>{},setViewerOpen(){},invalidate(){}},
    reportError:()=>assert.fail('No network or domain operations')};
  const component=load('app/conversation/[id].tsx',{react:h.react,
    'react-native':{View:'view',Text:'text',TextInput:'input',Pressable:'pressable',ScrollView:'scroll'},
    'expo-router':{useLocalSearchParams:()=>({id:'chat'}),useRouter:()=>({}),useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'lucide-react-native':{},
    '@replybot/core/contracts':{},'expo-image':{Image:'image'},'../../lib/uuid':{randomUUID:()=> 'synthetic'},'../../lib/app-state':{useApp:()=>app},
    '../../lib/api':{},'../../lib/pending-intents':{intentVisible:()=>true},'../../lib/media-lease':{},'../../lib/theme':{fonts:{}},
    '../../lib/local-drafts':{useLocalDraftIds:()=>[],useLocalDraft:()=>({text:'Unsent composition',setText(){},ready:true})},
    '../../lib/foreground':{isForeground:()=>true,useForeground:()=>true},'../../lib/conversation-scroll':scrolling,
    '../../lib/composer-focus':{useComposerFocus:()=>h.react.useMemo(()=>({input:{current:null},clear(){},focus(){}}),[])},
    ...Object.fromEntries(['voice-composer','attachment-picker','avatar','ui','chat-badge','message-bubble','draft-card','pause-controls','permission-sheet','outgoing-status','media-viewer'].map(name=>['../../components/'+name,{
      VoiceComposer:'voice',AttachmentPicker:'attachment',Avatar:'avatar',Page:'page',Button:'button',ChatBadge:'badge',MessageBubble:'bubble',DraftCard:'draft',PauseControls:'pause',PermissionSheet:'permissions',OutboxStatus:'outbox',MediaViewer:'viewer'}])),
  },animation);
  const viewport={measureInWindow:callback=>reads.push(()=>callback(0,134,390,609))};
  const scroll={getNativeScrollRef:()=>viewport,scrollTo:({y})=>{moves.push(y);offset=y;},scrollResponderScrollNativeHandleToKeyboard(){}};
  const render=()=>{
    const tree=h.commit(component.default);label(tree,'Conversation history').props.ref.current=scroll;
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
  return{h,render,complete,frame,scrolled,positions,timers,viewed,fireViewed,frames,moves,
    replace:()=>{cached={...cached,sourceEpoch:cached.sourceEpoch+1,revision:cached.revision+1};return render();}};
}

test('actual conversation gates photo visibility and acknowledges only the measured inbound row after a coherent reflow, keeping input and draft identity',async()=>{
  const f=screenFixture();let tree=f.render(),history=label(tree,'Conversation history');
  history.props.onLayout({nativeEvent:{layout:{height:609}}});history.props.onContentSizeChange(390,6000);
  f.frame();f.scrolled(5391);history=label(f.render(),'Conversation history');history.props.onScrollBeginDrag();f.scrolled(4496);history.props.onScrollEndDrag();
  await new Promise(resolve=>setImmediate(resolve));f.render();f.complete();tree=f.render();
  const input=label(tree,'Message').props.ref,turnRef=nodes(tree).find(node=>node.props?.testID==='turn-photo').props.ref;
  assert.ok(nodes(tree).find(node=>node.key==='draft-draft'));
  assert.equal(nodes(tree).find(node=>node.type==='bubble' && node.props.message.id==='photo').props.visible,false);
  const oldTimer=[...f.timers.values()].find(timer=>timer.delay===600);assert.ok(oldTimer);
  f.positions.set('photo',4496);f.positions.set('old-coordinate',2087);tree=f.replace();
  assert.ok(nodes(tree).filter(node=>node.type==='bubble').every(node=>!node.props.visible));
  oldTimer.fn();f.fireViewed();assert.deepEqual(f.viewed,[]);assert.equal([...f.timers.values()].filter(timer=>timer.delay===600).length,0);
  f.frame();f.fireViewed();assert.deepEqual(f.viewed,[]);
  f.complete();tree=f.render();
  assert.deepEqual(nodes(tree).filter(node=>node.type==='bubble' && node.props.visible).map(node=>node.props.message.id),['photo','outbound']);
  f.fireViewed();assert.deepEqual(f.viewed,[['photo']]);
  assert.equal(label(tree,'Message').props.ref,input);assert.equal(label(tree,'Message').props.value,'Unsent composition');
  assert.equal(nodes(tree).find(node=>node.props?.testID==='turn-photo').props.ref,turnRef);
  assert.ok(nodes(tree).find(node=>node.key==='draft-draft'));
  nodes(tree).find(node=>node.type==='draft').props.onEditorFocus(42);f.complete();
  assert.equal(label(f.render(),'Message').props.ref,input);
  nodes(f.render()).find(node=>node.type==='bubble' && node.props.message.id==='photo').props.onQuoteSource('photo');
  f.positions.set('photo',4896);f.replace();f.complete();assert.equal(f.moves.at(-1),4896);f.scrolled(4896);
  assert.equal(label(f.render(),'Message').props.ref,input);f.h.unmount();assert.equal(f.frames.size+f.timers.size,0);
});
