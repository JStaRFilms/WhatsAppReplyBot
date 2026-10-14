const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,modules={},globals={}) {
  const source=fs.readFileSync(path.join(__dirname,'../lib',file),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  const exports={};vm.runInNewContext(outputText,{exports,require:name=>{assert.ok(name in modules,'Unexpected module '+name);return modules[name];},...globals});return exports;
}
function hooks() {
  const effects=[],layouts=[];
  return {effects,layouts,react:{useRef:value=>({current:value}),useState:value=>[value,()=>{}],useCallback:fn=>fn,useEffect:fn=>effects.push(fn),useLayoutEffect:fn=>layouts.push(fn)}};
}
test('one playback lane pauses the previous note and does not release another player',()=>{
  const lane=load('audio-lane.ts');let first=0,second=0;
  const a=()=>first++,b=()=>second++;
  lane.claimPlayback(a);lane.claimPlayback(a);assert.equal(first,0);
  lane.claimPlayback(b);assert.equal(first,1);lane.releasePlayback(a);lane.stopPlayback();assert.equal(second,1);
  lane.stopPlayback();assert.equal(second,1);
});
test('HTTP LAN recording is disabled before getUserMedia and the hook needs no secure UUID or native DOM',async()=>{
  const h=hooks();let mic=0;
  const hook=load('voice-recorder.web.ts',{'react':h.react,'./audio-clip.web':{},'./foreground':{isForeground:()=>true,useForeground:()=>true}},
    {window:{isSecureContext:false},navigator:{mediaDevices:{getUserMedia:async()=>{mic++;}}},MediaRecorder:function(){}});
  const recorder=hook.useVoiceRecorder(()=>assert.fail('No clip expected'),()=>{});
  assert.equal(recorder.canRecord,false);await assert.rejects(recorder.start(),/Expo Go or HTTPS/);assert.equal(mic,0);
});
test('web recording stays local until Send; stop/unmount releases tracks and timers without exporting bytes',async()=>{
  const h=hooks();let stopped=0,bytes=0,clips=0,cleared=0;let media;
  class Recorder {
    constructor(){media=this;this.state='inactive';this.mimeType='audio/webm';}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable({data:new Blob(['synthetic'])});this.onstop();}
  }
  const timers={setInterval:()=>1,setTimeout:()=>2,clearInterval:()=>cleared++,clearTimeout:()=>cleared++};
  const hook=load('voice-recorder.web.ts',{'react':h.react,'./audio-clip.web':{clipFromBlob:blob=>({uri:'blob:local',size:blob.size,bytes:async()=>{bytes++;return new Uint8Array();},release:()=>{}})},'./foreground':{isForeground:()=>true,useForeground:()=>true}},
    {window:{isSecureContext:true},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})}},MediaRecorder:Recorder,Blob,Date,...timers});
  const recorder=hook.useVoiceRecorder(()=>clips++,()=>assert.fail('Unexpected recording error'));
  const cleanup=h.effects[0]();await recorder.start();assert.equal(media.state,'recording');assert.equal(bytes,0);assert.equal(clips,0);
  await recorder.stop();assert.equal(clips,1);assert.ok(stopped>=1);assert.equal(bytes,0);assert.equal(cleared,2);cleanup();
});
test('native Expo recorder requests permission, caps recording and cleans local files on unmount with a window shim',async()=>{
  const h=hooks();let permissions=0,starts=0,stops=0,deleted=0,clips=0;
  const recorder={uri:'file:///synthetic-local.m4a',currentTime:1,prepareToRecordAsync:async()=>{},record:options=>{assert.equal(options.forDuration,300);starts++;},stop:async()=>{stops++;}};
  const hook=load('voice-recorder.ts',{'react':h.react,'expo-audio':{RecordingPresets:{HIGH_QUALITY:{}},useAudioRecorder:()=>recorder,requestRecordingPermissionsAsync:async()=>{permissions++;return{granted:true};},setAudioModeAsync:async mode=>{assert.equal(mode.shouldPlayInBackground,false);}},
    'expo-file-system':{File:class {exists=true;delete(){deleted++;}}},'./audio-clip':{clipFromUri:()=>{clips++;return{uri:recorder.uri};}},'./foreground':{isForeground:()=>true,useForeground:()=>true}},
    {window:{},setTimeout,clearTimeout,setInterval,clearInterval,Date});
  const voice=hook.useVoiceRecorder(()=>{},()=>assert.fail('Unexpected recorder error'));const cleanup=h.layouts[0]();
  await voice.start();assert.equal(permissions,1);assert.equal(starts,1);assert.equal(clips,0);
  cleanup();await new Promise(resolve=>setImmediate(resolve));assert.equal(stops,1);assert.equal(deleted,1);assert.equal(clips,0);
});
test('web audio cache uses private blob URLs, enforces 10MB and revokes previews',async()=>{
  let revoked=0,created=0;
  const audio=load('audio-clip.web.ts',{}, {Blob,Uint8Array,URL:{createObjectURL:()=>{created++;return'blob:synthetic-private';},revokeObjectURL:()=>revoked++}});
  const clip=audio.cacheAudio(new Uint8Array([1,2,3]));assert.equal(clip.uri,'blob:synthetic-private');assert.equal(clip.size,3);assert.deepEqual(Array.from(await clip.bytes()),[1,2,3]);clip.release();assert.equal(revoked,1);
  assert.throws(()=>audio.clipFromBlob(new Blob([new Uint8Array(10*1024*1024+1)])),/under 10 MB/);assert.equal(created,1);
});
test('native layout teardown precedes Expo release and retains file cleanup after async stop failure',async()=>{
  for(const state of ['idle','recording','stop-failure']){
    const h=hooks();let released=false,lateAccess=0,deleted=0,stops=0;
    const access=()=>{if(released){lateAccess++;throw new Error('SharedObject released');}};
    const recorder={get uri(){access();return 'file:///synthetic-local.m4a';},get currentTime(){access();return 1;},
      prepareToRecordAsync:async()=>{access();},record:()=>access(),stop:async()=>{access();stops++;await Promise.resolve();if(state==='stop-failure')throw new Error('stop failed');}};
    const hook=load('voice-recorder.ts',{'react':h.react,'expo-audio':{RecordingPresets:{HIGH_QUALITY:{}},
      useAudioRecorder:()=>{h.react.useEffect(()=>()=>{released=true;});return recorder;},
      requestRecordingPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{}},
      'expo-file-system':{File:class {exists=true;delete(){deleted++;}}},'./audio-clip':{clipFromUri:()=>assert.fail('No clip after unmount')},
      './foreground':{isForeground:()=>true,useForeground:()=>true}}, {Date});
    const voice=hook.useVoiceRecorder(()=>assert.fail('No clip after unmount'),()=>assert.fail('No UI error after unmount'));
    const nativeRelease=h.effects[0](),cleanup=h.layouts[0]();
    if(state!=='idle')await voice.start();
    assert.doesNotThrow(cleanup);nativeRelease();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(lateAccess,0);assert.equal(stops,state==='idle'?0:1);assert.equal(deleted,state==='idle'?0:1);
  }
  const h=hooks();let released=false,deleted=0,played=0,laneStop=null;
  const access=()=>{if(released)throw new Error('SharedObject released');};
  const player={pause:()=>access(),replace:()=>access(),play:()=>{access();played++;}};
  const jsx=(type,props)=>({type,props});
  const component=load('../components/audio-playback.tsx',{'react':h.react,'react/jsx-runtime':{jsx,jsxs:jsx},
    'react-native':{View:'view',Pressable:'button',Text:'text'},'lucide-react-native':{},
    'expo-audio':{useAudioPlayer:()=>{h.react.useEffect(()=>()=>{released=true;});return player;},useAudioPlayerStatus:()=>({playing:false}),setAudioModeAsync:async()=>{}},
    '../lib/audio-clip':{cacheAudio:()=>({uri:'file:///synthetic-cache.mp3',release:()=>{deleted++;}})},
    '../lib/audio-lane':{claimPlayback:stop=>{laneStop=stop;},releasePlayback:stop=>{if(laneStop===stop)laneStop=null;}},
    '../lib/foreground':{isForeground:()=>true,useForeground:()=>true},
    '../lib/app-state':{useApp:()=>({client:{audio:async()=>new Uint8Array([1])},palette:{},clock:{},reportError:()=>assert.fail('No UI error')})},
    '../lib/theme':{fonts:{}}}, {AbortController,Uint8Array});
  const rendered=component.AudioPlayback({message:{id:'synthetic',conversationId:'c',media:{kind:'audio',viewOnce:false,access:'available',expiresAt:null}}});
  const nativeRelease=h.effects[0](),cleanup=h.layouts[0]();rendered.props.children[0].props.onPress();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(played,1);
  const staleStop=laneStop;assert.doesNotThrow(cleanup);nativeRelease();
  assert.equal(deleted,1);assert.equal(laneStop,null);assert.doesNotThrow(staleStop);
});
