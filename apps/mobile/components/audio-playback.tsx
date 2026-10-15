import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { Message } from '@replybot/core/contracts';
import { cacheAudio, type AudioClip } from '../lib/audio-clip';
import { claimPlayback, releasePlayback } from '../lib/audio-lane';
import { isForeground, useForeground } from '../lib/foreground';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export const audioTime=(seconds:number)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
export function AudioPlayback({clip,message,active=true}:{clip?:AudioClip;message?:Message;active?:boolean}) {
  const {client,palette,clock,reportError}=useApp();const foreground=useForeground();
  const player=useAudioPlayer(null,{updateInterval:250});const status=useAudioPlayerStatus(player);
  const [loading,setLoading]=useState(false);const [expired,setExpired]=useState(false);
  const local=useRef<AudioClip | null>(null);const request=useRef<AbortController | null>(null);const alive=useRef(true);
  const allowed=active && foreground && !expired && (!message || message.media?.kind==='audio' && !message.media.viewOnce && message.media.access==='available');
  const allowedRef=useRef(allowed);allowedRef.current=allowed;
  const stop=useCallback(()=>{
    request.current?.abort();request.current=null;
    try{player.pause();player.replace(null);}catch{/* Expo may already have released the native object. */}
    const cached=local.current;local.current=null;
    try{cached?.release();}finally{releasePlayback(stop);if(alive.current)setLoading(false);}
  },[player]);
  // Layout cleanup runs before Expo's passive SharedObject release.
  useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;stop();};},[stop,client,clip,message?.id]);
  useEffect(()=>{if(!allowed){stop();releasePlayback(stop);}},[allowed,stop]);
  useEffect(()=>{
    setExpired(false);const at=message?.media?.expiresAt;if(at===null || at===undefined)return;
    let timer:ReturnType<typeof setTimeout>;
    const check=()=>{const remaining=at-clock.now();if(remaining<=0){allowedRef.current=false;setExpired(true);stop();}else timer=setTimeout(check,Math.min(remaining,2147483647));};
    check();return()=>clearTimeout(timer);
  },[message?.media?.expiresAt,clock,stop]);
  async function toggle() {
    if(!allowed || loading)return;
    if(status.playing){player.pause();return;}
    claimPlayback(stop);setLoading(true);
    const controller=new AbortController();request.current=controller;
    try{
      if(!clip && !local.current && message){
        const bytes=await client.audio(message.conversationId,message.id,controller.signal);
        if(controller.signal.aborted || !alive.current || !allowedRef.current || !isForeground())return;
        local.current=cacheAudio(bytes);player.replace(local.current.uri);
      }else if(clip && !player.isLoaded)player.replace(clip.uri);
      await setAudioModeAsync({allowsRecording:false,shouldPlayInBackground:false});
      if(controller.signal.aborted || !alive.current || !allowedRef.current || !isForeground())return;
      if(status.didJustFinish)await player.seekTo(0);player.play();
    }catch(error){const cancelled=controller.signal.aborted;stop();if(!cancelled)reportError(error instanceof Error ? error.message : 'Audio unavailable.');}
    finally{if(alive.current)setLoading(false);}
  }
  const duration=status.duration || clip?.duration || message?.media?.duration || 0;
  return <View style={{flexDirection:'row',alignItems:'center',gap:8,minWidth:0,flexShrink:1,paddingVertical:4}}>
    <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'} disabled={!allowed || loading} onPress={()=>{void toggle();}} style={{width:48,minHeight:48,flexShrink:0,alignItems:'center',justifyContent:'center'}}>
      {loading ? <ActivityIndicator color={palette.accent}/> : status.playing ? <Pause color={palette.accent} size={22}/> : <Play color={allowed ? palette.accent : palette.muted} size={22}/>}
    </Pressable>
    <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:13,flexShrink:1}}>{allowed ? audioTime(status.currentTime)+' / '+audioTime(duration) : 'Audio unavailable'}</Text>
  </View>;
}
