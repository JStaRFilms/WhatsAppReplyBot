const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));

function viewerFixture(kind,window={},notice=null) {
  const h=lifecycleHooks(),pending=deferred(),requests=[],events=[];let valid=true,released=false,tree;
  const handle={uri:'file:///synthetic-media',getSnapshot:()=>valid,subscribe:()=>()=>{},release(){
    if(released)return;released=true;events.push({kind:'release',images:nodes(tree).filter(node=>node.type==='image').length});
  }};
  const cache={acquire:(...args)=>{requests.push(args);return pending.promise;},subscribe:()=>()=>{},getNotice:()=>notice};
  const component=load('components/media-viewer.tsx',{react:h.react,
    'react-native':{Modal:'modal',View:'view',Text:'text',Pressable:'button',ActivityIndicator:'spinner',PanResponder:{create:()=>({panHandlers:{}})}},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})},'expo-image':{Image:'image'},
    '../lib/app-state':{useApp:()=>({mediaCache:cache,client:cache,palette:{}})},'../lib/theme':{fonts:{}},'./video-playback':{VideoPlayback:'video'}},
    {window,AbortController});
  const props={message:{id:'source',conversationId:'physical',transportId:'transport',media:{kind}},canPlay:()=>true,onClose:()=>events.push({kind:'close'})};
  const render=()=>h.commit(()=>tree=component.MediaViewer(props));
  return {h,render,handle,pending,requests,events,revoke(){valid=false;return render();}};
}

for(const kind of ['image','sticker','animated_sticker','gif','video'])test('ui56 native-like '+kind+' viewer opens and closes without DOM methods',async()=>{
  for(let repeat=0;repeat<3;repeat++){
    const f=viewerFixture(kind);let tree=f.render();
    const title=kind==='image'?'Photo':kind==='gif'?'Animation':kind==='video'?'Video':'Sticker';
    assert.equal(nodes(tree).find(node=>node.props?.accessibilityRole==='header').props.children,title);
    label(tree,'Close '+title.toLowerCase());
    if(kind!=='video')label(tree,'Loading '+title.toLowerCase());
    tree.props.onRequestClose();assert.equal(f.events.filter(event=>event.kind==='close').length,1);
    if(kind==='video'){
      assert.equal(f.requests.length,0);assert.ok(label(tree,'Close video'));assert.equal(nodes(tree).filter(node=>node.type==='video').length,1);
    }else{
      assert.equal(f.requests[0][1],kind==='image'?'image':'preview');
      f.pending.resolve(f.handle);await settle();tree=f.render();assert.equal(nodes(tree).filter(node=>node.type==='image').length,1);
      tree=f.revoke();assert.equal(nodes(tree).filter(node=>node.type==='image').length,0);
      assert.equal(f.events.find(event=>event.kind==='release').images,0);assert.equal(f.events.filter(event=>event.kind==='close').length,2);
    }
    f.h.unmount();assert.equal(f.events.filter(event=>event.kind==='release').length,kind==='video'?0:1);
  }
});
test('ui56 partial DOM shim is not subscribed without a matching removal method',()=>{
  const f=viewerFixture('video',{addEventListener(){assert.fail('Cannot own a listener without cleanup');}});
  f.render();f.h.unmount();
});
test('ui56 viewer keeps a real cache limitation notice without the routine storage lecture',()=>{
  const notice='Media stays only for this browser session. Private persistent storage is unavailable.';
  const f=viewerFixture('video',{},notice),tree=f.render();
  assert.ok(nodes(tree).some(node=>node.props?.children===notice));
  assert.equal(nodes(tree).some(node=>typeof node.props?.children==='string' && node.props.children.includes('secure erase')),false);
  f.h.unmount();
});
test('ui56 native-like late photo acquisition is released without publishing',async()=>{
  const f=viewerFixture('image');f.render();f.h.unmount();assert.equal(f.requests[0][3].aborted,true);
  f.pending.resolve(f.handle);await settle();assert.equal(f.events.filter(event=>event.kind==='release').length,1);
});
