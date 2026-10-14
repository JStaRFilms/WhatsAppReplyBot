import type { DocumentPickerAsset } from 'expo-document-picker';
import type { AudioClip } from './audio-clip';
export const MAX_AUDIO_BYTES=10*1024*1024;
export function clipFromBlob(blob:Blob,duration?:number):AudioClip {
  if(!blob.size || blob.size>MAX_AUDIO_BYTES)throw new Error('Choose non-empty audio under 10 MB.');
  const uri=URL.createObjectURL(blob);
  return {uri,size:blob.size,...(duration===undefined ? {} : {duration}),bytes:async()=>new Uint8Array(await blob.arrayBuffer()),release:()=>URL.revokeObjectURL(uri)};
}
export function clipFromAsset(asset:DocumentPickerAsset):AudioClip {
  if(!asset.file)throw new Error('This audio file could not be read.');
  return clipFromBlob(asset.file);
}
export function cacheAudio(bytes:Uint8Array<ArrayBuffer>):AudioClip {return clipFromBlob(new Blob([bytes],{type:'audio/mpeg'}));}
