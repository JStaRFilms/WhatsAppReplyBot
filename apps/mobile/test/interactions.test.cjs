const test=require('node:test');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
const {load,hooks,nodes,label,deferred}=require('./render-harness.cjs');
const native={Keyboard:{dismiss(){},addListener:()=>({remove(){}})},View:'view',Text:'text',Pressable:'pressable',TextInput:'input',ScrollView:'scroll',Modal:'modal',KeyboardAvoidingView:'keyboard',ActivityIndicator:'spinner'};
const icons={Mic:'mic',Send:'send',Square:'stop',Trash2:'delete',X:'close',Smile:'smile',SlidersHorizontal:'sliders',ChevronLeft:'back'};
const coreRequire=createRequire(path.resolve(__dirname,'../../../packages/core/package.json'));
const contracts=load('../../packages/core/src/contracts.ts',{'zod':require('zod'),'emoji-regex':coreRequire('emoji-regex')});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function voiceFixture(pickerResult) {
  const h=hooks();const acknowledgment=deferred(),errors=[];let starts=0,stops=0,picks=0,sends=0,clips=0,released=0,playbackStops=0;
  const recorder={recording:false,canRecord:true,seconds:1,start:async()=>{starts++;recorder.recording=true;},stop:async()=>{stops++;recorder.recording=false;}};
  const component=load('components/voice-composer.tsx',{'react':h.react,'react-native':native,'lucide-react-native':icons,
    'expo-document-picker':{getDocumentAsync:async()=>{picks++;return pickerResult ? pickerResult.promise : {assets:[{}]};}},'../lib/audio-clip':{clipFromAsset:()=>({release(){released++;}})},
    '../lib/audio-lane':{stopPlayback(){playbackStops++;}},'../lib/voice-recorder':{useVoiceRecorder:()=>recorder},
    '../lib/app-state':{useApp:()=>({palette:{},reportError:message=>errors.push(message)})},'./audio-playback':{AudioPlayback:'playback',audioTime:()=> '0:01'},'../lib/theme':{fonts:{}}});
  const props={ref:{current:null},children:null,clip:null,disabled:false,active:true,canSend:false,sending:false,beforePick:()=>acknowledgment.promise,onSend:()=>sends++,onClip:()=>clips++,onBusyChange(){}};
  return{props,h,recorder,acknowledgment,errors,render:()=>h.render(()=>component.VoiceComposer(props)),counts:()=>({starts,stops,picks,sends,clips,released,playbackStops})};
}
test('empty composer uses the Send slot for mic, text/photo/clip use Send, recording uses Stop and keeps local preview',async()=>{
  const f=voiceFixture();let tree=f.render();f.h.flush();
  assert.equal(nodes(tree).filter(n=>n.type==='pressable').length,1);
  label(tree,'Record voice note').props.onPress();await settle();assert.equal(f.counts().starts,0);
  f.acknowledgment.resolve();await settle();assert.equal(f.counts().starts,1);
  tree=f.render();label(tree,'Stop recording').props.onPress();await settle();assert.equal(f.counts().stops,1);
  for(const content of ['text','photo','clip']){
    f.props.canSend=true;f.props.clip=content==='clip'?{uri:'local'}:null;
    tree=f.render();label(tree,'Send message').props.onPress();
    assert.equal(nodes(tree).some(n=>n.type==='mic'),false);
  }
  assert.equal(f.counts().sends,3);assert.equal(f.counts().picks,0);
  assert.ok(nodes(tree).some(n=>n.type==='playback'));
  label(tree,'Delete voice note').props.onPress();assert.equal(f.counts().clips,1);
});
test('recording/picker startup synchronously stops the playback lane before waiting for its hold',()=>{
  for(const file of [false,true]){const f=voiceFixture();const tree=f.render();const cleanup=f.h.flush();
    if(file)f.props.ref.current.pickAudio();else label(tree,'Record voice note').props.onPress();
    assert.equal(f.counts().playbackStops,1);assert.equal(f.counts().starts,0);assert.equal(f.counts().picks,0);cleanup.forEach(fn=>fn());
  }
});
test('microphone preparation and startup errors are visible beside the composer; retry clears error and never sends',async()=>{
  const f=voiceFixture();let tree=f.render();f.h.flush();const start=f.recorder.start;
  f.recorder.start=async()=>{throw new Error('Synthetic microphone busy');};
  label(tree,'Record voice note').props.onPress();tree=f.render();
  assert.ok(nodes(tree).some(n=>n.props?.children==='Preparing voice note…'));
  f.acknowledgment.resolve();await settle();tree=f.render();
  assert.ok(nodes(tree).some(n=>n.props?.accessibilityRole==='alert' && n.props.children==='Synthetic microphone busy'));
  assert.deepEqual(f.errors,['Synthetic microphone busy']);assert.equal(f.counts().sends,0);
  f.recorder.start=start;label(tree,'Record voice note').props.onPress();await settle();tree=f.render();
  assert.equal(nodes(tree).some(n=>n.props?.children==='Synthetic microphone busy'),false);
  assert.equal(f.counts().starts,1);assert.equal(f.counts().sends,0);
});

