import { createDecipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getMediaKeys, type proto } from '@whiskeysockets/baileys';
import { DomainError } from '@replybot/core';

type Attachment = proto.Message.IImageMessage | proto.Message.IStickerMessage | proto.Message.IVideoMessage;
const maxBytes=10*1024*1024;
export function mediaUrl(attachment:Attachment):URL {
  const check=(url:URL)=>{
    if(url.protocol!=='https:' || url.username || url.password || url.port && url.port!=='443'
      || !/(^|\.)whatsapp\.(net|com)$/.test(url.hostname))throw new DomainError('media_host_denied',422);
    return url;
  };
  const original=attachment.url ? check(new URL(attachment.url)) : undefined;
  const path=attachment.directPath;
  if(path && (!path.startsWith('/') || path.startsWith('//') || /[\\\s]/.test(path)))throw new DomainError('media_host_denied',422);
  const resolved=path ? new URL((original?.origin ?? 'https://mmg.whatsapp.net')+path) : original;
  if(!resolved)throw new DomainError('media_unavailable',404);
  return check(resolved);
}
export async function mediaDeadline<T>(work:Promise<T>,signal:AbortSignal):Promise<T> {
  let listener:()=>void=()=>{};
  const cancelled=new Promise<never>((_resolve,reject)=>{
    listener=()=>reject(new DomainError('media_download_timeout',504));
    if(signal.aborted)listener();else signal.addEventListener('abort',listener,{once:true});
  });
  try{return await Promise.race([work,cancelled]);}
  finally{signal.removeEventListener('abort',listener);}
}
export async function downloadAttachment(attachment:Attachment,kind:'image'|'sticker'|'video',signal:AbortSignal,
  fetcher:typeof fetch=fetch):Promise<Buffer> {
  const url=mediaUrl(attachment);
  if(signal.aborted)throw new DomainError('media_download_timeout',504);
  const response=await mediaDeadline(fetcher(url.href,{method:'GET',redirect:'error',signal,headers:{Origin:'https://web.whatsapp.com'}}),signal);
  if(!response.ok)throw new DomainError('media_download_failed',[404,410].includes(response.status) ? response.status : 502);
  if(!response.body || Number(response.headers.get('content-length') ?? 0)>maxBytes+26)throw new DomainError('media_too_large',413);
  const reader=response.body.getReader();const chunks:Buffer[]=[];let size=0;
  try{for(;;){const part=await mediaDeadline(reader.read(),signal);if(part.done)break;
    size+=part.value.byteLength;if(size>maxBytes+26)throw new DomainError('media_too_large',413);chunks.push(Buffer.from(part.value));}}
  finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
  const encrypted=Buffer.concat(chunks);
  if(encrypted.length<26 || !attachment.mediaKey)throw new DomainError('media_integrity_failed',422);
  const {cipherKey,iv,macKey}=await getMediaKeys(attachment.mediaKey,kind);
  if(!macKey)throw new DomainError('media_integrity_failed',422);
  const ciphertext=encrypted.subarray(0,-10);const mac=encrypted.subarray(-10);
  const expected=createHmac('sha256',macKey).update(iv).update(ciphertext).digest().subarray(0,10);
  if(!timingSafeEqual(mac,expected))throw new DomainError('media_integrity_failed',422);
  const decipher=createDecipheriv('aes-256-cbc',cipherKey,iv);
  const bytes=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
  if(bytes.length>maxBytes)throw new DomainError('media_too_large',413);
  if(attachment.fileSha256){const hash=Buffer.from(attachment.fileSha256);const actual=createHash('sha256').update(bytes).digest();
    if(hash.length!==actual.length || !timingSafeEqual(hash,actual))throw new DomainError('media_integrity_failed',422);}
  return bytes;
}
