import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import type { Message } from '@replybot/core/contracts';
import type { MediaHandle } from '../lib/media-cache';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import { VideoPlayback } from './video-playback';

const idle=()=>()=>{},invalid=()=>false;
export const clampZoom=(value:number)=>Math.max(1,Math.min(3,value));
export function boundedPan(x:number,y:number,zoom:number,width:number,height:number){
  return {x:Math.max(-width*(zoom-1)/2,Math.min(width*(zoom-1)/2,x)),y:Math.max(-height*(zoom-1)/2,Math.min(height*(zoom-1)/2,y))};
}
export function MediaViewer({message,onClose,canPlay}:{message:Message;onClose:()=>void;canPlay:()=>boolean}) {
  const {mediaCache,palette,client}=useApp(),insets=useSafeAreaInsets();
  const isVideo=message.media?.kind==='video';
  const title=isVideo?'Video':message.media?.kind==='image'?'Photo':message.media?.kind==='gif'?'Animation':'Sticker';
  const identity=JSON.stringify([message.conversationId,message.id,message.transportId]);
  const [owned,setOwned]=useState<{cache:typeof mediaCache;identity:string;handle:MediaHandle} | null>(null);
  const handle=owned?.cache===mediaCache && owned.identity===identity?owned.handle:undefined;
  const valid=useSyncExternalStore(handle?.subscribe ?? idle,handle?.getSnapshot ?? invalid,invalid);
  const notice=useSyncExternalStore(mediaCache.subscribe,mediaCache.getNotice,mediaCache.getNotice);
  const [error,setError]=useState<string | null>(null),[attempt,setAttempt]=useState(0);
  const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[size,setSize]=useState({width:1,height:1});
  const gesture=useRef({x:0,y:0,zoom:1,distance:0});
  const close=useRef(onClose);close.current=onClose;
  const committed=useRef<MediaHandle | undefined>(undefined);
  useLayoutEffect(()=>{committed.current=handle;return()=>{committed.current=undefined;handle?.release();};},[handle]);
  useLayoutEffect(()=>{if(handle && !valid){handle.release();close.current();}},[handle,valid]);
  useEffect(()=>{
    const abort=new AbortController();let active=true,acquired:MediaHandle | undefined;setOwned(null);setError(null);
    if(isVideo)return()=>{active=false;abort.abort();};
    const variant=message.media?.kind==='image'?'image':'preview';
    void mediaCache.acquire(message,variant,'viewer',abort.signal).then(handle=>{if(active && !abort.signal.aborted){acquired=handle;setOwned({cache:mediaCache,identity,handle});}else handle.release();})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Photo unavailable.');});
    return()=>{active=false;abort.abort();
      // Layout cleanup owns committed handles. Discarded state updates leave
      // the acquiring effect responsible for releasing their handles.
      if(acquired && acquired!==committed.current)acquired.release();
    };
  },[mediaCache,client,identity,attempt,isVideo]);
  useEffect(()=>{
    if(typeof window==='undefined' || typeof window.addEventListener!=='function' || typeof window.removeEventListener!=='function')return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close.current();}};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[]);
  const changeZoom=(next:number)=>{const value=clampZoom(next);setZoom(value);setPan(previous=>boundedPan(previous.x,previous.y,value,size.width,size.height));};
  const responder=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,state)=>zoom>1 || state.numberActiveTouches===2,
    onPanResponderGrant:event=>{const [a,b]=event.nativeEvent.touches;gesture.current={...pan,zoom,distance:a && b?Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY):0};},
    onPanResponderMove:(event,state)=>{const [a,b]=event.nativeEvent.touches,start=gesture.current;
      const next=a && b && start.distance>0?clampZoom(start.zoom*Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY)/start.distance):start.zoom;
      setZoom(next);setPan(boundedPan(start.x+state.dx,start.y+state.dy,next,size.width,size.height));
    },onPanResponderTerminationRequest:()=>true,
  }),[pan,zoom,size]);
  const control=(label:string,press:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={press}
    style={{minWidth:48,minHeight:48,paddingHorizontal:12,alignItems:'center',justifyContent:'center',opacity:disabled?0.4:1}}><Text style={{color:palette.accent,fontFamily:fonts.semibold}}>{label}</Text></Pressable>;
  return <Modal visible animationType="fade" onRequestClose={()=>close.current()} accessibilityViewIsModal>
    <View style={{flex:1,backgroundColor:palette.background,paddingTop:insets.top,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:8}}>
        <Text accessibilityRole="header" style={{flex:1,minWidth:0,color:palette.text,fontFamily:fonts.semibold,fontSize:16}}>{title}</Text>
        {control('Close '+title.toLowerCase(),()=>close.current())}
      </View>
      <View {...(isVideo?{}:responder.panHandlers)} accessibilityLabel={isVideo?'Video modal content':title+' viewing area'} onLayout={event=>setSize({width:event.nativeEvent.layout.width,height:event.nativeEvent.layout.height})}
        style={{flex:1,minHeight:0,overflow:'hidden',alignItems:'center',justifyContent:'center'}}>
        {isVideo ? <VideoPlayback message={message} canPlay={canPlay}/> : valid && handle ? <Image source={{uri:handle.uri}} accessibilityLabel={'Full-screen '+title.toLowerCase()} contentFit="contain" cachePolicy="none" autoplay
          style={{width:'100%',height:'100%',transform:[{translateX:pan.x},{translateY:pan.y},{scale:zoom}]}}/>
          : error ? <View style={{padding:24,gap:12}}><Text accessibilityRole="alert" style={{color:palette.muted}}>{error}</Text>{control('Retry '+title.toLowerCase(),()=>setAttempt(value=>value+1))}</View>
          : <ActivityIndicator accessibilityLabel={'Loading '+title.toLowerCase()} color={palette.accent}/>}
      </View>
      {!isVideo && <View style={{flexDirection:'row',justifyContent:'center',flexWrap:'wrap',gap:4}}>
        {control('Zoom out',()=>changeZoom(zoom-0.5),!valid || zoom<=1)}
        {control('Reset zoom',()=>{setZoom(1);setPan({x:0,y:0});},!valid)}
        {control('Zoom in',()=>changeZoom(zoom+0.5),!valid || zoom>=3)}
      </View>}
      {!!notice && <Text style={{paddingHorizontal:16,paddingBottom:8,color:palette.muted,fontSize:11}}>{notice}</Text>}
    </View>
  </Modal>;
}