test('audio file import is held until acknowledgment and cancels before opening a picker on unmount',async()=>{
  const f=voiceFixture();f.render();const cleanup=f.h.flush();
  f.props.ref.current.pickAudio();await settle();assert.equal(f.counts().picks,0);
  cleanup.forEach(fn=>fn());f.acknowledgment.resolve();await settle();assert.equal(f.counts().picks,0);
  const g=voiceFixture();g.render();g.h.flush();g.props.ref.current.pickAudio();g.acknowledgment.resolve();await settle();
  assert.equal(g.counts().picks,1);assert.equal(g.counts().clips,1);assert.equal(g.counts().starts,0);assert.equal(g.counts().sends,0);
});
test('inactive composer invalidates pending microphone and audio picker holds even if it becomes active again',async()=>{
  for(const file of [false,true]){
    const f=voiceFixture();const tree=f.render();f.h.flush();
    if(file)f.props.ref.current.pickAudio();else label(tree,'Record voice note').props.onPress();
    f.props.active=false;f.render();f.h.flush();f.props.active=true;f.render();f.h.flush();
    f.acknowledgment.resolve();await settle();assert.equal(f.counts().starts,0);assert.equal(f.counts().picks,0);
    assert.ok(nodes(f.render()).some(n=>typeof n.props?.children==='string' && n.props.children.includes('setup was cancelled')));
  }
});
test('inactive composer releases a late audio picker result instead of accepting the clip',async()=>{
  const picker=deferred();const f=voiceFixture(picker);f.render();f.h.flush();f.props.ref.current.pickAudio();
  f.acknowledgment.resolve();await settle();assert.equal(f.counts().picks,1);
  f.props.active=false;f.render();f.h.flush();picker.resolve({assets:[{}]});await settle();
  assert.equal(f.counts().clips,0);assert.equal(f.counts().released,1);
});
test('recorder startup carries the composer guard across native permission/preparation and web permission',async()=>{
  for(const phase of ['permission','prepare']){
    const h=hooks(),pending=deferred();let active=true,starts=0,deleted=0,stops=0;
    const recorder={uri:'file:///synthetic.m4a',prepareToRecordAsync:()=>phase==='prepare' ? pending.promise : Promise.resolve(),record:()=>starts++,stop:async()=>stops++};
    const nativeHook=load('lib/voice-recorder.ts',{'react':h.react,'expo-audio':{RecordingPresets:{HIGH_QUALITY:{}},useAudioRecorder:()=>recorder,
      getRecordingPermissionsAsync:async()=>({granted:false}),requestRecordingPermissionsAsync:()=>phase==='permission' ? pending.promise : Promise.resolve({granted:true}),setAudioModeAsync:async()=>{}},
      'expo-file-system':{File:class{exists=true;delete(){deleted++;}}},'./audio-clip':{},'./foreground':{useForeground:()=>true,isForeground:()=>true}});
    const voice=nativeHook.useVoiceRecorder(()=>assert.fail('No stale clip'),()=>assert.fail('No stale error'));
    const started=voice.start(()=>active);const rejected=assert.rejects(started,/chat|cancelled/);await settle();active=false;
    pending.resolve({granted:true});await rejected;assert.equal(starts,0);assert.equal(deleted,phase==='prepare'?1:0);assert.equal(stops,phase==='prepare'?1:0);
  }
  const h=hooks(),permission=deferred();let active=true,tracks=0;
  const hook=load('lib/voice-recorder.web.ts',{'react':h.react,'./audio-clip.web':{},'./foreground':{useForeground:()=>true,isForeground:()=>true}},
    {window:{isSecureContext:true},navigator:{mediaDevices:{getUserMedia:()=>permission.promise}},MediaRecorder:function(){assert.fail('No stale recorder');}});
  const voice=hook.useVoiceRecorder(()=>assert.fail('No stale clip'),()=>{});const started=voice.start(()=>active);
  const rejected=assert.rejects(started,/cancelled/);active=false;permission.resolve({getTracks:()=>[{stop:()=>tracks++}]});await rejected;assert.equal(tracks,1);
});
test('photo permission follows the acknowledged hold; leaving during permission never opens the picker',async()=>{
  const h=hooks(),ack=deferred(),permission=deferred();let permissions=0,pickers=0,clips=0;
  const component=load('components/attachment-picker.tsx',{'react':h.react,'react-native':{...native,Alert:{alert(){assert.fail('No stale alert');}}},'lucide-react-native':{},
    'expo-image-picker':{requestMediaLibraryPermissionsAsync:()=>{permissions++;return permission.promise;},launchImageLibraryAsync:async()=>{pickers++;}},
    '../lib/app-state':{useApp:()=>({palette:{}})},'../lib/theme':{fonts:{}}});
  const props={disabled:false,audioDisabled:false,onPick:()=>clips++,onPickAudio(){},onBusyChange(){},beforePick:()=>ack.promise};
  const render=()=>h.render(()=>component.AttachmentPicker(props));label(render(),'Attach file').props.onPress();
  const cleanup=h.flush();label(render(),'Choose image from gallery').props.onPress();await settle();assert.equal(permissions,0);
  ack.resolve();await settle();assert.equal(permissions,1);cleanup.forEach(fn=>fn());permission.resolve({granted:true});await settle();
  assert.equal(pickers,0);assert.equal(clips,0);
});
function screenFixture(initialText='') {
  const h=hooks();const sends=[],frames=new Map();let serial=0;
  const animation={requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:key=>frames.delete(key)};
  const conversation={id:'chat',accountId:'account',kind:'direct',mode:'draft_only',control:'assistant_allowed',name:'Synthetic'};
  const message={id:'message',text:'Synthetic',conversationId:'chat'};
  const history={subscribe(){},get:()=>({messages:[message]}),load:async()=>{}};
  const app={snapshot:{conversations:[conversation],lastMessages:[],historyVersions:{},drafts:[]},palette:{},history,status:'online',reportError:message=>sends.push({error:message}),composer:async()=>{},viewed:async()=>{},client:{},perform:async(_path,_schema,payload)=>{sends.push(payload.action);}};
  app.intents={subscribe(){},get:()=>[],enqueue:async(capture,clear)=>{sends.push(capture.action ?? {kind:'text',text:capture.text});clear();}};
  const scrolling=load('lib/conversation-scroll.ts',{'react':h.react,'react-native':native},{WeakMap,Map,...animation});
  const component=load('app/conversation/[id].tsx',{'react':h.react,'react-native':native,'expo-router':{Stack:{Screen:'stack'},useLocalSearchParams:()=>({id:'chat'}),useFocusEffect(){},useRouter:()=>({})},'lucide-react-native':icons,
    '../../lib/uuid':{randomUUID:()=> 'synthetic-request'},'@replybot/core/contracts':contracts,'expo-image':{Image:'image'},
    '../../components/media-viewer':{MediaViewer:'viewer'},'../../components/voice-composer':{VoiceComposer:'voice'},'../../components/attachment-picker':{AttachmentPicker:'attachments'},
    '../../components/avatar':{Avatar:'avatar'},'../../components/ui':{Page:'page',Button:'button'},'../../components/chat-badge':{ChatBadge:'badge'},'../../components/message-bubble':{MessageBubble:'bubble'},
    '../../components/draft-card':{DraftCard:'draft'},'../../components/pause-controls':{PauseControls:'pause'},'../../components/permission-sheet':{PermissionSheet:'permissions'},
    '../../lib/app-state':{useApp:()=>app},'../../lib/api':{ApiError:class extends Error{}},'../../lib/pending-intents':{intentVisible:()=>true},'../../lib/media-lease':{releaseImage(){},releaseMedia(){}},'../../components/outgoing-status':{OutboxStatus:'outbox-status'},'../../lib/local-drafts':{useLocalDraftIds:()=>[],useLocalDraft:()=>({text:initialText,setText(){},ready:true})},
    '../../lib/theme':{fonts:{}},'../../lib/conversation-scroll':scrolling,
    '../../lib/composer-focus':load('lib/composer-focus.ts',{react:h.react,'react-native':native,'./foreground':{isForeground:()=>true}},animation),'../../lib/foreground':{isForeground:()=>true,useForeground:()=>true}}, {WeakMap,Map,clearTimeout,...animation});
  return{render:()=>h.render(component.default),sends,message,app,h,frame:()=>{const next=[...frames.values()];frames.clear();next.forEach(fn=>fn());}};
}
test('history and recorder siblings have scoped unique keys and file import stays in attachments',()=>{
  const f=screenFixture();const tree=f.render();const history=nodes(tree).find(n=>n.type==='scroll'),voice=nodes(tree).find(n=>n.type==='voice');
  assert.equal(history.key,'history:chat');assert.equal(voice.key,'voice:chat');assert.notEqual(history.key,voice.key);
  assert.equal(nodes(tree).filter(n=>n.type==='bubble').length,1);
  assert.equal(typeof nodes(tree).find(n=>n.type==='attachments').props.onPickAudio,'function');
});
test('accepted composer send jumps from older history to latest; reaction sends do not',async()=>{
  const f=screenFixture('Synthetic owner message');f.render();f.h.flush();
  let tree=f.render();const history=nodes(tree).find(n=>n.type==='scroll'),moves=[];
  history.props.ref.current={scrollTo:({y})=>moves.push(y)};
  const scrolled=y=>history.props.onScroll({nativeEvent:{contentOffset:{y},layoutMeasurement:{height:400},contentSize:{height:1000}}});
  history.props.onLayout({nativeEvent:{layout:{height:400}}});history.props.onContentSizeChange(320,1000);f.frame();scrolled(600);
  history.props.onScrollBeginDrag();scrolled(100);assert.ok(label(f.render(),'Jump to latest message'));
  f.app.perform=async()=>({outbox:{state:'accepted'}});
  nodes(f.render()).find(n=>n.type==='voice').props.onSend();await settle();f.frame();assert.equal(moves.at(-1),600);
  scrolled(600);history.props.onScrollBeginDrag();scrolled(100);const before=moves.length;
  nodes(f.render()).find(n=>n.type==='bubble').props.onSelect(f.message);label(f.render(),'React 🔥').props.onPress();await settle();f.frame();
  assert.equal(moves.length,before);assert.ok(label(f.render(),'Jump to latest message'));
});

