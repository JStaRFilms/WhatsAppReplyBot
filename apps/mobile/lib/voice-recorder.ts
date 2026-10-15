import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import { clipFromUri, type AudioClip } from './audio-clip';
import { isForeground, useForeground } from './foreground';
export function useVoiceRecorder(onClip:(clip:AudioClip)=>void,onError:(message:string)=>void) {
  const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording,setRecording]=useState(false);const [seconds,setSeconds]=useState(0);
  const foreground=useForeground();const alive=useRef(true);const running=useRef(false);const stopping=useRef(false);
  const localUri=useRef<string | null>(null);
  const callbacks=useRef({onClip,onError});callbacks.current={onClip,onError};
  const discard=()=>{
    const uri=localUri.current;localUri.current=null;
    if(uri){const file=new File(uri);if(file.exists)file.delete();}
  };
  const resetMode=()=>setAudioModeAsync({allowsRecording:false,shouldPlayInBackground:false}).catch(()=>{});
  const stop=async()=>{
    if(!running.current || stopping.current)return;stopping.current=true;
    try {
      const duration=recorder.currentTime;await recorder.stop();
      if(localUri.current && alive.current){
        const clip=clipFromUri(localUri.current,duration);callbacks.current.onClip(clip);localUri.current=null;
      }
    }catch{if(alive.current)callbacks.current.onError('Recording could not be saved.');}
    finally{
      await resetMode();
      try{discard();}catch{if(alive.current)callbacks.current.onError('Recording could not be removed.');}
      running.current=false;stopping.current=false;if(alive.current)setRecording(false);
    }
  };
  const stopRef=useRef(stop);stopRef.current=stop;
  // Expo releases its SharedObject in passive cleanup. Stop before that, and keep
  // the URI outside it so asynchronous completion never reads a released object.
  useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;
    if(running.current)void stopRef.current();else discard();
  };},[recorder]);
  useEffect(()=>{if(!foreground && recording)void stopRef.current();},[foreground,recording]);
  useEffect(()=>{
    if(!recording)return;const started=Date.now();
    const timer=setInterval(()=>setSeconds(Math.min(300,(Date.now()-started)/1000)),250);
    const maximum=setTimeout(()=>{void stopRef.current();},299000);
    return()=>{clearInterval(timer);clearTimeout(maximum);};
  },[recording]);
  return {recording,seconds,canRecord:true,stop,start:async(isActive:()=>boolean=()=>true)=>{
    if(!alive.current || !isForeground() || !isActive())throw new Error('Recording cancelled.');
    const permission=await requestRecordingPermissionsAsync();
    if(!permission.granted)throw new Error(permission.canAskAgain === false
      ? 'Microphone access is blocked. Allow it in your phone settings for Otherme, then try again.'
      : 'Allow microphone access for Otherme, then tap the mic again.');
    if(!alive.current || !isForeground() || !isActive())throw new Error('Return to the chat before recording.');
    let prepared=false;
    try{
      await setAudioModeAsync({allowsRecording:true,shouldPlayInBackground:false});
      if(!alive.current || !isForeground() || !isActive())throw new Error('Recording cancelled.');
      await recorder.prepareToRecordAsync();
      if(!alive.current)throw new Error('Recording cancelled.');
      prepared=true;localUri.current=recorder.uri;
      if(!isForeground() || !isActive())throw new Error('Recording cancelled.');
      recorder.record({forDuration:300});
      if(!recorder.isRecording)throw new Error('The microphone did not start. Check microphone access on your phone and try again.');
      running.current=true;setSeconds(0);setRecording(true);
    }catch(error){
      // A failed start can leave Android's recorder prepared and block every retry.
      if(prepared && alive.current)await recorder.stop().catch(()=>{});
      await resetMode();discard();throw error;
    }
  }};
}
