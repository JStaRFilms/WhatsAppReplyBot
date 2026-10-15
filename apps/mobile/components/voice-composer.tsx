import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Mic, Send, Square, Trash2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { clipFromAsset, type AudioClip } from '../lib/audio-clip';
import { stopPlayback } from '../lib/audio-lane';
import { useVoiceRecorder } from '../lib/voice-recorder';
import { useApp } from '../lib/app-state';
import { AudioPlayback, audioTime } from './audio-playback';
import { fonts } from '../lib/theme';
export interface VoiceComposerHandle { pickAudio:()=>void }
export interface VoiceComposerProps {
  ref?:Ref<VoiceComposerHandle>;children:ReactNode;canSend:boolean;sending:boolean;onSend:()=>void;
  clip:AudioClip | null;disabled:boolean;active:boolean;beforePick:()=>Promise<void>;
  onClip:(clip:AudioClip | null)=>void;onBusyChange:(busy:boolean)=>void;
}
export function VoiceComposer({ref,children,canSend,sending,onSend,clip,disabled,active,beforePick,onClip,onBusyChange}:VoiceComposerProps) {
  const {palette,reportError}=useApp();const [working,setWorking]=useState(false);const [recordingError,setRecordingError]=useState<string | null>(null);const lock=useRef(false);const alive=useRef(true);
  const activeRef=useRef(active);const operation=useRef(0);const recordingGuard=useRef<()=>boolean>(()=>false);
  if(activeRef.current!==active){activeRef.current=active;if(!active)operation.current++;}
  const recorder=useVoiceRecorder(clip=>{if(recordingGuard.current())onClip(clip);else clip.release();},message=>{
    if(alive.current){setRecordingError(message);reportError(message);}
  });
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;operation.current++;};},[]);
  useEffect(()=>{onBusyChange(working || recorder.recording);},[working,recorder.recording,onBusyChange]);
  useEffect(()=>{if(!active && recorder.recording)void recorder.stop();},[active,recorder.recording]);
  async function begin(file:boolean) {
    if(disabled || !activeRef.current || canSend || clip || lock.current || recorder.recording)return;
    const current=++operation.current;
    const isCurrent=()=>alive.current && activeRef.current && operation.current===current;
    lock.current=true;setRecordingError(null);setWorking(true);
    try {
      await beforePick();if(!isCurrent())return;stopPlayback();
      if(file){
        const selected=await DocumentPicker.getDocumentAsync({type:'audio/*',multiple:false,copyToCacheDirectory:true,base64:false});
        const asset=selected.assets?.[0];
        if(asset){const picked=clipFromAsset(asset);if(isCurrent())onClip(picked);else picked.release();}
      }else {recordingGuard.current=isCurrent;await recorder.start(isCurrent);}
    }catch(error){
      if(isCurrent()){
        const message=error instanceof Error ? error.message : 'Audio unavailable.';
        setRecordingError(message);reportError(message);
      }
    }finally{
      lock.current=false;
      if(alive.current){
        if(!isCurrent())setRecordingError('Audio setup was cancelled when this chat lost focus. Tap the mic again when you are back in this chat.');
        setWorking(false);
      }
    }
  }
  useImperativeHandle(ref,()=>({pickAudio:()=>{void begin(true);}}));
  const blocked=disabled || !active || working || (!canSend && !recorder.canRecord);
  return <>
    {clip && <View style={{paddingHorizontal:16,paddingBottom:6,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
      <AudioPlayback clip={clip} active={active}/>
      <Text style={{fontFamily:fonts.regular,fontSize:12,color:palette.muted}}>Local preview</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Delete voice note" disabled={disabled} onPress={()=>{stopPlayback();onClip(null);}} style={{padding:10}}><Trash2 color={palette.muted} size={20}/></Pressable>
    </View>}
    {working && <Text accessibilityLiveRegion="polite" style={{paddingHorizontal:16,color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>Preparing voice note…</Text>}
    {!!recordingError && <Text accessibilityRole="alert" style={{paddingHorizontal:16,color:palette.danger,fontFamily:fonts.regular,fontSize:12}}>{recordingError}</Text>}
    {recorder.recording && <Text style={{paddingHorizontal:16,color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>{audioTime(recorder.seconds)} / 5:00</Text>}
    <View style={{flexDirection:'row',alignItems:'flex-end',padding:12,paddingBottom:24,gap:8}}>
      {children}
      <Pressable accessibilityRole="button" accessibilityLabel={recorder.recording ? 'Stop recording' : canSend ? 'Send message' : 'Record voice note'}
        accessibilityState={{disabled:!recorder.recording && blocked,busy:working || sending}}
        disabled={!recorder.recording && blocked}
        onPress={()=>{if(recorder.recording){void recorder.stop();}else if(canSend){onSend();}else{void begin(false);}}}
        style={{height:49,width:49,borderRadius:25,backgroundColor:recorder.recording ? palette.danger : palette.accent,alignItems:'center',justifyContent:'center',opacity:!recorder.recording && blocked ? 0.4 : 1}}>
        {recorder.recording ? <Square color={palette.accentText} size={22}/> : working || sending ? <ActivityIndicator color={palette.accentText}/> : canSend ? <Send color={palette.accentText} size={22}/> : <Mic color={palette.accentText} size={22}/>}
      </Pressable>
    </View>
    {!recorder.canRecord && !clip && !canSend && <Text style={{paddingHorizontal:16,fontFamily:fonts.regular,fontSize:11,color:palette.muted}}>Browser recording needs HTTPS. Use the installed Otherme app or choose Audio in attachments.</Text>}
  </>;
}
