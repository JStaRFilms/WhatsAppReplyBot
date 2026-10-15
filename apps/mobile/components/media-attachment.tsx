import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Message } from '@replybot/core/contracts';
import type { MediaHandle } from '../lib/media-cache';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import image from '../assets/demo-image.png';
import sticker from '../assets/demo-sticker.webp';
import gif from '../assets/demo-clock.gif';

const fixtures={image,sticker,gif};
const idle=()=>()=>{};
const invalid=()=>false;
export function MediaAttachment({message,visible=false,onOpen}:{message:Message;visible?:boolean;onOpen?:(message:Message)=>void}) {
  const {client,palette,clock,mediaCache,discovery}=useApp();
  const media=message.media,identity=JSON.stringify([message.conversationId,message.id,message.transportId]);
  const [lease,setLease]=useState<{client:typeof client;identity:string;handle:MediaHandle} | null>(null);
  const handle=lease?.client===client && lease.identity===identity?lease.handle:undefined;
  const valid=useSyncExternalStore(handle?.subscribe ?? idle,handle?.getSnapshot ?? invalid,invalid);
  const [legacy,setLegacy]=useState<{client:typeof client;identity:string;uri:string} | null>(null);
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[expired,setExpired]=useState(false);
  const supported=!!media && ['image','sticker','animated_sticker','gif','video'].includes(media.kind);
  const allowed=supported && !media?.viewOnce && media?.access!=='expired' && !expired
    && (media?.expiresAt===null || (media?.expiresAt ?? 0)>clock.now());
  const privateCache=discovery?.capabilities?.privateMediaCache===true;
  useLayoutEffect(()=>()=>handle?.release(),[handle]);
  useLayoutEffect(()=>{if(handle && !valid)handle.release();},[handle,valid]);
  useEffect(()=>{
    setLease(null);setLegacy(null);setFailed(false);
    if(!allowed){if(media && privateCache && (media.viewOnce || media.access==='expired' || expired || media.expiresAt!==null && media.expiresAt<=clock.now()))mediaCache.invalidate(message);return;}
    if(!visible || media?.fixture || media?.kind==='video')return;
    const controller=new AbortController();let active=true;
    if(privateCache){
      void mediaCache.acquire(message,'preview','thumbnail',controller.signal).then(handle=>{
        if(active && !controller.signal.aborted)setLease({client,identity,handle});else handle.release();
      }).catch(()=>{if(active)setFailed(true);});
    }else void client.media(message.conversationId,message.id,controller.signal).then(uri=>{if(active)setLegacy({client,identity,uri});}).catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;controller.abort();};
  },[client,mediaCache,identity,media?.kind,media?.viewOnce,media?.access,media?.fixture,media?.expiresAt,attempt,visible,privateCache,allowed]);
  useEffect(()=>{
    setExpired(false);if(media?.expiresAt===null || media?.expiresAt===undefined)return;
    const expiresAt=media.expiresAt;let timer:ReturnType<typeof setTimeout> | undefined;
    const expire=()=>{const remaining=expiresAt-clock.now();if(remaining<=0){setExpired(true);setLegacy(null);if(privateCache)mediaCache.invalidate(message);}
      else timer=setTimeout(expire,Math.min(remaining,2147483647));};
    expire();return()=>clearTimeout(timer);
  },[clock,mediaCache,media?.expiresAt,message.id,privateCache]);
  if(!media)return null;
  if(!allowed)return <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:13,marginBottom:6}}>{media.viewOnce ? 'View-once media is not retained' : !supported ? media.kind+' attachment. Viewing unavailable.' : 'Media unavailable'}</Text>;
  if(media.kind==='video')return privateCache ? <Pressable accessibilityRole="button" accessibilityLabel="Open video" onPress={()=>onOpen?.(message)}
    style={{minHeight:48,paddingVertical:10,paddingHorizontal:12,marginBottom:6}}><Text style={{color:palette.accent,fontFamily:fonts.semibold}}>Open video</Text></Pressable>
    : <Text style={{color:palette.muted}}>Video viewing unavailable.</Text>;
  const fixture=media.fixture ? fixtures[media.fixture] : undefined;
  const uri=visible && valid ? handle?.uri : visible && legacy?.client===client && legacy.identity===identity ? legacy.uri : undefined;
  return <View style={{width:220,height:160,marginBottom:6,justifyContent:'center',alignItems:'center'}}>
    {uri || fixture ? <Pressable accessibilityRole="button" accessibilityLabel={privateCache && !fixture?'Open '+media.kind:'Photo preview only'}
      disabled={!privateCache || !!fixture} onPress={()=>onOpen?.(message)}>
      <Image accessibilityLabel={media.kind+' attachment'} source={fixture ?? {uri:uri ?? ''}} contentFit="contain" autoplay cachePolicy="none" style={{width:220,height:160}}/>
    </Pressable> : failed || handle && !valid ? <Pressable accessibilityRole="button" accessibilityLabel="Retry attachment" onPress={()=>setAttempt(n=>n+1)} style={{minHeight:48,padding:18}}><Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:13}}>Media unavailable. Tap to revalidate.</Text></Pressable>
      : visible ? <ActivityIndicator color={palette.accent}/> : <Text style={{color:palette.muted,fontSize:12}}>Photo preview</Text>}
  </View>;
}
