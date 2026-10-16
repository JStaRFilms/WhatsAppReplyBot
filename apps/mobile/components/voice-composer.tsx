import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FileAudio, Mic, Send, Square, Trash2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { clipFromAsset, type AudioClip } from '../lib/audio-clip';
import { stopPlayback } from '../lib/audio-lane';
import { useVoiceRecorder } from '../lib/voice-recorder';
import { useApp } from '../lib/app-state';
import { AudioPlayback, audioTime } from './audio-playback';
import { fonts } from '../lib/theme';
export interface VoiceComposerHandle { pickAudio:()=>void; isBusy:()=>boolean; setViewerBlocked:(blocked:boolean)=>boolean }
export interface VoiceComposerProps {
  ref?:Ref<VoiceComposerHandle>;children:ReactNode;canSend:boolean;sending:boolean;onSend:()=>void;
  clip:AudioClip | null;disabled:boolean;active:boolean;scope?:object;inactiveReason?:'background'|'chat';beforePick:()=>Promise<void>;
  onClip:(clip:AudioClip | null)=>void;onBusyChange:(busy:boolean)=>void;
}
export function VoiceComposer({ref,children,canSend,sending,onSend,clip,disabled,active,scope,inactiveReason='chat',beforePick,onClip,onBusyChange}:VoiceComposerProps) {
  const {palette,reportError}=useApp();const [working,setWorking]=useState(false);const [recordingError,setRecordingError]=useState<string | null>(null);const lock=useRef(false);const alive=useRef(true);
  const viewerBlocked=useRef(false),recordingActive=useRef(false),stopping=useRef(false);
  const activeRef=useRef(active);const operation=useRef(0);const recordingGuard=useRef<()=>boolean>(()=>false);
  const scopeRef=useRef(scope);const cancellation=useRef<string | null>(null);
  const pickerActive=useRef(false),pendingPick=useRef<{clip:AudioClip;operation:number} | null>(null),reasonRef=useRef(inactiveReason);
  if(scopeRef.current!==scope){scopeRef.current=scope;operation.current++;cancellation.current ??= 'connection or profile changed';}
  if(activeRef.current!==active || reasonRef.current!==inactiveReason){
    activeRef.current=active;reasonRef.current=inactiveReason;
    if(!active && !(pickerActive.current && inactiveReason==='background')){
      operation.current++;cancellation.current ??= inactiveReason==='background' ? 'app left the foreground' : 'chat is no longer focused';
    }
  }
  const recorder=useVoiceRecorder(clip=>{if(recordingGuard.current())onClip(clip);else clip.release();},message=>{
    if(alive.current){setRecordingError(message);reportError(message);}
  });
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;operation.current++;pendingPick.current?.clip.release();pendingPick.current=null;};},[]);
  useEffect(()=>{
    const selected=pendingPick.current;if(!selected)return;
    if(selected.operation!==operation.current || viewerBlocked.current){
      pendingPick.current=null;pickerActive.current=false;selected.clip.release();
    }else if(active){pendingPick.current=null;pickerActive.current=false;onClip(selected.clip);}
  },[active,scope,inactiveReason,working,onClip]);
  useEffect(()=>{onBusyChange(working || recorder.recording);},[working,recorder.recording,onBusyChange]);
  const stopRecording=async()=>{if(stopping.current)return;stopping.current=true;try{await recorder.stop();}finally{stopping.current=false;recordingActive.current=false;}};
  useEffect(()=>{if(recorder.recording && (!active || cancellation.current!==null))void stopRecording();},[active,scope,recorder.recording]);
  useEffect(()=>{if(!recorder.recording && !lock.current)recordingActive.current=false;},[recorder.recording]);
  async function begin(file:boolean) {
    if(disabled || viewerBlocked.current || !activeRef.current || canSend || clip || pendingPick.current || lock.current || recorder.recording)return;
    const current=++operation.current;
    const isCurrent=()=>alive.current && activeRef.current && !viewerBlocked.current && operation.current===current;
    lock.current=true;stopPlayback();cancellation.current=null;setRecordingError(null);setWorking(true);
    let stage='composer hold';let failed=false;
    try {
      await beforePick();if(!isCurrent())return;
      if(file){
        pickerActive.current=true;
        const selected=await DocumentPicker.getDocumentAsync({type:'audio/*',multiple:false,copyToCacheDirectory:true,base64:false});
        const asset=selected.canceled?undefined:selected.assets?.[0];
        if(asset){
          const picked=clipFromAsset(asset);
          if(alive.current && !viewerBlocked.current && operation.current===current){
            // Native pickers may return before AppState becomes active. Keep only
            // this explicit selection; never resume recording or playback.
            if(activeRef.current)onClip(picked);else pendingPick.current={clip:picked,operation:current};
          }else picked.release();
        }
      }else {stage='microphone setup';recordingGuard.current=isCurrent;await recorder.start(isCurrent);recordingActive.current=true;}
    }catch(error){
      failed=true;
      if(alive.current && (!file || !viewerBlocked.current && operation.current===current)){
        const detail=error instanceof Error ? error.message : 'Audio unavailable.';
        const message=file || isCurrent() ? detail : detail+' '+(cancellation.current ?? 'Composer closed')+'. Tap the mic again to start.';
        setRecordingError(message);if(file || isCurrent())reportError(message);
      }
    }finally{
      lock.current=false;if(!pendingPick.current)pickerActive.current=false;
      if(alive.current){
        if(!file && !isCurrent() && !failed)setRecordingError('Audio setup was cancelled during '+stage+': '+(cancellation.current ?? 'composer closed')+'. Tap the mic again to start.');
        setWorking(false);
      }
    }
  }
  useImperativeHandle(ref,()=>({pickAudio:()=>{void begin(true);},
    isBusy:()=>lock.current || !!pendingPick.current || recordingActive.current || recorder.recording || stopping.current,
    setViewerBlocked:blocked=>{if(blocked && (lock.current || pendingPick.current || recordingActive.current || recorder.recording || stopping.current))return false;
      viewerBlocked.current=blocked;if(blocked)operation.current++;return true;},
  }));
  const blocked=disabled || !active || working;
  return <>
    {clip && <View style={{paddingHorizontal:16,paddingBottom:6,flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center',justifyContent:'space-between'}}>
      <AudioPlayback clip={clip} active={active}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Delete voice note" disabled={disabled} onPress={()=>{stopPlayback();onClip(null);}} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><Trash2 color={palette.muted} size={20}/></Pressable>
    </View>}
    {working && <Text accessibilityLiveRegion="polite" style={{paddingHorizontal:16,color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>Preparing voice note…</Text>}
    {!!recordingError && <Text accessibilityRole="alert" style={{paddingHorizontal:16,color:palette.danger,fontFamily:fonts.regular,fontSize:12}}>{recordingError}</Text>}
    {recorder.recording && <Text style={{paddingHorizontal:16,color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>{audioTime(recorder.seconds)} / 5:00</Text>}
    <View style={{flexDirection:'row',alignItems:'flex-end',padding:8,gap:8,width:'100%',maxWidth:800,alignSelf:'center'}}>
      {children}
      <Pressable accessibilityRole="button" accessibilityLabel={recorder.recording ? 'Stop recording' : canSend ? 'Send message' : recorder.canRecord ? 'Record voice note' : 'Choose audio file'}
        accessibilityState={{disabled:!recorder.recording && blocked,busy:working || sending}}
        disabled={!recorder.recording && blocked}
        onPress={()=>{if(recorder.recording){void stopRecording();}else if(canSend){onSend();}else{void begin(!recorder.canRecord);}}}
        style={{height:48,width:48,flexShrink:0,borderRadius:24,backgroundColor:recorder.recording ? palette.danger : palette.accent,alignItems:'center',justifyContent:'center',opacity:!recorder.recording && blocked ? 0.4 : 1}}>
        {recorder.recording ? <Square color={palette.accentText} size={22}/> : working || sending ? <ActivityIndicator color={palette.accentText}/> : canSend ? <Send color={palette.accentText} size={22}/> : recorder.canRecord ? <Mic color={palette.accentText} size={22}/> : <FileAudio color={palette.accentText} size={22}/>}
      </Pressable>
    </View>
  </>;
}
