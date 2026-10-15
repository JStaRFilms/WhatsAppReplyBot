import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Camera, FileAudio, Image, Paperclip } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';

export interface PickedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
  mimeType?: string;
}
export interface AttachmentPickerProps {
  disabled: boolean;
  onPick: (image: PickedImage) => void;
  onBusyChange: (busy: boolean) => void;
  beforePick: () => Promise<void>;
  onPickAudio: () => void;
  audioDisabled: boolean;
}
export function AttachmentPicker({disabled,onPick,onBusyChange,beforePick,onPickAudio,audioDisabled}: AttachmentPickerProps) {
  const {palette} = useApp();
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const picking = useRef(false);
  const alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function pick(camera: boolean) {
    if (disabled || picking.current) return;
    picking.current = true; setBusy(true); setOpen(false); onBusyChange(true);
    try {
      await beforePick();
      if (!alive.current) return;
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!alive.current) return;
      if (!permission.granted) {
        Alert.alert(camera ? 'Camera permission needed' : 'Photo permission needed',
          camera ? 'Allow camera access to take a photo.' : 'Allow photo access to choose an image.');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {mediaTypes:['images'],base64:true,allowsMultipleSelection:false,quality:0.9};
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!alive.current) {
        const uri=result.assets?.[0]?.uri;
        if (process.env.EXPO_OS==='web' && uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
        return;
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        Alert.alert('Image unavailable','This image could not be read. Choose another image.');
        return;
      }
      onPick({uri:asset.uri,base64:asset.base64,width:asset.width,height:asset.height,
        ...(asset.mimeType ? {mimeType:asset.mimeType} : {})});
    } catch {
      if (alive.current) Alert.alert('Picker unavailable','The image picker could not open. Try again.');
    } finally {
      picking.current = false;
      if (alive.current) { setBusy(false); onBusyChange(false); }
    }
  }
  return <View style={{position:'relative'}}>
    {open && !disabled && <View style={{position:'absolute',bottom:48,right:0,minWidth:180,zIndex:20,
      backgroundColor:palette.surface,borderColor:palette.border,borderWidth:1,borderRadius:12,padding:4}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose image from gallery" onPress={() => {void pick(false);}}
        style={{flexDirection:'row',alignItems:'center',gap:10,padding:12}}>
        <Image size={18} color={palette.text}/><Text style={{fontFamily:fonts.regular,color:palette.text}}>Gallery</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" onPress={() => {void pick(true);}}
        style={{flexDirection:'row',alignItems:'center',gap:10,padding:12}}>
        <Camera size={18} color={palette.text}/><Text style={{fontFamily:fonts.regular,color:palette.text}}>Camera</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose audio file" disabled={audioDisabled} onPress={()=>{setOpen(false);onPickAudio();}}
        style={{flexDirection:'row',alignItems:'center',gap:10,padding:12,opacity:audioDisabled ? 0.45 : 1}}>
        <FileAudio size={18} color={palette.text}/><Text style={{fontFamily:fonts.regular,color:palette.text}}>Audio</Text>
      </Pressable>
    </View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Attach file" accessibilityState={{expanded:open,disabled:disabled || busy}}
      disabled={disabled || busy} onPress={() => setOpen(value => !value)}
      style={{width:48,height:48,alignItems:'center',justifyContent:'center',opacity:disabled || busy ? 0.45 : 1}}>
      <Paperclip size={22} color={palette.text}/>
    </Pressable>
  </View>;
}
