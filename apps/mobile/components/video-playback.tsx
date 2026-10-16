import { useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import type { Message } from '@replybot/core/contracts';
import type { MediaHandle } from '../lib/media-cache';
import { claimPlayback, releasePlayback } from '../lib/audio-lane';
import { isForeground } from '../lib/foreground';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';

type VideoModule = typeof import('expo-video');
let videoModule: VideoModule | null = null;
try { videoModule = require('expo-video'); } catch { /* Older native installs have no ExpoVideo module. */ }
interface VideoPlaybackProps { message:Message; canPlay:()=>boolean }
const time=(seconds:number)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');

export function VideoPlayback(props:VideoPlaybackProps) {
  const {palette}=useApp();
  return videoModule ? <NativePlayback {...props} module={videoModule}/> :
    <Text accessibilityRole="alert" style={{color:palette.muted,padding:16}}>Video playback is unavailable in this installed app.</Text>;
}
function NativePlayback({message,canPlay,module}:VideoPlaybackProps & {module:VideoModule}) {
  const {mediaCache,client,palette}=useApp();
  const player=module.useVideoPlayer(null,player=>{
    player.staysActiveInBackground=false;player.showNowPlayingNotification=false;
    player.audioMixingMode='doNotMix';player.allowsExternalPlayback=false;player.timeUpdateEventInterval=0.25;
  });
  const identity=JSON.stringify([message.conversationId,message.id,message.transportId]);
  const scope=useRef({mediaCache,client,identity,canPlay});scope.current={mediaCache,client,identity,canPlay};
  const session=useRef<{toggle:()=>Promise<void>;seek:(offset:number)=>void} | null>(null);
  const [attempt,setAttempt]=useState(0),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[busy,setBusy]=useState(false);
  const [elapsed,setElapsed]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState<string | null>(null);
  useLayoutEffect(()=>{
    let live=true,handle:MediaHandle | undefined,loaded=false,replaced=false,decoded=false,working=false,authorized=false,ticket=0;
    const abort=new AbortController(),subscriptions:{remove:()=>void}[]=[];
    const current=()=>live && scope.current.mediaCache===mediaCache && scope.current.client===client && scope.current.identity===identity
      && isForeground() && scope.current.canPlay() && !!handle?.getSnapshot();
    const stop=()=>{
      if(!live)return;ticket++;working=false;authorized=false;player.pause();releasePlayback(stop);setPlaying(false);setBusy(false);
    };
    const dispose=()=>{
      if(!live)return;live=false;ticket++;abort.abort();
      for(const subscription of subscriptions)subscription.remove();
      // Null replacement cancels pending native loading. Do this before unpin/unlink and automatic SharedObject release.
      try { player.pause();player.replace(null,true); }
      finally { handle?.release();handle=undefined;releasePlayback(stop); }
    };
    const fail=(notice:string)=>{if(!live)return;dispose();setReady(false);setPlaying(false);setBusy(false);setError(notice);};
    const toggle=async()=>{
      if(!current() || !loaded || working)return;
      if(player.playing){stop();return;}
      claimPlayback(stop);working=true;setBusy(true);const turn=++ticket;
      try {
        const valid=await handle?.revalidate();
        if(!live || turn!==ticket)return;
        if(!valid || !current()){fail('Video source is unavailable. Retry to revalidate.');return;}
        if(player.currentTime>=player.duration)player.currentTime=0;
        authorized=true;player.play();
      }catch {if(live && turn===ticket)fail('Video could not play. Its format may be unsupported.');}
      finally {if(live && turn===ticket){working=false;setBusy(false);}}
    };
    const commands={toggle,seek:(offset:number)=>{
      if(!current() || !loaded || working)return;
      player.currentTime=Math.max(0,Math.min(player.duration,player.currentTime+offset));setElapsed(player.currentTime);
    }};
    session.current=commands;setReady(false);setPlaying(false);setBusy(false);setElapsed(0);setDuration(0);setError(null);
    subscriptions.push(AppState.addEventListener('change',()=>{if(!isForeground())fail('Video stopped when the app left the foreground. Retry to load it paused.');}));
    const markReady=()=>{
      if(!live || !replaced || !decoded)return;
      if(!Number.isFinite(player.duration) || player.duration<=0 || player.duration>300){fail('Video exceeds the supported duration.');return;}
      loaded=true;setReady(true);setDuration(player.duration);
    };
    subscriptions.push(player.addListener('statusChange',event=>{
      if(!live || !handle)return;
      if(!current()){fail('Video source is unavailable. Retry to revalidate.');return;}
      if(event.status==='error')fail('Video could not load. Its format may be unsupported.');
      else if(event.status==='readyToPlay'){decoded=true;markReady();}
    }));
    subscriptions.push(player.addListener('playingChange',event=>{
      if(!live || !handle && !event.isPlaying || event.isPlaying!==player.playing || !event.isPlaying && working && !authorized)return;
      if(!current() || event.isPlaying && !authorized){fail('Video stopped. Press Retry, then Play to start again.');return;}
      if(!event.isPlaying){authorized=false;releasePlayback(stop);}setPlaying(event.isPlaying);
    }));
    subscriptions.push(player.addListener('sourceLoad',event=>{
      if(!live || !handle)return;
      if(!current()){fail('Video source is unavailable. Retry to revalidate.');return;}
      if(event.duration>300 || event.availableVideoTracks.some(track=>track.size.width>1920 || track.size.height>1080))fail('Video exceeds the supported duration or dimensions.');
    }));
    subscriptions.push(player.addListener('timeUpdate',event=>{
      if(!live || !handle)return;if(!current()){fail('Video source is unavailable. Retry to revalidate.');return;}setElapsed(event.currentTime);
    }));
    if(!isForeground() || !scope.current.canPlay())fail('Close recording or the picker before opening video.');
    else if(live)void mediaCache.acquire(message,'video','viewer',abort.signal).then(async acquired=>{
      if(!live){acquired.release();return;}handle=acquired;
      subscriptions.push({remove:handle.subscribe(()=>{if(!handle?.getSnapshot())fail('Video source is unavailable. Retry to revalidate.');})});
      if(!current() || !handle.uri.startsWith('file:') || handle.mime!=='video/mp4' || handle.size>10*1024*1024){fail('A current private MP4 file is required.');return;}
      await player.replaceAsync({uri:handle.uri,useCaching:false});
      if(!live)return;
      if(!current()){fail('Video source is unavailable. Retry to revalidate.');return;}
      // Opening never claims the audio lane or starts playback.
      player.pause();replaced=true;decoded=decoded || player.status==='readyToPlay';markReady();
    }).catch(()=>{if(live)fail('Video could not load. Retry to revalidate its source.');});
    return()=>{dispose();if(session.current===commands)session.current=null;};
  },[player,mediaCache,client,identity,attempt]);
  const control=(label:string,press:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={press}
    style={{minHeight:48,minWidth:48,paddingHorizontal:12,justifyContent:'center',alignItems:'center',opacity:disabled?0.4:1}}><Text style={{color:palette.accent,fontFamily:fonts.semibold}}>{label}</Text></Pressable>;
  const VideoView=module.VideoView;
  return <View style={{flex:1,width:'100%'}}>
    {!error && <VideoView player={player} nativeControls={false} contentFit="contain" fullscreenOptions={{enable:false}}
      allowsPictureInPicture={false} startsPictureInPictureAutomatically={false} allowsVideoFrameAnalysis={false} playsInline
      style={{flex:1}} accessibilityLabel="Video viewing area"/>}
    {error ? <View style={{padding:16}}><Text accessibilityRole="alert" style={{color:palette.muted}}>{error}</Text>{control('Retry video',()=>setAttempt(value=>value+1))}</View>
      : <><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',alignItems:'center'}}>
        {control(playing?'Pause video':'Play video',()=>{void session.current?.toggle();},!ready || busy)}
        {control('Seek back 10 seconds',()=>session.current?.seek(-10),!ready || busy)}
        {control('Seek forward 10 seconds',()=>session.current?.seek(10),!ready || busy)}
        <Text style={{color:palette.muted}}>{time(elapsed)} / {time(duration)}</Text>
      </View>{(!ready || busy) && <ActivityIndicator accessibilityLabel={ready?'Preparing video':'Loading video'} color={palette.accent}/>}</>}
  </View>;
}
