import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FileAudio, Mic, Square, Trash2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { clipFromAsset, type AudioClip } from '../lib/audio-clip';
import { stopPlayback } from '../lib/audio-lane';
import { useVoiceRecorder } from '../lib/voice-recorder';
import { useApp } from '../lib/app-state';
import { AudioPlayback, audioTime } from './audio-playback';
import { fonts } from '../lib/theme';
export interface VoiceComposerProps {
  clip:AudioClip | null;disabled:boolean;active:boolean;beforePick:()=>Promise<void>;
  onClip:(clip:AudioClip | null)=>void;onBusyChange:(busy:boolean)=>void;
}
export function VoiceComposer({clip,disabled,active,beforePick,onClip,onBusyChange}:VoiceComposerProps) {
  const {palette,reportError}=useApp();const [working,setWorking]=useState(false);const lock=useRef(false);const alive=useRef(true);
  const recorder=useVoiceRecorder(onClip,reportError);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{onBusyChange(working || recorder.recording);},[working,recorder.recording,onBusyChange]);
  useEffect(()=>{if(!active && recorder.recording)void recorder.stop();},[active,recorder.recording]);
  async function begin(file:boolean) {
    if(disabled || clip || lock.current || recorder.recording)return;
    lock.current=true;setWorking(true);
    try {
      await beforePick();if(!alive.current)return;stopPlayback();
      if(file){
        const selected=await DocumentPicker.getDocumentAsync({type:'audio/*',multiple:false,copyToCacheDirectory:true,base64:false});
        const asset=selected.assets?.[0];
        if(asset){const picked=clipFromAsset(asset);if(alive.current)onClip(picked);else picked.release();}
      }else await recorder.start();
    }catch(error){if(alive.current)reportError(error instanceof Error ? error.message : 'Audio unavailable.');}
    finally{lock.current=false;if(alive.current)setWorking(false);}
  }
  return <View style={{paddingHorizontal:16,paddingBottom:6,gap:4}}>
    {clip ? <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
      <AudioPlayback clip={clip} active={active}/>
      <Text style={{fontFamily:fonts.regular,fontSize:12,color:palette.muted}}>Local preview</Text>
      <Pressable accessibilityLabel="Delete voice note" disabled={disabled} onPress={()=>{stopPlayback();onClip(null);}} style={{padding:10}}><Trash2 color={palette.muted} size={20}/></Pressable>
    </View> : <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
      {recorder.recording ? <Pressable accessibilityLabel="Stop recording" onPress={()=>{void recorder.stop();}} style={{flexDirection:'row',alignItems:'center',gap:8,padding:10}}>
        <Square color={palette.danger} size={20}/><Text style={{color:palette.text,fontFamily:fonts.regular}}>{audioTime(recorder.seconds)} / 5:00</Text>
      </Pressable> : <>
        <Pressable accessibilityLabel="Record voice note" disabled={disabled || working || !recorder.canRecord} onPress={()=>{void begin(false);}} style={{padding:10,opacity:disabled || !recorder.canRecord ? 0.4 : 1}}><Mic color={palette.muted} size={21}/></Pressable>
        <Pressable accessibilityLabel="Choose audio file" disabled={disabled || working} onPress={()=>{void begin(true);}} style={{flexDirection:'row',alignItems:'center',gap:6,padding:10,opacity:disabled ? 0.4 : 1}}><FileAudio color={palette.muted} size={20}/><Text style={{fontFamily:fonts.regular,fontSize:12,color:palette.muted}}>Audio file</Text></Pressable>
      </>}
    </View>}
    {!recorder.canRecord && !clip && <Text style={{fontFamily:fonts.regular,fontSize:11,color:palette.muted}}>Recording needs Expo Go or HTTPS. On HTTP, choose an audio file.</Text>}
  </View>;
}
