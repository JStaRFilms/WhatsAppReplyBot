const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const native={View:'view',Text:'text',Pressable:'button',ActivityIndicator:'spinner'};
const alert=tree=>nodes(tree).find(node=>node.props?.accessibilityRole==='alert');

function voiceFixture(canRecord=true) {
  const h=lifecycleHooks(),selected=deferred(),errors=[],clips=[];let releases=0,picks=0,starts=0;
  const clip={uri:'file:///synthetic-audio',release(){releases++;}};
  const component=load('components/voice-composer.tsx',{react:h.react,'react-native':native,'lucide-react-native':{},
    'expo-document-picker':{getDocumentAsync:()=>{picks++;return selected.promise;}},
    '../lib/audio-clip':{clipFromAsset:()=>clip},'../lib/audio-lane':{stopPlayback(){}},
    '../lib/voice-recorder':{useVoiceRecorder:()=>({recording:false,canRecord,seconds:0,start:async()=>{starts++;},stop:async()=>{}})},
    '../lib/app-state':{useApp:()=>({palette:{},reportError:error=>errors.push(error)})},
    './audio-playback':{AudioPlayback:'preview',audioTime:()=> '0:00'},'../lib/theme':{fonts:{}}});
  const props={ref:{current:null},children:null,canSend:false,sending:false,clip:null,disabled:false,active:true,scope:{},inactiveReason:'chat',
    beforePick:async()=>{},onClip:clip=>clips.push(clip),onBusyChange(){}};
  const render=()=>h.commit(()=>component.VoiceComposer(props));
  return {h,props,render,selected,errors,clips,counts:()=>({releases,picks,starts}),
    async open(){render();props.ref.current.pickAudio();await settle();render();assert.equal(picks,1);},
    background(){props.active=false;props.inactiveReason='background';return render();},
    foreground(){props.active=true;props.inactiveReason='chat';return render();}};
}
for(const result of ['cancel','valid'])for(const order of ['result-first','foreground-first'])test('ui56 intentional audio picker '+result+' is quiet: '+order,async()=>{
  const f=voiceFixture();await f.open();f.background();
  if(order==='foreground-first')f.foreground();
  f.selected.resolve(result==='cancel'?{canceled:true,assets:null}:{canceled:false,assets:[{uri:'file:///synthetic-audio'}]});
  await settle();assert.equal(alert(f.render()),undefined);assert.equal(f.errors.length,0);
  if(order==='result-first'){
    assert.equal(f.clips.length,0,'Selection waits for the foreground');f.foreground();
  }
  assert.equal(f.clips.length,result==='valid'?1:0);assert.equal(f.counts().starts,0);
  assert.equal(f.props.ref.current.isBusy(),false);f.h.unmount();assert.equal(f.counts().releases,0);
});
for(const change of ['profile','route','unmount'])for(const timing of ['before-result','pending-return'])test('ui56 '+change+' discards late audio picker result: '+timing,async()=>{
  const f=voiceFixture();await f.open();f.background();
  if(timing==='pending-return'){f.selected.resolve({canceled:false,assets:[{uri:'file:///synthetic-audio'}]});await settle();f.render();}
  if(change==='unmount')f.h.unmount();else{
    if(change==='profile')f.props.scope={};else f.props.inactiveReason='chat';
    f.render();f.foreground();
  }
  if(timing==='before-result'){f.selected.resolve({canceled:false,assets:[{uri:'file:///synthetic-audio'}]});await settle();}
  if(change!=='unmount'){assert.equal(alert(f.render()),undefined);f.h.unmount();}
  assert.equal(f.clips.length,0);assert.equal(f.counts().releases,1);assert.equal(f.errors.length,0);assert.equal(f.counts().starts,0);
});
for(const order of ['result-first','foreground-first'])test('ui56 a current audio picker failure still reports its real error: '+order,async()=>{
  const f=voiceFixture();await f.open();f.background();if(order==='foreground-first')f.foreground();
  f.selected.reject(new Error('Synthetic file read failed.'));await settle();f.render();if(order==='result-first')f.foreground();
  assert.equal(alert(f.render()).props.children,'Synthetic file read failed.');assert.equal(f.errors.length,1);f.h.unmount();
});
test('ui56 a pending selection keeps viewer and recording excluded until foreground return',async()=>{
  const f=voiceFixture();await f.open();f.background();f.selected.resolve({canceled:false,assets:[{uri:'file:///synthetic-audio'}]});await settle();
  f.render();assert.equal(f.props.ref.current.isBusy(),true);assert.equal(f.props.ref.current.setViewerBlocked(true),false);
  f.props.ref.current.pickAudio();assert.equal(f.counts().picks,1);assert.equal(f.counts().starts,0);
  f.foreground();assert.equal(f.clips.length,1);assert.equal(f.props.ref.current.isBusy(),false);f.h.unmount();
});
test('ui61 unavailable browser recording offers the existing audio-file action without a permanent HTTPS lecture',async()=>{
  const f=voiceFixture(false),tree=f.render(),control=label(tree,'Choose audio file');
  assert.equal(control.props.disabled,false);
  assert.equal(nodes(tree).some(node=>typeof node.props?.children==='string' && node.props.children.includes('HTTPS')),false);
  control.props.onPress();await settle();f.render();assert.equal(f.counts().picks,1);assert.equal(f.counts().starts,0);
  f.selected.resolve({canceled:true,assets:null});await settle();assert.equal(alert(f.render()),undefined);assert.equal(f.errors.length,0);f.h.unmount();
});
function imageFixture(asset) {
  const h=lifecycleHooks(),alerts=[],images=[],revoked=[],result=deferred();
  const component=load('components/attachment-picker.tsx',{react:h.react,
    'react-native':{...native,Alert:{alert:(...args)=>alerts.push(args)}},'lucide-react-native':{},
    'expo-image-picker':{requestMediaLibraryPermissionsAsync:async()=>({granted:true}),launchImageLibraryAsync:async options=>{
      assert.deepEqual(Array.from(options.mediaTypes),['images']);return result.promise;}},
    '../lib/app-state':{useApp:()=>({palette:{}})},'../lib/theme':{fonts:{}}},{URL:{revokeObjectURL:uri=>revoked.push(uri)}});
  const props={disabled:false,audioDisabled:false,onPick:image=>images.push(image),onBusyChange(){},beforePick:async()=>{},onPickAudio(){}};
  const render=()=>h.commit(()=>component.AttachmentPicker(props));
  return {h,render,alerts,images,revoked,result,async pick(){label(render(),'Attach file').props.onPress();label(render(),'Choose image from gallery').props.onPress();await settle();result.resolve({canceled:false,assets:[asset]});await settle();render();}};
}
for(const extra of [{type:'video',mimeType:'video/mp4'},{type:'video'},{mimeType:'video/mp4'},{type:'image',mimeType:'application/pdf'}])test('ui56 image-only picker rejects '+JSON.stringify(extra),async()=>{
  const f=imageFixture({uri:'blob:synthetic',base64:'AAAA',width:10,height:10,...extra});await f.pick();
  assert.equal(f.images.length,0);assert.equal(f.alerts[0][0],'Choose an image');assert.deepEqual(f.revoked,['blob:synthetic']);f.h.unmount();
});
test('ui56 valid photo selection remains supported and transfers its URI to the composer',async()=>{
  const f=imageFixture({uri:'blob:synthetic',base64:'AAAA',width:10,height:10,type:'image',mimeType:'image/jpeg'});await f.pick();
  assert.equal(f.images.length,1);assert.equal(f.images[0].mimeType,'image/jpeg');assert.equal(f.alerts.length,0);assert.equal(f.revoked.length,0);f.h.unmount();
});
