const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {pendingModule,memoryStorage,scope,outbox,lease}=require('./pending-fixture.cjs');
const {apiFixture}=require('./profile-fixture.cjs');
const pendingApi=apiFixture(()=>assert.fail('No network'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const native={View:'view',Text:'text',Pressable:'pressable',TextInput:'input',ScrollView:'scroll',Modal:'modal',ActivityIndicator:'spinner'};

function voiceFixture({phase,permission={granted:true},requested={granted:true}}={}) {
  const h=lifecycleHooks(),pending=deferred(),hold=deferred();
  let foreground=true,released=false;const counts={checks:0,requests:0,prepares:0,starts:0,stops:0,deleted:0,clips:0,releasedClips:0,late:0};const errors=[],busy=[];
  const access=()=>{if(released){counts.late++;throw new Error('Released SharedObject');}};
  const recorder={get uri(){access();return 'file:///synthetic.m4a';},get currentTime(){access();return 1;},isRecording:false,
    prepareToRecordAsync:async()=>{access();counts.prepares++;if(phase==='prepare')await pending.promise;},
    record(){access();counts.starts++;recorder.isRecording=true;},stop:async()=>{access();counts.stops++;recorder.isRecording=false;}};
  const globals={setInterval:()=>1,clearInterval(){},setTimeout:()=>2,clearTimeout(){}};
  const hook=load('lib/voice-recorder.ts',{react:h.react,'expo-audio':{RecordingPresets:{HIGH_QUALITY:{}},
    useAudioRecorder:()=>{h.react.useEffect(()=>()=>{released=true;},[]);return recorder;},
    getRecordingPermissionsAsync:async()=>{counts.checks++;return phase==='check'?pending.promise:permission;},
    requestRecordingPermissionsAsync:async()=>{counts.requests++;return phase==='request'?pending.promise:requested;},
    setAudioModeAsync:async mode=>{if(mode.allowsRecording && phase==='mode')await pending.promise;}},
    'expo-file-system':{File:class{exists=true;delete(){counts.deleted++;}}},'./audio-clip':{clipFromUri:()=>({release(){counts.releasedClips++;}})},
    './foreground':{isForeground:()=>foreground,useForeground:()=>foreground}},globals);
  const component=load('components/voice-composer.tsx',{react:h.react,'react-native':native,'lucide-react-native':{},
    'expo-document-picker':{getDocumentAsync:()=>pending.promise},'../lib/audio-clip':{clipFromAsset:()=>({release(){counts.releasedClips++;}})},'../lib/audio-lane':{stopPlayback(){}},'../lib/voice-recorder':hook,
    '../lib/app-state':{useApp:()=>({palette:{},reportError:message=>errors.push(message)})},'./audio-playback':{AudioPlayback:'preview',audioTime:()=> '0:01'},'../lib/theme':{fonts:{}}});
  const props={ref:{current:null},children:null,canSend:false,sending:false,clip:null,disabled:false,active:true,scope:{},beforePick:()=>hold.promise,
    onClip:()=>counts.clips++,onBusyChange:value=>busy.push(value)};
  const render=()=>h.commit(()=>component.VoiceComposer(props));
  return {render,props,counts,errors,busy,pending,hold,h,
    background(){foreground=false;props.active=false;props.inactiveReason='background';return render();},
    foreground(){foreground=true;props.active=true;return render();},
  };
}

test('granted mic survives actual busy/hold/snapshot rerenders and uses no permission request',async()=>{
  const f=voiceFixture({phase:'prepare'});
  label(f.render(),'Record voice note').props.onPress();f.render();
  assert.deepEqual(f.busy,[false,true]);assert.equal(f.counts.checks,0);
  // Parent busy acknowledgment disables the action, not the active attempt.
  f.props.disabled=true;f.props.beforePick=()=>Promise.resolve();f.render();
  f.hold.resolve();await settle();f.render();assert.equal(f.counts.prepares,1);
  f.props.onBusyChange=value=>f.busy.push(value);f.render();
  f.pending.resolve();await settle();
  label(f.render(),'Stop recording');assert.equal(f.counts.starts,1);assert.equal(f.counts.requests,0);
  label(f.render(),'Stop recording').props.onPress();await settle();f.render();
  assert.equal(f.counts.clips,1);assert.equal(f.counts.stops,1);
  f.props.disabled=false;label(f.render(),'Record voice note').props.onPress();await settle();f.render();
  assert.equal(f.counts.starts,2);assert.equal(f.counts.requests,0);f.h.unmount();await settle();assert.equal(f.counts.late,0);
});

test('viewer exclusion reads synchronous preparation, recording, picker and stop guards before parent busy effects',async()=>{
  const f=voiceFixture({phase:'prepare'});let tree=f.render();const record=label(tree,'Record voice note').props.onPress;
  assert.equal(f.props.ref.current.setViewerBlocked(true),true);record();assert.equal(f.counts.checks,0);assert.equal(f.props.ref.current.isBusy(),false);
  f.props.ref.current.setViewerBlocked(false);record();assert.equal(f.props.ref.current.isBusy(),true);assert.equal(f.props.ref.current.setViewerBlocked(true),false);
  f.hold.resolve();await settle();assert.equal(f.props.ref.current.setViewerBlocked(true),false);f.pending.resolve();await settle();assert.equal(f.props.ref.current.isBusy(),true);
  tree=f.render();label(tree,'Stop recording').props.onPress();assert.equal(f.props.ref.current.isBusy(),true);assert.equal(f.props.ref.current.setViewerBlocked(true),false);
  await settle();f.render();assert.equal(f.props.ref.current.isBusy(),false);assert.equal(f.props.ref.current.setViewerBlocked(true),true);f.h.unmount();await settle();assert.equal(f.counts.late,0);
  const picker=voiceFixture();picker.render();picker.props.ref.current.pickAudio();assert.equal(picker.props.ref.current.setViewerBlocked(true),false);picker.hold.resolve();await settle();
  assert.equal(picker.props.ref.current.isBusy(),true);picker.pending.resolve({assets:[]});await settle();picker.render();assert.equal(picker.props.ref.current.isBusy(),false);picker.h.unmount();
});

test('permission check/request, audio setup and preparation invalidate through background/return without auto-resume',async()=>{
  for(const phase of ['check','request','mode','prepare']){
    const f=voiceFixture({phase,permission:phase==='request'?{granted:false}:undefined});
    label(f.render(),'Record voice note').props.onPress();f.hold.resolve();await settle();f.render();
    f.background();f.foreground();f.pending.resolve({granted:true});await settle();
    const tree=f.render();assert.equal(f.counts.starts,0,phase);
    const alert=nodes(tree).find(node=>node.props?.accessibilityRole==='alert');
    assert.match(alert.props.children,/foreground/);assert.match(alert.props.children,/permission|audio setup|microphone preparation/);
    assert.equal(f.counts.stops,phase==='prepare'?1:0);assert.equal(f.counts.deleted,phase==='prepare'?1:0);
    f.h.unmount();await settle();assert.equal(f.counts.late,0);
  }
});

test('recording stops on genuine background, route or profile change and never silently resumes',async()=>{
  for(const change of ['background','route','profile']){
    const f=voiceFixture();label(f.render(),'Record voice note').props.onPress();f.hold.resolve();await settle();label(f.render(),'Stop recording');
    if(change==='background')f.background();else{if(change==='route')f.props.active=false;else f.props.scope={};f.render();}
    await settle();if(change==='background')f.foreground();else{f.props.active=true;f.render();}
    assert.equal(f.counts.starts,1);assert.equal(f.counts.stops,1);assert.equal(f.counts.clips,0);assert.equal(f.counts.releasedClips,1);f.h.unmount();await settle();assert.equal(f.counts.late,0);
  }
});

test('local cancellation distinguishes hold, route and profile, with no stale native start',async()=>{
  for(const reason of ['chat','scope']){
    const f=voiceFixture();label(f.render(),'Record voice note').props.onPress();f.render();
    if(reason==='chat')f.props.active=false;else f.props.scope={};f.render();
    f.props.active=true;f.render();f.hold.resolve();await settle();
    const alert=nodes(f.render()).find(node=>node.props?.accessibilityRole==='alert');
    assert.match(alert.props.children,/composer hold/);assert.match(alert.props.children,reason==='chat'?/chat is no longer focused/:/profile changed/);
    assert.equal(f.counts.checks,0);assert.equal(f.counts.starts,0);f.h.unmount();
  }
});

test('denied microphone access reports the local permission state without preparing',async()=>{
  for(const blocked of [false,true]){
    const f=voiceFixture({permission:{granted:false,canAskAgain:!blocked},requested:{granted:false,canAskAgain:true}});
    label(f.render(),'Record voice note').props.onPress();f.hold.resolve();await settle();
    assert.match(nodes(f.render()).find(node=>node.props?.accessibilityRole==='alert').props.children,blocked?/phone settings/:/Allow microphone/);
    assert.equal(f.counts.requests,blocked?0:1);assert.equal(f.counts.prepares,0);f.h.unmount();
  }
});

test('real layout/passive teardown ordering prevents late SharedObject reads at every pending native stage',async()=>{
  for(const phase of ['check','request','mode','prepare']){
    const f=voiceFixture({phase,permission:phase==='request'?{granted:false}:undefined});
    label(f.render(),'Record voice note').props.onPress();f.hold.resolve();await settle();f.render();
    f.h.unmount();f.pending.resolve({granted:true});await settle();assert.equal(f.counts.starts,0);assert.equal(f.counts.late,0);assert.equal(f.counts.clips,0);
  }
});

function screenFixture(initialText='Original') {
  const h=lifecycleHooks(),listeners=new Map(),frames=new Map(),sendResult=deferred(),uploads=deferred();
  let serial=0,id='chat',routeFocused=true,foreground=true,text=initialText,focuses=0,blurs=0,dismisses=0,inputFocused=false;
  const messages=[{id:'message',conversationId:'chat',text:'Synthetic'}];
  const cached={messages};
  const history={subscribe(){},get:()=>cached,load:async()=>{}};
  const sends=[],holds=[];
  const app={snapshot:{accountId:scope().accountId,outbox:[],conversations:['chat','other'].map(id=>({id,kind:'direct',control:'assistant_allowed',mode:'draft_only'})),lastMessages:[],drafts:[],historyVersions:{}},
    status:'online',palette:{},history,client:{uploadImage:()=>uploads.promise,uploadAudio:()=>uploads.promise},reportError(){},
    composer:async(...args)=>{holds.push(args);},viewed:async()=>{},mutate:async(_path,_schema,payload)=>{sends.push(payload);return sendResult.promise;}};
  const newIntents=()=>{
    const client=app.client;
    client.baseUrl='http://synthetic.local';client.scope=scope();client.request=async(_path,_schema,payload)=>{
      sends.push(payload);const result=await sendResult.promise;
      return{simulated:false,outbox:{...outbox(payload.requestId,result.outbox.state),action:payload.action}};
    };
    return new (pendingModule(pendingApi,memoryStorage()).PendingIntents)(client,scope(),1);
  };
  app.intents=newIntents();
  const keyboard={dismiss(){dismisses++;},addListener:(event,fn)=>{listeners.set(event,fn);return{remove:()=>listeners.delete(event)};}};
  const rn={...native,Keyboard:keyboard};
  const animation={requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:key=>frames.delete(key)};
  const focus=load('lib/composer-focus.ts',{react:h.react,'react-native':rn,'./foreground':{isForeground:()=>foreground}},animation);
  const scrolling=load('lib/conversation-scroll.ts',{react:h.react,'react-native':rn},animation);
  const component=load('app/conversation/[id].tsx',{react:h.react,'react-native':rn,'expo-router':{Stack:{Screen:'stack'},useLocalSearchParams:()=>({id}),useRouter:()=>({}),
    useFocusEffect:callback=>h.react.useEffect(()=>routeFocused?callback():undefined,[callback,routeFocused])},'lucide-react-native':{},
    '../../lib/uuid':{randomUUID:()=> 'request-'+(++serial)},'@replybot/core/contracts':{Draft:{},OwnerAction:{}},'expo-image':{Image:'image'},
    '../../components/media-viewer':{MediaViewer:'viewer'},'../../components/voice-composer':{VoiceComposer:'voice'},'../../components/attachment-picker':{AttachmentPicker:'attachments'},
    '../../components/avatar':{Avatar:'avatar'},'../../components/ui':{Page:'page',Button:'button'},'../../components/chat-badge':{ChatBadge:'badge'},'../../components/message-bubble':{MessageBubble:'bubble'},
    '../../components/draft-card':{DraftCard:'draft'},'../../components/pause-controls':{PauseControls:'pause'},'../../components/permission-sheet':{PermissionSheet:'permissions'},
    '../../lib/app-state':{useApp:()=>app},'../../lib/api':pendingApi,'../../lib/pending-intents':pendingModule(pendingApi,memoryStorage()),'../../lib/media-lease':lease,'../../components/outgoing-status':{OutboxStatus:'outbox-status'},'../../lib/local-drafts':{useLocalDraftIds:()=>[],useLocalDraft:()=>({text,setText:value=>{text=value;},ready:true})},
    '../../lib/theme':{fonts:{}},'../../lib/conversation-scroll':scrolling,'../../lib/composer-focus':focus,
    '../../lib/foreground':{isForeground:()=>foreground,useForeground:()=>foreground}},
    {...animation,setTimeout:()=>1,clearTimeout(){}});
  let tree;
  const input={focus(){if(inputFocused)return;inputFocused=true;focuses++;label(tree,'Message').props.onFocus();},
    blur(){inputFocused=false;blurs++;label(tree,'Message').props.onBlur();}};
  const render=()=>{tree=h.commit(component.default);label(tree,'Message').props.ref.current=input;return tree;};
  const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  return {render,app,h,sends,sendResult,uploads,holds,frame,
    send:()=>nodes(render()).find(node=>node.type==='voice').props.onSend(),
    edit:value=>{label(render(),'Message').props.onChangeText(value);return render();},
    focus:()=>input.focus(),hide:()=>listeners.get('keyboardDidHide')(),counts:()=>({focuses,blurs,dismisses}),
    background:()=>{foreground=false;return render();},foreground:()=>{foreground=true;return render();},
    route:(value,nextId=id)=>{routeFocused=value;id=nextId;return render();},
    replaceClient:()=>{app.intents.stop();app.client={};app.intents=newIntents();app.history={...history};return render();},
  };
}

test('text send remains editable/focused, history never dismisses, quote explicitly focuses and accepted send preserves newer text/quote',async()=>{
  const f=screenFixture();let tree=f.render();assert.equal(f.counts().focuses,0);
  const history=label(tree,'Conversation history');assert.equal(history.props.keyboardDismissMode,'none');assert.equal(history.props.keyboardShouldPersistTaps,'always');
  f.focus();f.send();tree=f.render();assert.equal(label(tree,'Message').props.editable,true);
  const before=f.counts();f.send();await settle();assert.equal(f.sends.length,1);
  f.edit('Newer typing');nodes(f.render()).find(node=>node.type==='bubble').props.onQuote({id:'new-quote',text:'New quote'});f.render();
  assert.equal(f.counts().focuses,before.focuses);
  f.sendResult.resolve({outbox:{state:'accepted'}});await settle();tree=f.render();
  assert.equal(label(tree,'Message').props.value,'Newer typing');assert.ok(label(tree,'Remove quote'));
  assert.equal(f.counts().blurs,before.blurs);assert.equal(f.counts().dismisses,before.dismisses);f.h.unmount();
});

test('journaled text clears without blur; unknown retains the original intent and never repeats its mutation',async()=>{
  for(const state of ['accepted','unknown']){
    const f=screenFixture();f.render();f.focus();const before=f.counts();f.send();f.sendResult.resolve({outbox:{state}});await settle();
    assert.equal(label(f.render(),'Message').props.value,'');
    assert.equal(f.app.intents.get()[0].text,'Original');
    assert.deepEqual(f.counts(),before);
    if(state==='unknown'){const request=f.sends[0].requestId;f.send();await settle();assert.equal(f.sends.length,1);assert.equal(f.app.intents.get()[0].requestId,request);}
    f.h.unmount();
  }
});

test('edit revisions protect changed-back text and newly selected media from accepted cleanup',async()=>{
  for(const edit of ['text','media','leave-return']){
    const f=screenFixture();f.render();f.send();
    if(edit==='text'){f.edit('Temporary');f.edit('Original');}
    if(edit==='media'){nodes(f.render()).find(node=>node.type==='attachments').props.onPick({uri:'synthetic',base64:'synthetic'});f.render();}
    if(edit==='leave-return'){f.route(false,'other');f.route(true,'chat');}
    f.sendResult.resolve({outbox:{state:'accepted'}});await settle();const tree=f.render();assert.equal(label(tree,'Message').props.value,'Original');
    if(edit==='media')assert.ok(label(tree,'Selected image preview'));f.h.unmount();
  }
});

test('image upload captures caption/quote and edit revision at original gesture, not after upload',async()=>{
  const f=screenFixture('Original caption');let tree=f.render();
  nodes(tree).find(node=>node.type==='attachments').props.onPick({uri:'synthetic',base64:'synthetic'});
  nodes(f.render()).find(node=>node.type==='bubble').props.onQuote({id:'old-quote',text:'Old quote'});f.render();f.send();
  assert.equal(label(f.render(),'Message').props.editable,true);f.edit('Caption typed during upload');
  nodes(f.render()).find(node=>node.type==='bubble').props.onQuote({id:'new-quote',text:'New quote'});f.render();
  f.uploads.resolve({id:'11111111-1111-4111-8111-111111111111'});await settle();assert.equal(f.sends.length,1);assert.equal(f.sends[0].action.caption,'Original caption');assert.equal(f.sends[0].quotedMessageId,'old-quote');
  f.sendResult.resolve({outbox:{state:'accepted'}});await settle();tree=f.render();
  assert.equal(label(tree,'Message').props.value,'Caption typed during upload');assert.ok(label(tree,'Remove quote'));assert.ok(label(tree,'Selected image preview'));f.h.unmount();
});

test('accepted old chat/client completions cannot erase newer compose state, including leaving and returning to same chat',async()=>{
  for(const change of ['chat','client','leave-return']){
    const f=screenFixture();f.render();f.send();
    if(change==='client')f.replaceClient();else{f.route(false,'other');if(change==='leave-return')f.route(true,'chat');}
    f.edit('Unfinished next scope');f.sendResult.resolve({outbox:{state:'accepted'}});await settle();assert.equal(label(f.render(),'Message').props.value,'Unfinished next scope');f.h.unmount();
  }
});

test('foreground restores only unfinished intended same-chat typing, respecting manual hide, route and profile changes',()=>{
  for(const change of ['restore','manual-hide','blur','empty','route','client']){
    const f=screenFixture();f.render();f.focus();
    if(change==='manual-hide')f.hide();
    if(change==='blur')label(f.render(),'Message').props.onBlur();
    if(change==='empty')f.edit('');
    f.background();f.hide();
    if(change==='route')f.route(false,'other');
    if(change==='client')f.replaceClient();
    f.foreground();f.frame();assert.equal(f.counts().focuses,change==='restore'?2:1,change);f.h.unmount();
  }
});

test('explicit quote after manual keyboard hide can focus again instead of hitting Android already-focused no-op',()=>{
  const f=screenFixture();f.render();f.focus();f.hide();
  const tree=f.render();nodes(tree).find(node=>node.type==='bubble').props.onQuote({id:'quoted',text:'Synthetic quote'});
  assert.equal(f.counts().focuses,2);assert.ok(label(f.render(),'Remove quote'));f.h.unmount();
});

test('video open/play use synchronous actual recorder guards without treating the viewer block as recording',()=>{
  const f=screenFixture('Retain this text'),events=[];let busy=true,viewerBlocked=false;
  f.app.discovery={capabilities:{privateMediaCache:true}};f.app.clock={now:()=>100};
  f.app.mediaCache={setViewerOpen:value=>events.push(value),revalidate:async()=>{},invalidate:()=>events.push('invalidated')};
  const source={id:'message',conversationId:'chat',transportId:'synthetic',text:'Synthetic',media:{kind:'video',access:'unsupported',viewOnce:false,expiresAt:null}};
  const cached={messages:[source]};f.app.history.get=()=>cached;let tree=f.render();
  const voice=nodes(tree).find(node=>node.type==='voice');voice.props.ref.current={isBusy:()=>busy,setViewerBlocked:value=>{if(value && busy)return false;viewerBlocked=value;return true;}};
  const open=()=>nodes(f.render()).find(node=>node.type==='bubble').props.onOpenMedia(source);
  open();assert.equal(nodes(f.render()).some(node=>node.type==='viewer'),false);
  busy=false;open();tree=f.render();let viewer=nodes(tree).find(node=>node.type==='viewer');assert.ok(viewer);assert.equal(viewerBlocked,true);assert.equal(viewer.props.canPlay(),true);
  busy=true;assert.equal(viewer.props.canPlay(),false);busy=false;
  assert.equal(label(tree,'Message').props.value,'Retain this text');viewer.props.onClose();tree=f.render();assert.equal(viewerBlocked,false);assert.equal(nodes(tree).some(node=>node.type==='viewer'),false);
  assert.equal(f.sends.length,0);assert.equal(label(tree,'Message').props.value,'Retain this text');f.h.unmount();
});
test('real focus effect cleanup is isolated from hold/snapshot rerenders and status refresh',async()=>{
  const f=screenFixture('');let tree=f.render();const before=f.counts();
  const voice=()=>nodes(tree).find(node=>node.type==='voice');assert.equal(voice().props.active,true);
  voice().props.onBusyChange(true);tree=f.render();await voice().props.beforePick();
  f.app.snapshot={...f.app.snapshot,conversations:f.app.snapshot.conversations.map(c=>({...c,control:'manual'}))};tree=f.render();
  assert.equal(voice().props.active,true);assert.deepEqual(f.counts(),before);
  f.app.status='offline';tree=f.render();assert.equal(voice().props.active,true);assert.deepEqual(f.counts(),before);
  f.route(false);tree=f.render();assert.equal(voice().props.active,false);assert.ok(f.counts().dismisses>before.dismisses);f.h.unmount();
});