test('fire and the full picker react using the shared single Unicode emoji contract',async()=>{
  const f=screenFixture();
  function select(){nodes(f.render()).find(n=>n.type==='bubble').props.onSelect(f.message);return f.render();}
  label(select(),'React 🔥').props.onPress();await settle();assert.equal(f.sends.at(-1).reaction.emoji,'🔥');
  for(const emoji of ['👨‍👩‍👧‍👦','🇬🇧','👍🏽']){
    nodes(select()).find(n=>n.props?.label==='More emoji').props.onPress();
    let tree=f.render();assert.ok(label(tree,'React 😎'));
    label(tree,'Another reaction emoji').props.onChangeText(emoji);
    nodes(f.render()).find(n=>n.props?.label==='React').props.onPress();await settle();assert.equal(f.sends.at(-1).reaction.emoji,emoji);
  }
  nodes(select()).find(n=>n.props?.label==='More emoji').props.onPress();label(f.render(),'Another reaction emoji').props.onChangeText('hello');
  nodes(f.render()).find(n=>n.props?.label==='React').props.onPress();assert.equal(f.sends.at(-1).error,'Choose one emoji for a reaction.');
});
test('actor reactions group compactly, owner and AI share one slot, removals do not revive legacy reactions',()=>{
  const {groupMessageReactions}=load('lib/message-reactions.ts');
  const reaction=(actor,actorId,emoji,occurredAt)=>({actor,actorId,emoji,occurredAt,transportId:'transport',source:'live'});
  const message={accountId:'account',reaction:'❤️',observedReactions:[reaction('assistant','ai','❤️',1),reaction('contact','contact','🔥',3),reaction('owner','owner','🔥',2)]};
  let groups=groupMessageReactions(message);assert.equal(groups.length,1);assert.equal(groups[0].emoji,'🔥');assert.equal(groups[0].actors.length,2);
  message.observedReactions.push(reaction('owner','owner',null,4));groups=groupMessageReactions(message);assert.equal(groups[0].actors.length,1);assert.equal(groups[0].actors[0],'Contact');
  message.observedReactions.push(reaction('contact','contact',null,5));assert.equal(groupMessageReactions(message).length,0);
  message.observedReactions=[];assert.equal(groupMessageReactions(message).length,0);
  delete message.observedReactions;assert.equal(groupMessageReactions(message)[0].emoji,'❤️');
});
test('sequence preview stays ordered and editing explicitly flattens into one owner text action',async()=>{
  const h=hooks();let sent;
  const component=load('components/draft-card.tsx',{'react':h.react,'react-native':native,'@replybot/core/contracts':contracts,'../lib/app-state':{useApp:()=>({palette:{},status:'online',mutate:async(_path,_schema,payload)=>{sent=payload;return{};}})},'../lib/api':{DecisionResult:{}},'../lib/theme':{fonts:{}},'./outgoing-status':{OutboxStatus:'outbox-status'},'./ui':{Button:'button'}});
  const draft={id:'draft',revision:2,state:'pending',action:{kind:'text_sequence',messages:[{text:'First',quotedMessageId:'quoted'},{text:'Second'}],reason:'Synthetic'}};
  const render=()=>h.render(()=>component.DraftCard({draft}));let tree=render();
  const sequence=label(tree,'Ordered reply sequence');assert.equal(sequence.props.children[0].props.children[1].props.children,'First');assert.equal(sequence.props.children[1].props.children[1].props.children,'Second');
  nodes(tree).find(n=>n.props?.label==='Edit as one reply').props.onPress();tree=render();assert.equal(label(tree,'Edit draft').props.value,'First\n\nSecond');assert.equal(label(tree,'Edit draft').props.autoFocus,true);assert.equal(label(tree,'Edit draft').props.style.maxHeight,180);
  assert.ok(nodes(tree).some(n=>typeof n.props?.children==='string' && n.props.children.includes('Sequence quotes are removed')));
  nodes(tree).find(n=>n.props?.label==='Save draft').props.onPress();await settle();assert.equal(sent.action.kind,'text');assert.equal(sent.action.text,'First\n\nSecond');assert.equal(sent.action.quotedMessageId,undefined);
});
