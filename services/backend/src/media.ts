import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { DomainError, type Message, type ModelContext } from '@replybot/core';

export interface VisualFrame { messageId: string; dataUrl: string; sampled: boolean }
export interface MediaPreview { bytes: Buffer; mime: 'image/png' | 'image/gif' }
interface Prepared { preview: MediaPreview; frames: VisualFrame[]; expires: number }
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
  constructor(private readonly load: (message:Message) => Promise<Buffer>,
    private readonly current: (message:Message) => boolean, private readonly now = Date.now) {}
  private check(message:Message): void {
    if (!readableMedia(message,this.now()) || !this.current(message)) throw new DomainError('media_unavailable',404);
  }
  private async prepare(message:Message): Promise<Prepared> {
    this.check(message);
    const key = JSON.stringify([message.accountId,message.conversationId,message.id]);
    for (const [id,item] of this.cache) if (item.expires <= this.now()) this.cache.delete(id);
    const saved = this.cache.get(key);
    if (saved) { this.cache.delete(key); this.cache.set(key,saved); return saved; }
    const running = this.pending.get(key); if (running) return running;
    if (this.pending.size >= 24) throw new DomainError('media_busy',503);
    const task = (async () => {
      if (this.active >= 2) await new Promise<void>(resolve=>this.waiting.push(resolve));
      this.active++;
      try {
        this.check(message);
        const bytes = await this.load(message); this.check(message);
        if (!bytes.length || bytes.length > 10*1024*1024) throw new DomainError('media_too_large',413);
        const animation = message.media?.kind === 'gif' || message.media?.kind === 'animated_sticker';
        let preview:Buffer;let images:Buffer[];
        if(message.media?.kind==='gif'){
          const model=await encodeGif(bytes,"select='isnan(prev_selected_t)+gte(t-prev_selected_t,2)',scale=768:768:force_original_aspect_ratio=decrease",true);
          this.check(message);
          preview=await encodeGif(bytes,'fps=6,scale=360:360:force_original_aspect_ratio=decrease',false);
          images=jpegFrames(model);
        }else{
          const metadata=await sharp(bytes,{limitInputPixels:32*1024*1024}).metadata();
          if(!['jpeg','png','webp','gif'].includes(metadata.format ?? ''))throw new DomainError('media_unavailable',422);
          let pages=1;let duration=metadata.delay?.[0] ?? 100;
          while(animation && pages<Math.min(metadata.pages ?? 1,48) && duration<8000){duration+=metadata.delay?.[pages] ?? 100;pages++;}
          const indexes=pages>1 ? [0,pages-1] : [0];
          images=[];
          for(const page of indexes)images.push(await sharp(bytes,{page,pages:1,limitInputPixels:32*1024*1024})
            .resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:75}).timeout({seconds:5}).toBuffer());
          this.check(message);
          const pipeline=sharp(bytes,{pages,animated:animation,limitInputPixels:32*1024*1024})
            .resize({width:animation ? 360 : 768,height:animation ? 360 : 768,fit:'inside',withoutEnlargement:true}).timeout({seconds:5});
          preview=await (animation ? pipeline.gif({effort:2}) : pipeline.png()).toBuffer();
        }
        this.check(message);
        if(preview.length>4*1024*1024 || images.some(b=>b.length>1024*1024))throw new DomainError('media_too_large',413);
        const frames = images.map(frame=>({ messageId:message.id,dataUrl:'data:image/jpeg;base64,'+frame.toString('base64'),sampled:animation }));
        if (!frames.length) throw new DomainError('media_unavailable',422);
        const result:Prepared = { preview:{bytes:preview,mime:animation ? 'image/gif' : 'image/png'},frames,
          expires:Math.min(this.now()+300000,message.media?.expiresAt ?? Infinity) };
        this.cache.set(key,result);
        let total = [...this.cache.values()].reduce((n,v)=>n+v.preview.bytes.length+v.frames.reduce((s,f)=>s+f.dataUrl.length,0),0);
        for (const [id,item] of this.cache) {
          if (this.cache.size <= 20 && total <= 24*1024*1024) break;
          this.cache.delete(id); total -= item.preview.bytes.length+item.frames.reduce((n,f)=>n+f.dataUrl.length,0);
        }
        return result;
      } finally { this.active--; this.waiting.shift()?.(); }
    })();
    this.pending.set(key,task);
    try { return await task; } finally { this.pending.delete(key); }
  }
  async preview(message:Message):Promise<MediaPreview> { return (await this.prepare(message)).preview; }
  async visuals(context:ModelContext):Promise<VisualFrame[]> {
    const selected = context.messages.filter(m=>readableMedia(m,this.now())).slice(-2);
    const frames:VisualFrame[] = [];
    for (const message of selected) {
      try { frames.push(...(await this.prepare(message)).frames); }
      catch { /* Missing attachments stay explicitly unavailable in the transcript. */ }
    }
    return frames.slice(0,4);
  }
}
