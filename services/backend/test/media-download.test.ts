import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createCipheriv,createHash,createHmac } from 'node:crypto';
import { getMediaKeys } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import { mediaUrl,downloadAttachment } from '../src/whatsapp-media.ts';
import { MediaService } from '../src/media.ts';
import { normalizeWhatsApp } from '../src/whatsapp-normalize.ts';

test('resolved media paths cannot escape the WhatsApp host or add credentials',()=>{
  assert.equal(mediaUrl({url:'https://mmg.whatsapp.net/original',directPath:'/v/safe?x=1'}).href,'https://mmg.whatsapp.net/v/safe?x=1');
  for(const input of [{url:'https://mmg.whatsapp.net/synthetic',directPath:'@127.0.0.1:8443/internal'},
    {directPath:'//127.0.0.1/internal'},{directPath:'/\\127.0.0.1/internal'},
    {url:'https://mmg.whatsapp.net@127.0.0.1/internal'},{url:'http://mmg.whatsapp.net/file'},{url:'https://mmg.whatsapp.net:8443/file'}])
    assert.throws(()=>mediaUrl(input),/media_host_denied/);
});
test('media HTTP uses real cancellation, forbids redirects and validates decrypted integrity',async()=>{
  const bytes=await sharp({create:{width:64,height:64,channels:3,background:'#ff0000'}}).png().toBuffer();
  const mediaKey=Buffer.alloc(32,7);const keys=await getMediaKeys(mediaKey,'image');assert.ok(keys.macKey);
  const cipher=createCipheriv('aes-256-cbc',keys.cipherKey,keys.iv);
  const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
  const encrypted=Buffer.concat([ciphertext,createHmac('sha256',keys.macKey).update(keys.iv).update(ciphertext).digest().subarray(0,10)]);
  let forbidden=0;
  const server=createServer((request,response)=>{
    if(request.url==='/forbidden'){forbidden++;response.end(encrypted);}
    else if(request.url==='/redirect'){response.writeHead(302,{location:'/forbidden'});response.end();}
    else if(request.url==='/stall-body'){response.writeHead(200);response.write(encrypted.subarray(0,16));}
    else if(request.url==='/stall-headers')return;
    else if(request.url==='/corrupt'){const bad=Buffer.from(encrypted);bad.writeUInt8(bad.readUInt8(bad.length-1)^1,bad.length-1);response.end(bad);}
    else response.end(encrypted);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address && typeof address!=='string');
  const fetcher:typeof fetch=async(input,init)=>{const url=new URL(String(input));assert.equal(url.hostname,'mmg.whatsapp.net');assert.equal(init?.redirect,'error');assert.ok(init?.signal);
    return fetch('http://127.0.0.1:'+address.port+url.pathname,init);};
  const attachment=(path:string)=>({url:'https://mmg.whatsapp.net'+path,mediaKey,fileSha256:createHash('sha256').update(bytes).digest()});
  try{
    assert.deepEqual(await downloadAttachment(attachment('/good'),'image',AbortSignal.timeout(2000),fetcher),bytes);
    await assert.rejects(downloadAttachment(attachment('/corrupt'),'image',AbortSignal.timeout(2000),fetcher),/media_integrity_failed/);
    await assert.rejects(downloadAttachment(attachment('/redirect'),'image',AbortSignal.timeout(2000),fetcher));assert.equal(forbidden,0);
    for(const path of ['/stall-headers','/stall-body']){const started=Date.now();
      await assert.rejects(downloadAttachment(attachment(path),'image',AbortSignal.timeout(100),fetcher));assert.ok(Date.now()-started<1500);}
    const m=normalizeWhatsApp({key:{id:'test',remoteJid:'123@s.whatsapp.net'},messageTimestamp:1700000000,message:{imageMessage:{}}},'test','123@s.whatsapp.net','live');assert.ok(m);
    const service=new MediaService(message=>downloadAttachment(attachment(message.id==='good' ? '/good' : '/stall-headers'),'image',AbortSignal.timeout(100),fetcher),()=>true);
    const failed=await Promise.allSettled([service.preview({...m,id:'stall-1'}),service.preview({...m,id:'stall-2'})]);assert.ok(failed.every(r=>r.status==='rejected'));
    assert.equal((await service.preview({...m,id:'good'})).mime,'image/png');
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
