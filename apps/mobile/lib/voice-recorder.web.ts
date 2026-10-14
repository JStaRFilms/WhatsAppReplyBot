import { useEffect, useRef, useState } from 'react';
import { clipFromBlob } from './audio-clip.web';
import type { AudioClip } from './audio-clip';
import { isForeground, useForeground } from './foreground';
export function useVoiceRecorder(onClip:(clip:AudioClip)=>void,onError:(message:string)=>void) {
  const [recording,setRecording]=useState(false);const [seconds,setSeconds]=useState(0);
  const foreground=useForeground();const alive=useRef(true);
  const recorder=useRef<MediaRecorder | null>(null);const stream=useRef<MediaStream | null>(null);
  const callbacks=useRef({onClip,onError});callbacks.current={onClip,onError};
  const canRecord=typeof window!=='undefined' && window.isSecureContext && typeof MediaRecorder!=='undefined' && !!navigator.mediaDevices?.getUserMedia;
  const stop=async()=>{if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;void stop();};},[]);
  useEffect(()=>{if(!foreground && recording)void stop();},[foreground,recording]);
  return {recording,seconds,canRecord,stop,start:async()=>{
    if(!canRecord)throw new Error('Recording needs Expo Go or HTTPS. Choose an audio file on HTTP.');
    const input=await navigator.mediaDevices.getUserMedia({audio:true});
    if(!alive.current || !isForeground()){input.getTracks().forEach(t=>t.stop());throw new Error('Recording cancelled.');}
    stream.current=input;
    const media=new MediaRecorder(input);recorder.current=media;
    const chunks:Blob[]=[];let size=0;let rejected=false;const started=Date.now();
    const timer=setInterval(()=>{if(alive.current)setSeconds((Date.now()-started)/1000);},250);
    const maximum=setTimeout(()=>{void stop();},299000);
    media.ondataavailable=event=>{size+=event.data.size;if(size>10*1024*1024){rejected=true;void stop();}else chunks.push(event.data);};
    media.onerror=()=>{rejected=true;void stop();};
    media.onstop=()=>{
      clearInterval(timer);clearTimeout(maximum);input.getTracks().forEach(t=>t.stop());stream.current=null;recorder.current=null;
      if(alive.current){setRecording(false);
        if(rejected)callbacks.current.onError('Recording failed or exceeded 10 MB.');
        else try{callbacks.current.onClip(clipFromBlob(new Blob(chunks,{type:media.mimeType}),(Date.now()-started)/1000));}
        catch{callbacks.current.onError('Recording could not be saved.');}
      }
    };
    media.start(1000);setSeconds(0);setRecording(true);
  }};
}
