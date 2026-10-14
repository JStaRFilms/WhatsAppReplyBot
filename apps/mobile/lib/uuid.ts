import { getRandomValues } from 'expo-crypto';

// getRandomValues also works on HTTP LAN origins, unlike crypto.randomUUID.
export function randomUUID():string {
  const bytes=getRandomValues(new Uint8Array(16));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  view.setUint8(6,(view.getUint8(6)&15)|64);
  view.setUint8(8,(view.getUint8(8)&63)|128);
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
