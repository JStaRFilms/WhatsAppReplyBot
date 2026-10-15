import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { DomainError, type Message, type ModelContext } from '@replybot/core';
import type { MediaVariant } from '@replybot/core/api';

export interface VisualFrame { messageId: string; dataUrl: string; sampled: boolean }
export interface MediaPreview { bytes: Buffer; mime: 'image/png' | 'image/gif' }
export interface DisplayBytes {bytes:Buffer;mime:'image/png'|'image/gif'|'image/jpeg'|'video/mp4'}
interface Prepared {display:DisplayBytes; input?:Buffer; frames?:VisualFrame[]; expires:number}
const supported = new Set(['image','sticker','animated_sticker','gif']);
export function readableMedia(message: Message, now = Date.now()): boolean {
  const m = message.media;
  return !!m && supported.has(m.kind) && !m.viewOnce && m.access !== 'expired'
    && (m.expiresAt === null || m.expiresAt > now);
}
function encodeGif(input: Buffer, filters: string, model: boolean): Promise<Buffer> {
  return new Promise((resolve,reject) => {
    const args = ['-hide_banner','-loglevel','error','-max_alloc','67108864','-threads','1',
      '-filter_threads','1','-protocol_whitelist','cache,pipe','-read_ahead_limit','10485760','-i','cache:pipe:0','-t','8','-an',
      '-vf',filters,'-frames:v',model ? '2' : '48',
      ...(model ? ['-c:v','mjpeg','-q:v','4','-f','image2pipe'] : ['-f','gif']), 'pipe:1'];
    const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg',args,{ windowsHide:true,stdio:['pipe','pipe','pipe'] });
    const chunks: Buffer[] = []; let size = 0; let failure: DomainError | undefined;
    const timer = setTimeout(() => { failure = new DomainError('media_conversion_timeout',504); child.kill(); },10000);
    child.stdout.on('data',(chunk:Buffer) => {
      size += chunk.length;
      if (size > 4*1024*1024) { failure = new DomainError('media_too_large',413); child.kill(); }
      else chunks.push(chunk);
    });
    child.stderr.resume(); child.stdin.on('error',()=>{});
    child.on('error',() => { clearTimeout(timer); reject(new DomainError('media_encoder_unavailable',503)); });
    child.on('close',code => { clearTimeout(timer); if (failure) reject(failure);
      else if (code !== 0 || !size) reject(new DomainError('media_unavailable',422));
      else resolve(Buffer.concat(chunks)); });
    child.stdin.end(input);
  });
}
function jpegFrames(bytes: Buffer): Buffer[] {
  const frames: Buffer[] = []; let start = bytes.indexOf(Buffer.from([255,216]));
  while (start >= 0 && frames.length < 2) {
    const end = bytes.indexOf(Buffer.from([255,217]),start+2); if (end < 0) break;
    frames.push(bytes.subarray(start,end+2)); start = bytes.indexOf(Buffer.from([255,216]),end+2);
  }
  return frames;
}
export class MediaService {
  private readonly cache = new Map<string,Prepared>();
  private readonly pending = new Map<string,Promise<Prepared>>();
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  constructor(private readonly load: (message:Message,ownerVideo?:boolean) => Promise<Buffer>,
    private readonly current: (message:Message) => boolean, private readonly now = Date.now,
    private readonly version = (m:Message) => JSON.stringify(m.media)) {}
  private check(message:Message): void {
    if (!readableMedia(message,this.now()) || !this.current(message)) throw new DomainError('media_unavailable',404);
  }
  private size(item:Prepared):number {
    return item.display.bytes.length+(item.input?.length ?? 0)+(item.frames?.reduce((n,f)=>n+f.dataUrl.length,0) ?? 0);
  }
  private trim():void {
    let total=[...this.cache.values()].reduce((n,item)=>n+this.size(item),0);
    for(const [key,item] of this.cache){
      if(this.cache.size<=20 && total<=24*1024*1024 && item.expires>this.now())continue;
      this.cache.delete(key);total-=this.size(item);
    }
  }
  private async prepare(key:string,check:()=>void,work:()=>Promise<Prepared>):Promise<Prepared> {
    check();this.trim();
    const saved=this.cache.get(key);
    if(saved){check();this.cache.delete(key);this.cache.set(key,saved);return saved;}
    let task=this.pending.get(key);
    if(!task){
      if(this.pending.size>=24)throw new DomainError('media_busy',503);
      const deadline=performance.now()+45000;
      let timer:ReturnType<typeof setTimeout>;
      const checkDeadline=()=>{if(performance.now()>=deadline)throw new DomainError('media_preparation_timeout',504);check();};
      const execution=(async()=>{
        if(this.active>=2)await new Promise<void>((resolve,reject)=>{
          let waiting=true;
          const start=()=>{if(!waiting)return;waiting=false;clearTimeout(timer);resolve();};
          timer=setTimeout(()=>{if(waiting){waiting=false;const index=this.waiting.indexOf(start);if(index>=0)this.waiting.splice(index,1);
            reject(new DomainError('media_preparation_timeout',504));}},Math.max(0,deadline-performance.now()));
          this.waiting.push(start);
        });
        this.active++;
        try{
          checkDeadline();const result=await work();checkDeadline();this.cache.set(key,result);this.trim();return result;
        }finally{this.active--;this.waiting.shift()?.();}
      })();
      let totalTimer:ReturnType<typeof setTimeout>;
      const expired=new Promise<never>((_resolve,reject)=>{totalTimer=setTimeout(()=>reject(new DomainError('media_preparation_timeout',504)),45000);});
      task=Promise.race([execution,expired]).finally(()=>clearTimeout(totalTimer));
      this.pending.set(key,task);
      void task.finally(()=>this.pending.delete(key)).catch(()=>{});
    }
    const result=await task;
    // Every coalesced caller checks its own source, not just the first caller's guard.
    check();return result;
  }
  private async convert(message:Message,variant:MediaVariant,check:()=>void):Promise<Prepared> {
    const bytes=await this.load(message,variant==='video');check();
    if(!bytes.length || bytes.length>10*1024*1024)throw new DomainError('media_too_large',413);
    const expires=Math.min(this.now()+300000,message.media?.expiresAt ?? Infinity);
    if(variant==='video'){
      if(bytes.length<12 || bytes.toString('ascii',4,8)!=='ftyp')throw new DomainError('media_unsupported',422);
      return {display:{bytes,mime:'video/mp4'},expires};
    }
    if(variant==='image'){
      const metadata=await sharp(bytes,{limitInputPixels:32*1024*1024}).timeout({seconds:5}).metadata();check();
      if(!['jpeg','png','webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1)>1)throw new DomainError('media_unsupported',422);
      const output=await sharp(bytes,{limitInputPixels:32*1024*1024}).rotate()
        .resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'})
        .jpeg({quality:85}).timeout({seconds:5}).toBuffer();check();
      if(output.length>4*1024*1024)throw new DomainError('media_too_large',413);
      return {display:{bytes:output,mime:'image/jpeg'},expires};
    }
    const animation=message.media?.kind==='gif' || message.media?.kind==='animated_sticker';
    let preview:Buffer;
    if(message.media?.kind==='gif')preview=await encodeGif(bytes,'fps=6,scale=360:360:force_original_aspect_ratio=decrease',false);
    else{
      const metadata=await sharp(bytes,{limitInputPixels:32*1024*1024}).timeout({seconds:5}).metadata();check();
      if(!['jpeg','png','webp','gif'].includes(metadata.format ?? ''))throw new DomainError('media_unavailable',422);
      let pages=1;let duration=metadata.delay?.[0] ?? 100;
      while(animation && pages<Math.min(metadata.pages ?? 1,48) && duration<8000){duration+=metadata.delay?.[pages] ?? 100;pages++;}
      const pipeline=sharp(bytes,{pages,animated:animation,limitInputPixels:32*1024*1024}).rotate()
        .resize({width:animation?360:768,height:animation?360:768,fit:'inside',withoutEnlargement:true}).timeout({seconds:5});
      preview=await(animation?pipeline.gif({effort:2}):pipeline.png()).toBuffer();
    }
    check();if(preview.length>4*1024*1024)throw new DomainError('media_too_large',413);
    return {display:{bytes:preview,mime:animation?'image/gif':'image/png'},input:bytes,expires};
  }
  validateSource(accountId:string,conversationId:string,messageId:string,variant:MediaVariant,version:string|null):void {
    for(const key of this.cache.keys()){
      const parts:unknown=JSON.parse(key);
      if(!Array.isArray(parts) || parts[0]!==accountId || parts[1]!==conversationId || parts[2]!==messageId)continue;
      if(version===null || (parts[3]===variant || variant==='preview' && parts[3]==='model') && parts[4]!==version)this.cache.delete(key);
    }
  }
  async display(message:Message,variant:MediaVariant,sourceVersion:string,guard:()=>void):Promise<DisplayBytes> {
    return (await this.prepare(JSON.stringify([message.accountId,message.conversationId,message.id,variant,sourceVersion]),guard,
      ()=>this.convert(message,variant,guard))).display;
  }
  async preview(message:Message):Promise<MediaPreview> {
    const version=this.version(message);
    const check=()=>{this.check(message);if(this.version(message)!==version)throw new DomainError('media_unavailable',404);};
    const value=await this.display(message,'preview',version,check);
    if(value.mime!=='image/png' && value.mime!=='image/gif')throw new DomainError('media_unavailable',404);
    return {bytes:value.bytes,mime:value.mime};
  }
  async visuals(context:ModelContext):Promise<VisualFrame[]> {
    const selected=context.messages.filter(m=>readableMedia(m,this.now())).slice(-2);
    const frames:VisualFrame[]=[];
    for(const message of selected){
      try{
        const version=this.version(message);
        const check=()=>{this.check(message);if(this.version(message)!==version)throw new DomainError('media_unavailable',404);};check();
        const key=JSON.stringify([message.accountId,message.conversationId,message.id,'model',version]);
        const prepared=await this.prepare(key,check,async()=>{
          const previewKey=JSON.stringify([message.accountId,message.conversationId,message.id,'preview',version]);
          const input=this.cache.get(previewKey)?.input ?? await this.load(message);check();
          if(!input.length || input.length>10*1024*1024)throw new DomainError('media_too_large',413);
          const animation=message.media?.kind==='gif' || message.media?.kind==='animated_sticker';
          let images:Buffer[]=[];
          if(message.media?.kind==='gif')images=jpegFrames(await encodeGif(input,"select='isnan(prev_selected_t)+gte(t-prev_selected_t,2)',scale=768:768:force_original_aspect_ratio=decrease",true));
          else{
            const metadata=await sharp(input,{limitInputPixels:32*1024*1024}).timeout({seconds:5}).metadata();check();
            if(!['jpeg','png','webp','gif'].includes(metadata.format ?? ''))throw new DomainError('media_unavailable',422);
            let pages=1;let duration=metadata.delay?.[0] ?? 100;
            while(animation && pages<Math.min(metadata.pages ?? 1,48) && duration<8000){duration+=metadata.delay?.[pages] ?? 100;pages++;}
            const indexes=animation && pages>1?[0,pages-1]:[0];
            for(const page of indexes)images.push(await sharp(input,{page,pages:1,limitInputPixels:32*1024*1024})
              .rotate().resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'})
              .jpeg({quality:75}).timeout({seconds:5}).toBuffer());
          }
          check();if(!images.length || images.some(b=>b.length>1024*1024))throw new DomainError('media_too_large',413);
          return {display:{bytes:Buffer.alloc(0),mime:'image/png'},frames:images.map(b=>({messageId:message.id,
            dataUrl:'data:image/jpeg;base64,'+b.toString('base64'),sampled:animation})),expires:Math.min(this.now()+300000,message.media?.expiresAt ?? Infinity)};
        });
        check();frames.push(...prepared.frames ?? []);
      }catch{ /* Missing attachments remain unavailable in the transcript. */ }
    }
    return frames.slice(0,4);
  }
}
