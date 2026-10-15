import { spawn } from 'node:child_process';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AudioTranscript, DomainError, historyDigest, type Message, type Workflow, type AsrSource, type SqliteStore, type AsrProvenance } from '@replybot/core';

export const MAX_AUDIO_BYTES=10*1024*1024;
const PCM_LIMIT=300*16000*2;
function convert(input:Buffer,args:string[],limit:number,tooLarge:string):Promise<Buffer> {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.FFMPEG_PATH || 'ffmpeg',[
      '-hide_banner','-loglevel','error','-max_alloc','67108864','-threads','1','-filter_threads','1',
      '-protocol_whitelist','cache,pipe','-read_ahead_limit','10485760',...args,'pipe:1',
    ],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    const chunks:Buffer[]=[];let size=0;let failure:DomainError | undefined;
    const timer=setTimeout(()=>{failure=new DomainError('audio_conversion_timeout',504);child.kill();},20000);
    child.stdout.on('data',(chunk:Buffer)=>{
      size+=chunk.length;
      if(size>limit){failure=new DomainError(tooLarge,413);child.kill();}else chunks.push(chunk);
    });
    child.stderr.resume();child.stdin.on('error',()=>{});
    child.on('error',()=>{clearTimeout(timer);reject(new DomainError('media_encoder_unavailable',503));});
    child.on('close',code=>{clearTimeout(timer);if(failure)reject(failure);
      else if(code!==0 || !size)reject(new DomainError('invalid_audio',422));else resolve(Buffer.concat(chunks));});
    child.stdin.end(input);
  });
}
export async function normalizeAudio(input:Buffer,format:'ogg'|'mp3'):Promise<{bytes:Buffer;duration:number}> {
  if(!input.length)throw new DomainError('invalid_audio',422);
  if(input.length>MAX_AUDIO_BYTES)throw new DomainError('audio_too_large',413);
  // Decode all samples. A length limit rejects long input instead of sending a clipped note.
  const pcm=await convert(input,['-format_whitelist','ogg,wav,mp3,mov,matroska,webm,aac,flac',
    '-i','cache:pipe:0','-map','0:a:0','-vn','-ac','1','-ar','16000','-f','s16le'],PCM_LIMIT,'audio_too_long');
  const bytes=await convert(pcm,['-f','s16le','-ar','16000','-ac','1','-i','cache:pipe:0','-map_metadata','-1','-fflags','+bitexact',
    '-c:a',format==='ogg' ? 'libopus' : 'libmp3lame','-b:a','48k','-f',format],MAX_AUDIO_BYTES,'audio_too_large');
  return {bytes,duration:pcm.length/32000};
}
export function readableAudio(message:Message,now=Date.now()):boolean {
  const m=message.media;
  return m?.kind==='audio' && !m.viewOnce && m.access==='available'
    && (m.expiresAt===null || m.expiresAt>now) && (m.duration===undefined || m.duration<=300);
}
export const AUDIO_NORMALIZER='ffmpeg-mono16k-mp3-48k-v1';
export interface Transcriber {
  transcribe:(bytes:Buffer,guard:()=>void)=>Promise<AudioTranscript>;
  asrProvenance?:Pick<AsrProvenance,'adapter'|'model'>;
}
export interface AudioPersistence {
  store:SqliteStore; profileId:string;
  source:(m:Message)=>{message:Message;contentId:string;equivalents?:Message[]}|undefined;
  normalize?:typeof normalizeAudio;
}
export class AudioService {
  private readonly cache=new Map<string,{message:Message;identity:AsrSource;bytes:Buffer;expires:number}>();
  private closed=false;
  private readonly expiryTimer:ReturnType<typeof setInterval>;
  private readonly pending=new Map<string,Promise<Buffer>>();
  private readonly transcribing=new Map<string,Promise<AudioTranscript>>();
  constructor(private readonly load:(m:Message)=>Promise<Buffer>,private readonly current:(m:Message)=>boolean,
    private readonly now:()=>number, private readonly persistence:AudioPersistence) {
    this.expiryTimer=setInterval(()=>{
      this.persistence.store.pruneAsr(this.now());
      for(const [key,item] of this.cache){
        try{if(item.expires<=this.now())this.cache.delete(key);else this.check(item.message);}
        catch{this.cache.delete(key);}
      }
    },1000);
    this.expiryTimer.unref();
  }
  close():void {this.closed=true;clearInterval(this.expiryTimer);this.cache.clear();}
  private source(m:Message):{message:Message;identity:AsrSource;identities:AsrSource[]} {
    if(this.closed)throw new DomainError('media_unavailable',404);
    const source=this.persistence.source(m);
    if(!source || source.message.accountId!==m.accountId || !readableAudio(m,this.now())
      || !readableAudio(source.message,this.now()) || !this.current(source.message)) {
      this.persistence.store.suppressAsr(m.accountId,m.conversationId,m.transportId);
      for(const [key,item] of this.cache)if(item.message.accountId===m.accountId && item.message.transportId===m.transportId)this.cache.delete(key);
      throw new DomainError('media_unavailable',404);
    }
    const original=source.message;
    const identity:AsrSource={accountId:original.accountId,profileId:this.persistence.profileId,
      conversationId:original.conversationId,messageId:original.id,transportId:original.transportId,contentId:source.contentId};
    const identities=[identity,...(source.equivalents ?? []).map(copy=>({...identity,
      conversationId:copy.conversationId,messageId:copy.id,transportId:copy.transportId}))];
    for(const id of identities)this.persistence.store.invalidateAsrContent(id);
    for(const [key,item] of this.cache)if(identities.some(id=>id.accountId===item.identity.accountId
      && id.conversationId===item.identity.conversationId && id.messageId===item.identity.messageId
      && id.contentId!==item.identity.contentId))this.cache.delete(key);
    return {message:original,identity,identities};
  }
  check(m:Message):void {this.source(m);}
  async preview(m:Message):Promise<Buffer> {
    const initial=this.source(m),key=historyDigest(initial.identity);
    const check=()=>{
      const current=this.source(m);
      if(historyDigest(current.identity)!==key)throw new DomainError('media_unavailable',404);
      return current;
    };
    for(const [key,value] of this.cache)if(value.expires<=this.now())this.cache.delete(key);
    const cached=this.cache.get(key);if(cached)return cached.bytes;
    let task=this.pending.get(key);
    if(!task){
      if(this.pending.size>=2)throw new DomainError('audio_busy',503);
      task=(async()=>{
        const input=await this.load(initial.message);check();
        const {bytes}=await (this.persistence.normalize ?? normalizeAudio)(input,'mp3');const current=check();
        this.cache.set(key,{message:m,identity:current.identity,bytes,expires:Math.min(this.now()+300000,current.message.media?.expiresAt ?? Infinity)});
        for(const id of this.cache.keys()){if(this.cache.size<=10)break;this.cache.delete(id);}
        return bytes;
      })().finally(()=>this.pending.delete(key));this.pending.set(key,task);
    }
    const bytes=await task;check();return bytes;
  }
  async transcript(m:Message,model:Transcriber,guard:()=>void):Promise<AudioTranscript> {
    guard();const initial=this.source(m),{identity}=initial,key=historyDigest(identity),store=this.persistence.store;
    const exportGuard=()=>{
      guard();const current=this.source(m);
      if(historyDigest(current.identity)!==key)throw new DomainError('media_unavailable',404);
      return current;
    };
    const lookup=(identities:AsrSource[])=>{
      const saved=identities.map(source=>store.asrAttempt(source,this.now()));
      return saved.find(row=>row?.state==='complete' && row.transcript!==null) ?? saved.find(row=>row!==undefined);
    };
    let task=this.transcribing.get(key);
    if(!task){
      const saved=lookup(initial.identities);
      if(saved?.state==='complete' && saved.transcript){exportGuard();return saved.transcript;}
      if(saved)throw new DomainError('audio_attempt_unavailable',409);
      if(this.transcribing.size>=2)throw new DomainError('audio_busy',503);
      task=(async()=>{
        const bytes=await this.preview(m);const current=exportGuard();
        const saved=lookup(current.identities);
        if(saved?.state==='complete' && saved.transcript){exportGuard();return saved.transcript;}
        if(saved)throw new DomainError('audio_attempt_unavailable',409);
        const attemptId=store.reserveAsr(identity,current.message.media?.expiresAt ?? null,this.now());
        try {
          exportGuard();
          const transcript=AudioTranscript.parse(await model.transcribe(bytes,exportGuard));exportGuard();
          if(!store.completeAsr(identity,attemptId,transcript,{...model.asrProvenance ?? {adapter:'custom',model:'unspecified'},normalizer:AUDIO_NORMALIZER},this.now()))
            throw new DomainError('audio_attempt_unavailable',409);
          return transcript;
        }catch(error){
          store.unknownAsr(identity.accountId,attemptId);
          if(error instanceof DomainError)throw error;
          throw new DomainError('transcription_unknown',502);
        }
      })().finally(()=>this.transcribing.delete(key));this.transcribing.set(key,task);
    }
    const result=await task;exportGuard();return result;
  }
}
export function registerAudioUploads(app:FastifyInstance,flow:Workflow):void {
  let active=0;
  app.post('/v1/conversations/:id/audio-uploads',{bodyLimit:MAX_AUDIO_BYTES,errorHandler(error,_request,reply){
    if(error instanceof DomainError)return reply.code(error.status).send({error:error.code});
    if(error instanceof z.ZodError)return reply.code(422).send({error:'invalid_request'});
    if(error.code==='FST_ERR_CTP_BODY_TOO_LARGE')return reply.code(413).send({error:'audio_too_large'});
    return reply.code(500).send({error:'service_error'});
  }}, async(request,reply)=>{
    const {id}=z.object({id:z.string().min(1).max(128)}).parse(request.params);
    const requestId=z.string().min(1).max(128).parse(request.headers['x-request-id']);flow.conversation(id);
    if(!Buffer.isBuffer(request.body))throw new DomainError('binary_audio_required',415);
    if(active>=2)throw new DomainError('audio_busy',503);
    active++;
    try {
      const audio=await normalizeAudio(request.body,'ogg');
      return reply.header('Cache-Control','no-store').send(flow.stageAudio(id,{...audio,mime:'audio/ogg; codecs=opus'},requestId));
    }finally{active--;}
  });
}
