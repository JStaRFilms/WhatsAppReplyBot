import { File, Paths } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { randomUUID } from './uuid';
export interface AudioClip {uri:string;size:number;duration?:number;bytes:()=>Promise<Uint8Array<ArrayBuffer>>;release:()=>void}
export const MAX_AUDIO_BYTES=10*1024*1024;
export function clipFromUri(uri:string,duration?:number):AudioClip {
  const file=new File(uri);
  if(!file.exists || !file.size || file.size>MAX_AUDIO_BYTES){if(file.exists)file.delete();throw new Error('Choose non-empty audio under 10 MB.');}
  return {uri:file.uri,size:file.size,...(duration===undefined ? {} : {duration}),bytes:()=>file.bytes(),release:()=>{if(file.exists)file.delete();}};
}
export function clipFromAsset(asset:DocumentPickerAsset):AudioClip {return clipFromUri(asset.uri);}
export function cacheAudio(bytes:Uint8Array<ArrayBuffer>):AudioClip {
  const file=new File(Paths.cache,'otherme-audio-'+randomUUID()+'.mp3');
  file.create();file.write(bytes);return clipFromUri(file.uri);
}
