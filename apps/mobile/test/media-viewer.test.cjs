const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const photo={id:'source',conversationId:'physical',transportId:'transport-source',accountId:'synthetic',media:{kind:'image',access:'available',expiresAt:null,viewOnce:false,fixture:null}};
function fixture(kind='viewer'){
  const h=lifecycleHooks(),response=deferred(),events=[],keys=new Map(),requests=[];let tree,valid=true,released=false;
  const handle={uri:'blob:private-synthetic',sourceVersion:'a'.repeat(64),expiresAt:null,mime:'image/jpeg',size:3,getSnapshot:()=>valid,subscribe:()=>()=>{},
    release(){if(released)return;released=true;events.push({kind:'release',images:nodes(tree).filter(node=>node.type==='image').length});}};
  const app={client:{},palette:{},clock:{now:()=>100},discovery:{capabilities:{privateMediaCache:true}},
    mediaCache:{acquire:(...args)=>{requests.push(args);return response.promise;},subscribe:()=>()=>{},getNotice:()=>null,invalidate(){valid=false;events.push({kind:'invalidate'});}}};
  const native={Modal:'modal',View:'view',Text:'text',Pressable:'pressable',ActivityIndicator:'spinner',PanResponder:{create:handlers=>({panHandlers:handlers})}};
  const modules={react:h.react,'./video-playback':{VideoPlayback:'video'},'react-native':native,'expo-image':{Image:'image'},'../lib/app-state':{useApp:()=>app},'../lib/theme':{fonts:{}},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:11,bottom:22,left:3,right:4})},'../assets/demo-image.png':1,'../assets/demo-sticker.webp':2,'../assets/demo-clock.gif':3};
  const component=load(kind==='viewer'?'components/media-viewer.tsx':'components/media-attachment.tsx',modules,{AbortController,setTimeout:()=>1,clearTimeout(){},
    window:{addEventListener:(key,fn)=>keys.set(key,fn),removeEventListener:key=>keys.delete(key)}});
  const props={message:photo,canPlay:()=>true,visible:kind!=='thumbnail',onClose:()=>events.push({kind:'close'}),onOpen:message=>events.push({kind:'open',id:message.id})};
  const draw=()=>tree=kind==='viewer'?component.MediaViewer(props):component.MediaAttachment(props);
  const render=()=>h.commit(draw);
  return {h,app,props,requests,response,events,handle,keys,draw,render,invalidate:()=>{valid=false;return render();}};
}
test('explicit photo viewer requests only image, fits private local URI, respects safe areas and closes on back/Escape',async()=>{
  const f=fixture();f.render();assert.equal(f.requests.length,1);assert.equal(f.requests[0][1],'image');assert.equal(f.requests[0][2],'viewer');
  f.response.resolve(f.handle);await settle();const tree=f.render(),image=label(tree,'Full-screen photo');assert.equal(image.props.source.uri,'blob:private-synthetic');assert.equal(image.props.cachePolicy,'none');assert.equal(image.props.contentFit,'contain');
  const layout=nodes(tree).find(node=>node.type==='view');assert.equal(layout.props.style.paddingTop,11);assert.equal(layout.props.style.paddingBottom,22);assert.equal(layout.props.style.paddingLeft,3);
  label(tree,'Close photo').props.onPress();tree.props.onRequestClose();f.keys.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(f.events.filter(event=>event.kind==='close').length,3);
  assert.ok(label(tree,'Close photo').props.style.minHeight>=48);f.h.unmount();assert.equal(f.keys.size,0);assert.equal(f.events.filter(event=>event.kind==='release').length,1);
});
test('review38 viewer acquired before React commit is released on close',async()=>{
  const f=fixture();f.render();f.response.resolve(f.handle);await settle();f.h.unmount();
  assert.equal(f.events.filter(event=>event.kind==='release').length,1);
});
test('review38 photo closing render before passive cleanup retains ownership of a late acquisition',async()=>{
  const f=fixture();f.render();f.props.message={...photo,media:{...photo.media,kind:'video'}};
  const closing=f.h.render(f.draw);assert.equal(nodes(closing).some(node=>node.type==='image'),false);
  f.response.resolve(f.handle);await settle();f.h.flush();f.render();
  assert.equal(f.events.filter(event=>event.kind==='release').length,1);
  assert.equal(nodes(f.render()).some(node=>node.type==='image'),false);
  f.h.unmount();assert.equal(f.events.filter(event=>event.kind==='release').length,1);
});
test('review38 scope change releases an uncommitted old viewer without publishing it in the new scope',async()=>{
  const f=fixture();f.render();f.app.client={};
  f.app.mediaCache={...f.app.mediaCache,acquire:()=>new Promise(()=>{})};
  const changed=f.h.render(f.draw);assert.equal(nodes(changed).some(node=>node.type==='image'),false);
  f.response.resolve(f.handle);await settle();f.h.flush();
  assert.equal(nodes(f.render()).some(node=>node.type==='image'),false);
  assert.equal(f.events.filter(event=>event.kind==='release').length,1);
  f.h.unmount();assert.equal(f.events.filter(event=>event.kind==='release').length,1);
});
test('review38 repeated uncommitted photo closes free the real shared photo/video viewer slot',async()=>{
  const {z}=require('zod'),records=new Map();
  const storage={persistent:false,list:async()=>[...records.values()],read:async()=>({uri:'blob:synthetic-cache',release(){}}),
    write:async record=>{records.set(JSON.stringify(record.key),record);},touch:async()=>{},remove:async record=>{records.delete(JSON.stringify(record.key));},sweep:async()=>{}};
  const {MediaCache}=load('lib/media-cache.ts',{'zod':{z},'./api':{ApiError:class extends Error{}},'./media-cache-storage':{createMediaStorage:()=>storage}},
    {URL,Uint8Array,AbortController,performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
  const client={baseUrl:'http://synthetic.local',scope:{profileId:'synthetic-profile',accountId:photo.accountId,revision:1},assertActive(){},
    mediaSource:async(chat,id,variant)=>({cacheNamespace:'00000000-0000-4000-8000-000000000050',conversationId:chat,messageId:id,sourceVersion:'a'.repeat(64),variant,
      state:'available',mime:variant==='video'?'video/mp4':'image/jpeg',maxBytes:3,expiresAt:null,validatedAt:100,validUntil:30100}),
    mediaContent:async source=>({mime:source.mime,bytes:new Uint8Array([1,2,3])})};
  const cache=new MediaCache(client,{now:()=>100},storage,()=>0),acquire=cache.acquire.bind(cache);
  try{
    for(let opening=0;opening<3;opening++){
      const f=fixture();f.app.mediaCache=cache;
      cache.acquire=(...args)=>acquire(...args).then(handle=>{f.response.resolve(handle);return handle;});
      try{
        f.render();await f.response.promise;await settle();assert.equal(cache.slots,1);
        if(opening===1)assert.ok(label(f.render(),'Full-screen photo'));
      }finally{f.h.unmount();}
      assert.equal(cache.slots,0);
      const video=await acquire({...photo,id:'video',transportId:'video'},'video','viewer');
      assert.equal(video.getSnapshot(),true);assert.equal(cache.slots,1);video.release();video.release();assert.equal(cache.slots,0);
    }
  }finally{cache.dispose(false);}
});
test('zoom, reset, bounded pan and two-touch pinch stay between 1x and 3x',async()=>{
  const f=fixture();f.render();f.response.resolve(f.handle);await settle();f.render();
  label(f.render(),'Photo viewing area').props.onLayout({nativeEvent:{layout:{width:320,height:400}}});
  for(let n=0;n<10;n++)label(f.render(),'Zoom in').props.onPress();let image=label(f.render(),'Full-screen photo');assert.equal(image.props.style.transform[2].scale,3);
  let area=label(f.render(),'Photo viewing area');area.props.onPanResponderGrant({nativeEvent:{touches:[]}});area.props.onPanResponderMove({nativeEvent:{touches:[]}},{dx:9999,dy:-9999});
  image=label(f.render(),'Full-screen photo');assert.equal(image.props.style.transform[0].translateX,320);assert.equal(image.props.style.transform[1].translateY,-400);
  label(f.render(),'Reset zoom').props.onPress();image=label(f.render(),'Full-screen photo');assert.equal(image.props.style.transform[2].scale,1);assert.equal(image.props.style.transform[0].translateX,0);
  area=label(f.render(),'Photo viewing area');area.props.onPanResponderGrant({nativeEvent:{touches:[{pageX:0,pageY:0},{pageX:100,pageY:0}]}});
  area.props.onPanResponderMove({nativeEvent:{touches:[{pageX:0,pageY:0},{pageX:200,pageY:0}]}},{dx:0,dy:0});assert.equal(label(f.render(),'Full-screen photo').props.style.transform[2].scale,2);
  for(let n=0;n<10;n++)label(f.render(),'Zoom out').props.onPress();assert.equal(label(f.render(),'Full-screen photo').props.style.transform[2].scale,1);f.h.unmount();
});
test('source denial removes decoded image before release and close; late route/profile completion releases without publishing',async()=>{
  const f=fixture();f.render();f.response.resolve(f.handle);await settle();f.render();const invalid=f.invalidate();assert.equal(nodes(invalid).filter(node=>node.type==='image').length,0);
  assert.equal(f.events.find(event=>event.kind==='release').images,0);assert.equal(f.events.filter(event=>event.kind==='close').length,1);f.h.unmount();
  const late=fixture();late.render();late.h.unmount();assert.equal(late.requests[0][3].aborted,true);late.response.resolve(late.handle);await settle();assert.equal(late.events.filter(event=>event.kind==='release').length,1);
});
test('sticker/animation viewing requests its bounded preview, never full image or any model/upload operation',async()=>{
  const f=fixture();f.props.message={...photo,media:{...photo.media,kind:'gif'}};f.render();assert.equal(f.requests[0][1],'preview');assert.match(nodes(f.render()).find(node=>node.props?.accessibilityRole==='header').props.children,/Animation/);f.h.unmount();f.response.resolve(f.handle);await settle();
});
test('only measured visible thumbnails acquire handles; offscreen, covered and new-scope renders remove decoded pixels before release',async()=>{
  const f=fixture('thumbnail');f.render();assert.equal(f.requests.length,0);f.props.visible=true;f.render();assert.equal(f.requests.length,1);assert.equal(f.requests[0][1],'preview');
  f.response.resolve(f.handle);await settle();let tree=f.render();label(tree,'Open image').props.onPress();assert.equal(f.events.find(event=>event.kind==='open').id,photo.id);
  f.props.visible=false;tree=f.render();assert.equal(nodes(tree).filter(node=>node.type==='image').length,0);assert.equal(f.events.find(event=>event.kind==='release').images,0);f.h.unmount();
  const changed=fixture('thumbnail');changed.props.visible=true;changed.render();changed.response.resolve(changed.handle);await settle();changed.render();changed.app.client={};tree=changed.render();assert.equal(nodes(tree).filter(node=>node.type==='image').length,0);changed.h.unmount();
});
test('an acquired thumbnail awaiting its first React commit is released on unmount',async()=>{
  const f=fixture('thumbnail');f.props.visible=true;f.render();
  f.response.resolve(f.handle);await settle();
  f.h.unmount();assert.equal(f.events.filter(event=>event.kind==='release').length,1);
});
test('a thumbnail resolved between an offscreen render and passive cleanup cannot lose its owner',async()=>{
  const f=fixture('thumbnail');f.props.visible=true;f.render();
  f.props.visible=false;const hidden=f.h.render(f.draw);
  assert.equal(nodes(hidden).filter(node=>node.type==='image').length,0);
  // Deliver after the offscreen render, before its passive cancellation.
  f.response.resolve(f.handle);await settle();f.h.flush();f.render();
  assert.equal(f.events.filter(event=>event.kind==='release').length,1);
  f.h.unmount();assert.equal(f.events.filter(event=>event.kind==='release').length,1);
});
test('video offers explicit Open without metadata, binary, thumbnail or legacy-AI-access prefetch',()=>{
  const f=fixture('thumbnail');f.props.visible=true;f.props.message={...photo,media:{...photo.media,kind:'video',access:'unsupported'}};
  const tree=f.render();assert.equal(f.requests.length,0);assert.equal(nodes(tree).some(node=>node.type==='image'),false);
  label(tree,'Open video').props.onPress();assert.equal(f.events.find(event=>event.kind==='open').id,photo.id);f.h.unmount();
});
test('video reuses the existing modal with video Close/back/Escape and no photo acquisition or zoom',()=>{
  const f=fixture();f.props.message={...photo,media:{...photo.media,kind:'video',access:'unsupported'}};
  const tree=f.render();assert.equal(f.requests.length,0);assert.equal(nodes(tree).filter(node=>node.type==='video').length,1);
  assert.equal(nodes(tree).some(node=>node.props?.accessibilityLabel==='Zoom in'),false);
  label(tree,'Close video').props.onPress();tree.props.onRequestClose();f.keys.get('keydown')({key:'Escape',preventDefault(){}});
  assert.equal(f.events.filter(event=>event.kind==='close').length,3);f.h.unmount();
});
test('known view-once/expiry unmounts a thumbnail and requests invalidation without reading binary again',async()=>{
  const f=fixture('thumbnail');f.props.visible=true;f.render();f.response.resolve(f.handle);await settle();f.render();
  f.props.message={...photo,media:{...photo.media,viewOnce:true}};const tree=f.render();assert.equal(nodes(tree).filter(node=>node.type==='image').length,0);assert.ok(f.events.some(event=>event.kind==='invalidate'));assert.equal(f.requests.length,1);f.h.unmount();
});
