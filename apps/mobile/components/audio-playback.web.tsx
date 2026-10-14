import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
import type { Message } from '@replybot/core/contracts';
import { cacheAudio, type AudioClip } from '../lib/audio-clip';
import { claimPlayback, releasePlayback } from '../lib/audio-lane';
import { isForeground, useForeground } from '../lib/foreground';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export const audioTime=(seconds:number)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
export function AudioPlayback({clip,message,active=true}:{clip?:AudioClip;message?:Message;active?:boolean}) {
  const {client,palette,clock,reportError}=useApp();const foreground=useForeground();
  const [playing,setPlaying]=useState(false);const [loading,setLoading]=useState(false);
  const [time,setTime]=useState(0);const [duration,setDuration]=useState(0);const [expired,setExpired]=useState(false);
  const player=useRef<HTMLAudioElement | null>(null);const local=useRef<AudioClip | null>(null);
  const request=useRef<AbortController | null>(null);const alive=useRef(true);
  const allowed=active && foreground && !expired && (!message || message.media?.kind==='audio' && !message.media.viewOnce && message.media.access==='available');
  const allowedRef=useRef(allowed);allowedRef.current=allowed;
  const stop=useCallback(()=>{
    request.current?.abort();request.current=null;
    if(player.current){const audio=player.current;audio.onplaying=null;audio.onpause=null;audio.ontimeupdate=null;audio.onloadedmetadata=null;audio.onended=null;audio.pause();audio.removeAttribute('src');audio.load();player.current=null;}
    local.current?.release();local.current=null;
    if(alive.current){setLoading(false);setPlaying(false);setTime(0);}
  },[]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;stop();releasePlayback(stop);};},[stop,client,clip,message?.id]);
  useEffect(()=>{if(!allowed){stop();releasePlayback(stop);}},[allowed,stop]);
  useEffect(()=>{
    setExpired(false);const at=message?.media?.expiresAt;if(at===null || at===undefined)return;
    let timer:ReturnType<typeof setTimeout>;
    const check=()=>{const remaining=at-clock.now();if(remaining<=0){allowedRef.current=false;setExpired(true);stop();}else timer=setTimeout(check,Math.min(remaining,2147483647));};
    check();return()=>clearTimeout(timer);
  },[message?.media?.expiresAt,clock,stop]);
  async function toggle() {
    if(!allowed || loading)return;
    if(playing){player.current?.pause();return;}
    claimPlayback(stop);setLoading(true);const controller=new AbortController();request.current=controller;
    try{
      if(!player.current){
        if(!clip && message){
          const bytes=await client.audio(message.conversationId,message.id,controller.signal);
          if(controller.signal.aborted || !alive.current || !allowedRef.current || !isForeground())return;
          local.current=cacheAudio(bytes);
        }
        const source=clip ?? local.current;if(!source)return;
        const audio=new Audio(source.uri);player.current=audio;
        audio.onplaying=()=>{if(alive.current)setPlaying(true);};audio.onpause=()=>{if(alive.current)setPlaying(false);};audio.onended=()=>{if(alive.current)setPlaying(false);};
        audio.ontimeupdate=()=>{if(alive.current)setTime(audio.currentTime);};
        audio.onloadedmetadata=()=>{if(alive.current && Number.isFinite(audio.duration))setDuration(audio.duration);};
      }
      if(controller.signal.aborted || !alive.current || !allowedRef.current || !isForeground())return;
      if(player.current.ended)player.current.currentTime=0;
      await player.current.play();
    }catch(error){const cancelled=controller.signal.aborted || error instanceof DOMException && error.name==='AbortError';stop();if(!cancelled)reportError('Audio unavailable.');}
    finally{if(alive.current)setLoading(false);}
  }
  return <View style={{flexDirection:'row',alignItems:'center',gap:10,minWidth:155,paddingVertical:4}}>
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'} disabled={!allowed || loading} onPress={()=>{void toggle();}} style={{padding:8}}>
      {loading ? <ActivityIndicator color={palette.accent}/> : playing ? <Pause color={palette.accent} size={22}/> : <Play color={allowed ? palette.accent : palette.muted} size={22}/>}
    </Pressable>
    <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:13}}>{allowed ? audioTime(time)+' / '+audioTime(duration || clip?.duration || message?.media?.duration || 0) : 'Audio unavailable'}</Text>
  </View>;
}
