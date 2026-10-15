const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const message={id:'video',conversationId:'physical',transportId:'synthetic-transport',accountId:'synthetic',media:{kind:'video',access:'unsupported',viewOnce:false,expiresAt:null}};
function fixture(platform='native',options={}) {
  const h=lifecycleHooks(),events=[],listeners=new Map(),removed=[],subscribers=new Set(),dom=new Map(),acquisition=deferred(),replacement=deferred();
  const lane=options.lane ?? load('lib/audio-lane.ts');
  let foreground=true,busy=false,valid=true,released=false,disposed=false,tree,validate=async()=>true;
  const check=()=>assert.equal(disposed,false,'No call after SharedObject disposal');
  const player={duration:40,currentTime:0,videoWidth:640,videoHeight:360,playing:false,paused:true,src:'',
    addListener(event,callback){check();listeners.set(event,callback);return{remove(){removed.push(callback);listeners.delete(event);events.push('unsubscribe:'+event);}};},
    pause(){check();events.push('pause');this.playing=false;this.paused=true;},
    play(){check();events.push('play');this.playing=true;this.paused=false;if(platform==='web')this.onplaying?.();else listeners.get('playingChange')?.({isPlaying:true});return Promise.resolve();},
    replace(source){check();assert.equal(source,null);events.push('detach');},
    replaceAsync(source){check();events.push('replace');assert.equal(source.uri,'file:///private/synthetic.mp4');assert.equal(source.useCaching,false);return replacement.promise;},
    removeAttribute(name){assert.equal(name,'src');events.push('detach');this.src='';},load(){check();events.push('load');},
  };
  const handle={uri:platform==='web'?'blob:private-synthetic':'file:///private/synthetic.mp4',mime:'video/mp4',size:3,sourceVersion:'a'.repeat(64),expiresAt:null,
    getSnapshot:()=>valid && !released,subscribe(fn){subscribers.add(fn);return()=>{events.push('unsubscribe:lease');subscribers.delete(fn);};},
    revalidate(){events.push('revalidate');return validate();},release(){if(released)return;released=true;events.push('release');}};
  const app={client:{},palette:{},mediaCache:{acquire(...args){events.push('acquire');assert.equal(args[1],'video');assert.equal(args[2],'viewer');return acquisition.promise;}}};
  const add=(name,fn)=>dom.set(name,fn),remove=name=>dom.delete(name);
  const modules={react:h.react,'react-native':{View:'view',Text:'text',Pressable:'pressable',ActivityIndicator:'spinner',AppState:{addEventListener:(_,fn)=>{add('appstate',fn);return{remove:()=>remove('appstate')};}}},
    '../lib/audio-lane':lane,'../lib/foreground':{isForeground:()=>foreground},'../lib/app-state':{useApp:()=>app},'../lib/theme':{fonts:{}}};
  if(!options.missing)modules['expo-video']={VideoView:'native-video',useVideoPlayer(source,setup){assert.equal(source,null);h.react.useEffect(()=>()=>{events.push('native-release');disposed=true;},[]);setup(player);return player;}};
  const component=load('components/video-playback'+(platform==='web'?'.web':'')+'.tsx',modules,{AbortController,document:{addEventListener:add,removeEventListener:remove},window:{addEventListener:add,removeEventListener:remove}});
  const props={message,canPlay:()=>!busy};
  const render=()=>h.commit(()=>{let next=component.VideoPlayback(props);if(typeof next?.type==='function')next=next.type(next.props);
    tree=next;const video=nodes(tree).find(node=>node.type==='video');if(video)video.props.ref.current=player;return tree;});
  return {h,events,app,props,player,handle,lane,replacement,render,
    async open(){render();acquisition.resolve(handle);await settle();return render();},
    async ready(){await this.open();replacement.resolve();await settle();if(platform==='web')player.onloadedmetadata?.();else listeners.get('statusChange')?.({status:'readyToPlay'});return render();},
    invalidate(){valid=false;for(const fn of [...subscribers])fn();return render();},
    background(){foreground=false;dom.get(platform==='web'?'visibilitychange':'appstate')?.();},
    foreground(){foreground=true;},busy(value){busy=value;},validation(fn){validate=fn;},resolve:()=>acquisition.resolve(handle),listeners,removed,
  };
}
for(const platform of ['native','web']) {
  test(platform+': Open loads paused, Play revalidates separately, pause/seek are bounded and controls exclude native fullscreen/PiP',async()=>{
    const f=fixture(platform);let tree=await f.ready();assert.equal(f.events.filter(value=>value==='acquire').length,1);assert.equal(f.events.includes('play'),false);
    const video=nodes(tree).find(node=>node.type===(platform==='web'?'video':'native-video'));
    if(platform==='native'){
      assert.equal(f.player.staysActiveInBackground,false);assert.equal(f.player.showNowPlayingNotification,false);assert.equal(f.player.audioMixingMode,'doNotMix');
      assert.equal(video.props.nativeControls,false);assert.equal(video.props.fullscreenOptions.enable,false);assert.equal(video.props.allowsPictureInPicture,false);assert.equal(video.props.startsPictureInPictureAutomatically,false);assert.equal(video.props.allowsVideoFrameAnalysis,false);
    }else {assert.equal(video.props.controls,false);assert.equal(video.props.autoPlay,false);assert.equal(video.props.disablePictureInPicture,true);assert.equal(video.props.disableRemotePlayback,true);}
    assert.equal(video.props.playsInline,true);
    label(tree,'Play video').props.onPress();await settle();assert.deepEqual(f.events.filter(value=>['revalidate','play'].includes(value)),['revalidate','play']);
    tree=f.render();label(tree,'Pause video').props.onPress();tree=f.render();assert.ok(label(tree,'Play video'));
    f.player.currentTime=38;label(tree,'Seek forward 10 seconds').props.onPress();assert.equal(f.player.currentTime,40);
    f.player.currentTime=2;label(f.render(),'Seek back 10 seconds').props.onPress();assert.equal(f.player.currentTime,0);
    f.h.unmount();const release=f.events.indexOf('release');assert.ok(f.events.lastIndexOf('pause')<release);assert.ok(f.events.indexOf('detach')<release);
    if(platform==='native')assert.ok(release<f.events.indexOf('native-release'));assert.equal(f.events.filter(value=>value==='release').length,1);
  });
  test(platform+': competing voice/video claims cancel pending Play, and old cleanup cannot stop a newer owner',async()=>{
    const f=fixture(platform),authorization=deferred();let voiceStopped=0,newStopped=0;await f.ready();
    f.lane.claimPlayback(()=>voiceStopped++);f.validation(()=>authorization.promise);label(f.render(),'Play video').props.onPress();assert.equal(voiceStopped,1);
    f.lane.claimPlayback(()=>newStopped++);authorization.resolve(true);await settle();assert.equal(f.events.includes('play'),false);
    f.h.unmount();assert.equal(newStopped,0);f.lane.stopPlayback();assert.equal(newStopped,1);
  });
  test(platform+': a synchronous recording/picker guard denies open and stale asynchronous Play',async()=>{
    const unopened=fixture(platform);unopened.busy(true);unopened.render();assert.equal(unopened.events.includes('acquire'),false);unopened.h.unmount();
    const f=fixture(platform),authorization=deferred();await f.ready();f.validation(()=>authorization.promise);
    label(f.render(),'Play video').props.onPress();f.busy(true);authorization.resolve(true);await settle();assert.equal(f.events.includes('play'),false);assert.equal(f.events.filter(value=>value==='release').length,1);f.h.unmount();
  });
  test(platform+': failed fresh authorization cannot use a still-positive old lease',async()=>{
    const f=fixture(platform);await f.ready();f.validation(async()=>false);label(f.render(),'Play video').props.onPress();await settle();
    assert.equal(f.events.includes('play'),false);assert.ok(f.events.includes('detach'));assert.ok(label(f.render(),'Retry video'));f.h.unmount();
  });
  test(platform+': background during load/Play, unmount and scope change reject late completions without auto-resume',async()=>{
    for(const stage of ['acquire','replace','play'])for(const change of ['background','unmount','scope']){
      const f=fixture(platform),authorization=deferred();
      if(stage==='acquire')f.render();else if(stage==='replace')await f.open();else {await f.ready();f.validation(()=>authorization.promise);label(f.render(),'Play video').props.onPress();}
      if(change==='background')f.background();else if(change==='unmount')f.h.unmount();else {f.app.client={};f.render();}
      const before=f.events.filter(value=>value==='play').length;
      f.resolve();f.replacement.resolve();authorization.resolve(true);await settle();assert.equal(f.events.filter(value=>value==='play').length,before,stage+'/'+change);
      if(change!=='scope')assert.equal(f.events.filter(value=>value==='release').length,1);
      f.h.unmount();assert.equal(f.events.filter(value=>value==='release').length,1);
    }
  });
  test(platform+': decoder errors remove the source and ignore callbacks retained after disposal',async()=>{
    const f=fixture(platform);await f.ready();let late;
    if(platform==='native'){late=f.listeners.get('statusChange');late({status:'error'});}else {late=f.player.onerror;late();}
    assert.ok(label(f.render(),'Retry video'));assert.ok(f.events.indexOf('detach')<f.events.indexOf('release'));f.h.unmount();const before=f.events.length;
    if(platform==='native')late({status:'readyToPlay'});else late();assert.equal(f.events.length,before);
  });
  test(platform+': remote player URLs are refused and never assigned',async()=>{
    const f=fixture(platform);f.handle.uri='https://example.invalid/private?token=forbidden';await f.open();assert.equal(f.events.includes('replace'),false);assert.equal(f.player.src,'');assert.ok(label(f.render(),'Retry video'));f.h.unmount();
  });
}
function cachedFixture(platform){
  const {z}=require('zod'),records=new Map(),events=[],intervals=[];let now=100000,state='available',version='a'.repeat(64),offline=false;
  const uri=platform==='web'?'blob:private-synthetic':'file:///private/synthetic.mp4';
  const storage={persistent:true,list:async()=>[...records.values()],read:async()=>({uri,release:()=>events.push('url-release')}),
    write:async record=>{records.set(JSON.stringify(record.key),record);events.push('write');},touch:async()=>{},remove:async record=>{records.delete(JSON.stringify(record.key));events.push('unlink');},sweep:async()=>{}};
  class ApiError extends Error {}
  const {MediaCache}=load('lib/media-cache.ts',{'zod':{z},'./api':{ApiError},'./media-cache-storage':{createMediaStorage:()=>storage}},
    {URL,AbortController,Uint8Array,performance:{now:()=>now},setTimeout:(fn,ms)=>ms===0?setTimeout(fn,0):0,clearTimeout,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){}});
  const client={baseUrl:'http://synthetic.invalid/',scope:{profileId:'synthetic',accountId:'synthetic',revision:0},assertActive(){},
    async mediaSource(chat,id,variant){events.push('metadata');if(offline)throw new Error('Synthetic offline');return{cacheNamespace:'00000000-0000-4000-8000-000000000001',conversationId:chat,messageId:id,sourceVersion:version,variant,state,
      mime:state==='available'?'video/mp4':null,maxBytes:10*1024*1024,expiresAt:null,validatedAt:now,validUntil:now+30000};},
    async mediaContent(){events.push('binary');return{mime:'video/mp4',bytes:new Uint8Array([0,0,0,12,102,116,121,112,109,112,52,50])};}};
  const cache=new MediaCache(client,{now:()=>now},storage,()=>now);
  return {cache,events,async open(){const f=fixture(platform);f.app.client=client;f.app.mediaCache=cache;f.render();await settle();await settle();
    f.replacement.resolve();await settle();if(platform==='web')f.player.onloadedmetadata?.();else f.listeners.get('statusChange')?.({status:'readyToPlay'});f.render();return f;},
    async tick(ms){now+=ms;intervals.forEach(fn=>fn());await settle();await settle();},
    state:value=>{state=value;},version:value=>{version=value;},offline:()=>{offline=true;}};
}
for(const platform of ['native','web']){
  test(platform+': real cache downloads once, validates every 15 seconds and reopens paused without a second binary read',async()=>{
    const c=cachedFixture(platform),first=await c.open();assert.equal(c.events.filter(value=>value==='binary').length,1);
    const metadata=c.events.filter(value=>value==='metadata').length;await c.tick(15000);assert.ok(c.events.filter(value=>value==='metadata').length>metadata);
    label(first.render(),'Play video').props.onPress();await settle();assert.equal(first.events.filter(value=>value==='play').length,1);first.h.unmount();
    const second=await c.open();assert.equal(c.events.filter(value=>value==='binary').length,1);assert.equal(second.events.includes('play'),false);second.h.unmount();c.cache.dispose(false);
  });
  test(platform+': real source denial/version and offline 30-second lease expiry stop the player before URL release/purge',async()=>{
    for(const state of ['denied','deleted','expired','view_once','version','offline']){
      const c=cachedFixture(platform),f=await c.open();
      const release=f.events.push.bind(f.events);c.events.push=(...values)=>{for(const value of values)if(value==='url-release' || value==='unlink')release(value);return Array.prototype.push.apply(c.events,values);};
      label(f.render(),'Play video').props.onPress();await settle();
      if(state==='version')c.version('b'.repeat(64));else if(state==='offline')c.offline();else c.state(state);
      await c.tick(state==='offline'?30001:15000);assert.ok(label(f.render(),'Retry video'),state);
      assert.ok(f.events.indexOf('detach')<f.events.indexOf('url-release'),state);assert.equal(f.events.filter(value=>value==='url-release').length,1,state);
      f.h.unmount();c.cache.dispose(false);
    }
  });
  test(platform+': MIME, byte and decoded duration/dimension bounds fail visibly without Play',async()=>{
    for(const limit of ['mime','bytes','duration','dimensions']){
      const f=fixture(platform);if(limit==='mime')f.handle.mime='video/webm';if(limit==='bytes')f.handle.size=10*1024*1024+1;
      if(limit==='duration')f.player.duration=301;await f.ready();
      if(limit==='dimensions'){if(platform==='web'){f.player.videoWidth=1921;f.player.onloadedmetadata?.();}else f.listeners.get('sourceLoad')?.({duration:40,availableVideoTracks:[{size:{width:1921,height:1080}}]});}
      assert.ok(label(f.render(),'Retry video'));assert.equal(f.events.includes('play'),false);f.h.unmount();
    }
  });
}
test('native controls stay disabled until replacement completes, and idle null-source events are harmless',async()=>{
  const f=fixture();f.render();f.listeners.get('statusChange')({status:'idle'});f.listeners.get('playingChange')({isPlaying:false});
  f.resolve();await settle();f.listeners.get('statusChange')({status:'readyToPlay'});assert.equal(label(f.render(),'Play video').props.disabled,true);
  f.replacement.resolve();await settle();assert.equal(label(f.render(),'Play video').props.disabled,false);assert.equal(f.events.includes('play'),false);f.h.unmount();
});
for(const platform of ['native','web'])test(platform+': return from background and unsolicited platform resume cannot restart playback',async()=>{
  const f=fixture(platform);await f.ready();label(f.render(),'Play video').props.onPress();await settle();f.background();f.foreground();f.render();
  assert.equal(f.events.filter(value=>value==='play').length,1);assert.ok(label(f.render(),'Retry video'));f.h.unmount();
  const g=fixture(platform);await g.ready();g.player.playing=true;g.player.paused=false;if(platform==='web')g.player.onplaying();else g.listeners.get('playingChange')({isPlaying:true});
  assert.ok(label(g.render(),'Retry video'));assert.equal(g.events.includes('play'),false);g.h.unmount();
});
for(const platform of ['native','web'])test(platform+': a delayed old pause event cannot relinquish the current audio-lane claim',async()=>{
  const f=fixture(platform);await f.ready();label(f.render(),'Play video').props.onPress();await settle();
  if(platform==='web')f.player.onpause();else f.listeners.get('playingChange')({isPlaying:false});
  const pauses=f.events.filter(value=>value==='pause').length;f.lane.claimPlayback(()=>{});
  assert.equal(f.events.filter(value=>value==='pause').length,pauses+1);f.h.unmount();f.lane.stopPlayback();
});
test('missing native support is visible and never downloads or pretends to play',()=>{
  const f=fixture('native',{missing:true});const tree=f.render();assert.ok(nodes(tree).some(node=>node.props?.accessibilityRole==='alert'));assert.equal(f.events.includes('acquire'),false);f.h.unmount();
});
