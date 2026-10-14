import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Message } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import image from '../assets/demo-image.png';
import sticker from '../assets/demo-sticker.webp';
import gif from '../assets/demo-clock.gif';

const fixtures={image,sticker,gif};
export function MediaAttachment({message}:{message:Message}) {
  const {client,palette,clock}=useApp();
  const media=message.media;
  const [source,setSource]=useState<string | null>(null);
  const [failed,setFailed]=useState(false);const [attempt,setAttempt]=useState(0);
  const [expired,setExpired]=useState(false);
  const supported=!!media && ['image','sticker','animated_sticker','gif'].includes(media.kind);
  const allowed=supported && !media?.viewOnce && media?.access!=='expired' && !expired
    && (media?.expiresAt===null || (media?.expiresAt ?? 0)>clock.now());
  useEffect(()=>{
    setSource(null);setFailed(false);setExpired(false);
    if(!allowed || media?.fixture)return;
    const controller=new AbortController();let active=true;
    void client.media(message.conversationId,message.id,controller.signal).then(uri=>{if(active)setSource(uri);}).catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;controller.abort();};
  },[client,message.id,message.conversationId,media?.viewOnce,media?.access,media?.fixture,media?.expiresAt,attempt]);
  useEffect(()=>{
    if(media?.expiresAt===null || media?.expiresAt===undefined)return;
    const expiresAt=media.expiresAt;let timer:ReturnType<typeof setTimeout> | undefined;
    const expire=()=>{const remaining=expiresAt-clock.now();
      if(remaining<=0){setExpired(true);setSource(null);}
      else timer=setTimeout(expire,Math.min(remaining,2147483647));};
    expire();return()=>clearTimeout(timer);
  },[clock,media?.expiresAt]);
  if(!media)return null;
  if(!allowed)return <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:13,marginBottom:6}}>{media.viewOnce ? 'View-once media is not retained' : !supported ? media.kind+' attachment' : 'Media unavailable'}</Text>;
  const fixture=media.fixture ? fixtures[media.fixture] : undefined;
  return <View style={{width:220,height:160,marginBottom:6,justifyContent:'center',alignItems:'center'}}>
    {source || fixture ? <Image accessibilityLabel={media.kind+' attachment'} source={fixture ?? {uri:source ?? ''}} contentFit="contain" autoplay cachePolicy="none" style={{width:220,height:160}}/>
      : failed ? <Pressable accessibilityRole="button" accessibilityLabel="Retry attachment" onPress={()=>setAttempt(n=>n+1)} style={{padding:18}}><Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:13}}>Media unavailable. Tap to retry.</Text></Pressable>
      : <ActivityIndicator color={palette.accent}/>}
  </View>;
}
