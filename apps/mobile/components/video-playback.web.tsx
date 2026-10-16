import { useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { Message } from '@replybot/core/contracts';
import type { MediaHandle } from '../lib/media-cache';
import { claimPlayback, releasePlayback } from '../lib/audio-lane';
import { isForeground } from '../lib/foreground';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';

interface VideoPlaybackProps { message:Message; canPlay:()=>boolean }
const time=(seconds:number)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
export function VideoPlayback({message,canPlay}:VideoPlaybackProps) {
  const {mediaCache,client,palette}=useApp();
  const element=useRef<HTMLVideoElement | null>(null);
  const identity=JSON.stringify([message.conversationId,message.id,message.transportId]);
  const scope=useRef({mediaCache,client,identity,canPlay});scope.current={mediaCache,client,identity,canPlay};
  const session=useRef<{toggle:()=>Promise<void>;seek:(offset:number)=>void} | null>(null);
  const [attempt,setAttempt]=useState(0),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[busy,setBusy]=useState(false);
  const [elapsed,setElapsed]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState<string | null>(null);
  useLayoutEffect(()=>{
    const player=element.current;if(!player){setError('Video playback is unavailable in this browser.');return;}
    let live=true,handle:MediaHandle | undefined,loaded=false,working=false,authorized=false,ticket=0;
    const abort=new AbortController();let unsubscribe:(()=>void) | undefined;
    const current=()=>live && scope.current.mediaCache===mediaCache && scope.current.client===client && scope.current.identity===identity
      && isForeground() && scope.current.canPlay() && !!handle?.getSnapshot();
    const stop=()=>{
      if(!live)return;ticket++;working=false;authorized=false;player.pause();releasePlayback(stop);setPlaying(false);setBusy(false);
    };
    const dispose=()=>{
      if(!live)return;live=false;ticket++;abort.abort();unsubscribe?.();
      document.removeEventListener('visibilitychange',background);window.removeEventListener('blur',background);
      player.onplaying=null;player.onpause=null;player.ontimeupdate=null;player.onloadedmetadata=null;player.onended=null;player.onerror=null;
      // Detach before revoking the Blob URL or releasing its cache pin.
      try {player.pause();player.removeAttribute('src');player.load();}
      finally {handle?.release();handle=undefined;releasePlayback(stop);}
    };
    const fail=(notice:string)=>{if(!live)return;dispose();setReady(false);setPlaying(false);setBusy(false);setError(notice);};
    const background=()=>{if(!isForeground())fail('Video stopped when the app left the foreground. Retry to load it paused.');};
    const toggle=async()=>{
      if(!current() || !loaded || working)return;
      if(!player.paused){stop();return;}
      claimPlayback(stop);working=true;setBusy(true);const turn=++ticket;
      try {
        const valid=await handle?.revalidate();
        if(!live || turn!==ticket)return;
        if(!valid || !current()){fail('Video source is unavailable. Retry to revalidate.');return;}
        if(player.currentTime>=player.duration)player.currentTime=0;
        authorized=true;await player.play();
        if(!live || turn!==ticket)return;
        if(!current())fail('Video source is unavailable. Retry to revalidate.');
      }catch {if(live && turn===ticket)fail('Video could not play. Its format may be unsupported.');}
      finally {if(live && turn===ticket){working=false;setBusy(false);}}
    };
    const commands={toggle,seek:(offset:number)=>{
      if(!current() || !loaded || working)return;
      player.currentTime=Math.max(0,Math.min(player.duration,player.currentTime+offset));setElapsed(player.currentTime);
    }};
    session.current=commands;setReady(false);setPlaying(false);setBusy(false);setElapsed(0);setDuration(0);setError(null);
    document.addEventListener('visibilitychange',background);window.addEventListener('blur',background);
    player.onloadedmetadata=()=>{
      if(!live)return;
      if(!current()){fail('Video source is unavailable. Retry to revalidate.');return;}
      if(!Number.isFinite(player.duration) || player.duration<=0 || player.duration>300 || player.videoWidth>1920 || player.videoHeight>1080){fail('Video exceeds the supported duration or dimensions.');return;}
      loaded=true;setReady(true);setDuration(player.duration);
    };
    player.onplaying=()=>{if(!live)return;if(!current() || !authorized){fail('Video stopped. Press Retry, then Play to start again.');return;}setPlaying(true);};
    player.onpause=player.onended=()=>{if(!live || !player.paused || working && !authorized)return;authorized=false;releasePlayback(stop);setPlaying(false);};
    player.ontimeupdate=()=>{if(!live)return;if(!current()){fail('Video source is unavailable. Retry to revalidate.');return;}setElapsed(player.currentTime);};
    player.onerror=()=>{if(live)fail('Video could not load. Its format may be unsupported.');};
    if(!isForeground() || !scope.current.canPlay())fail('Close recording or the picker before opening video.');
    else if(live)void mediaCache.acquire(message,'video','viewer',abort.signal).then(acquired=>{
      if(!live){acquired.release();return;}handle=acquired;
      unsubscribe=handle.subscribe(()=>{if(!handle?.getSnapshot())fail('Video source is unavailable. Retry to revalidate.');});
      if(!current() || !handle.uri.startsWith('blob:') || handle.mime!=='video/mp4' || handle.size>10*1024*1024){fail('A current private MP4 Blob is required.');return;}
      player.src=handle.uri;player.load();
    }).catch(()=>{if(live)fail('Video could not load. Retry to revalidate its source.');});
    return()=>{dispose();if(session.current===commands)session.current=null;};
  },[mediaCache,client,identity,attempt]);
  const control=(label:string,press:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={press}
    style={{minHeight:48,minWidth:48,paddingHorizontal:12,justifyContent:'center',alignItems:'center',opacity:disabled?0.4:1}}><Text style={{color:palette.accent,fontFamily:fonts.semibold}}>{label}</Text></Pressable>;
  return <View style={{flex:1,width:'100%'}}>
    <video ref={element} controls={false} autoPlay={false} playsInline disablePictureInPicture disableRemotePlayback
      controlsList="nodownload nofullscreen noremoteplayback" preload="metadata" aria-label="Video viewing area" onContextMenu={event=>event.preventDefault()}
      style={{flex:1,minHeight:0,width:'100%',objectFit:'contain',display:error?'none':'block'}}/>
    {error ? <View style={{padding:16}}><Text accessibilityRole="alert" style={{color:palette.muted}}>{error}</Text>{control('Retry video',()=>setAttempt(value=>value+1))}</View>
      : <><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',alignItems:'center'}}>
        {control(playing?'Pause video':'Play video',()=>{void session.current?.toggle();},!ready || busy)}
        {control('Seek back 10 seconds',()=>session.current?.seek(-10),!ready || busy)}
        {control('Seek forward 10 seconds',()=>session.current?.seek(10),!ready || busy)}
        <Text style={{color:palette.muted}}>{time(elapsed)} / {time(duration)}</Text>
      </View>{(!ready || busy) && <ActivityIndicator accessibilityLabel={ready?'Preparing video':'Loading video'} color={palette.accent}/>}</>}
  </View>;
}
