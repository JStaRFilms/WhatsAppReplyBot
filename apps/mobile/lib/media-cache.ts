import { z } from 'zod';
import type { MediaSource, MediaVariant } from '@replybot/core/api';
import type { Message } from '@replybot/core/contracts';
import { ApiClient, ApiError } from './api';
import { createMediaStorage } from './media-cache-storage';

export const MediaRecordSchema=z.object({key:z.array(z.string().max(2048)).length(9),size:z.number().int().positive().max(10*1024*1024),
  mime:z.enum(['image/png','image/gif','image/jpeg','video/mp4']),usedAt:z.number().finite(),expiresAt:z.number().nullable(),pendingPurge:z.boolean()}).strict();
export type MediaRecord=z.infer<typeof MediaRecordSchema>;
export type MediaReference=Pick<Message,'id'|'accountId'|'conversationId'|'transportId'>;
export interface StoredMedia {uri:string;release:()=>void}
export interface MediaStorage {
  persistent:boolean;list:()=>Promise<unknown[]>;read:(record:MediaRecord)=>Promise<StoredMedia | null>;
  write:(record:MediaRecord,bytes:Uint8Array<ArrayBuffer>)=>Promise<void>;touch:(record:MediaRecord)=>Promise<void>;
  remove:(record:MediaRecord)=>Promise<void>;sweep:(keys:readonly string[][])=>Promise<void>;
}
export interface MediaHandle {
  readonly uri:string;readonly sourceVersion:string;readonly expiresAt:number | null;readonly mime:string;readonly size:number;
  revalidate:()=>Promise<boolean>;getSnapshot:()=>boolean;subscribe:(listener:()=>void)=>()=>void;release:()=>void;
}
type Validation={source:MediaSource;deadline:number;reference:MediaReference};
type HandleState={valid:boolean;released:boolean;deadline:number;role:'thumbnail'|'viewer';listeners:Set<()=>void>};
type Live={record:MediaRecord;resource:StoredMedia;handles:Set<HandleState>;validation:Validation};
const MiB=1024*1024,week=7*24*60*60*1000;
const pins=new Map<string,{key:string[];count:number}>();
const pendingPurge=new Set<string>();
let diskLane:Promise<unknown>=Promise.resolve();
function onDisk<T>(work:()=>Promise<T>):Promise<T>{const next=diskLane.catch(()=>{}).then(work);diskLane=next;return next;}
function pin(key:string[]){const id=JSON.stringify(key),old=pins.get(id);pins.set(id,{key,count:(old?.count ?? 0)+1});return()=>{const value=pins.get(id);if(value && --value.count===0)pins.delete(id);};}
let activeReads=0,transientBytes=0,liveSlots=0,liveByteReservation=0,viewerSlots=0;
const waiting:{size:number;start:()=>void}[]=[];
function boundedRead<T>(size:number,work:()=>Promise<T>):Promise<T>{return new Promise((resolve,reject)=>{
  if(waiting.length>=24){reject(new Error('Media is busy. Retry explicitly.'));return;}
  const queued={size,start:()=>{clearTimeout(timer);activeReads++;transientBytes+=size;
    void work().then(resolve,reject).finally(()=>{activeReads--;transientBytes-=size;drain();});}};
  const timer=setTimeout(()=>{const index=waiting.indexOf(queued);if(index>=0){waiting.splice(index,1);reject(new Error('Media read timed out. Retry explicitly.'));}},45000);
  waiting.push(queued);drain();
});}
function drain(){while(activeReads<2){const index=waiting.findIndex(item=>transientBytes+item.size<=24*MiB);if(index<0)return;const next=waiting.splice(index,1)[0];next?.start();}}
export function normalizeMediaService(base:string):string{const url=new URL(base);url.username='';url.password='';url.search='';url.hash='';return url.toString().replace(/\/+$/,'');}

// Downloaded history bytes have no ownership relationship to submitted composer media.
export class MediaCache {
  private readonly live=new Map<string,Live>();
  private readonly validations=new Map<string,Validation>();
  private readonly sourceEpochs=new Map<string,number>();
  private sourceEpoch(reference:MediaReference){return this.sourceEpochs.get(JSON.stringify([reference.conversationId,reference.id])) ?? 0;}
  private readonly metadata=new Map<string,{reference:MediaReference;task:Promise<Validation>}>();
  private readonly downloads=new Map<string,{reference:MediaReference;task:Promise<Live>;abort:AbortController;waiters:number}>();
  private readonly controllers=new Set<AbortController>();
  private readonly listeners=new Set<()=>void>();
  private readonly base:string;
  private namespace:string | undefined;
  private active=true;
  private foreground=true;
  private covered=false;
  private slots=0;
  private activity=0;
  private expiryTimer:ReturnType<typeof setTimeout> | undefined;
  private timer:ReturnType<typeof setInterval> | undefined;
  private failure:string | null=null;
  constructor(private readonly client:ApiClient,private readonly clock:{now:()=>number},private readonly storage:MediaStorage=createMediaStorage(),
    private readonly monotonic:()=>number=()=>performance.now()) {this.base=client.scope?normalizeMediaService(client.baseUrl):'';}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getNotice=()=>this.failure ?? (!this.storage.persistent?'Media stays only for this browser session. Private persistent storage is unavailable.':null);
  private trimMetadata(){
    while(this.validations.size>200){const id=[...this.validations.keys()].find(id=>![...this.live.values()].some(live=>this.sourceKey(live.validation.reference,live.validation.source.variant)===id));if(!id)break;this.validations.delete(id);}
    const busy=new Set([...this.live.values()].map(live=>JSON.stringify([live.record.key[4],live.record.key[5]])));
    for(const {reference} of this.metadata.values())busy.add(JSON.stringify([reference.conversationId,reference.id]));
    for(const {reference} of this.downloads.values())busy.add(JSON.stringify([reference.conversationId,reference.id]));
    while(this.sourceEpochs.size>200){const id=[...this.sourceEpochs.keys()].find(id=>!busy.has(id));if(!id)break;this.sourceEpochs.delete(id);}
  }
  private notice(message:string | null){this.failure=message;for(const listener of this.listeners)listener();}
  private check(){this.client.assertActive();if(!this.active || !this.foreground || !this.client.scope)throw new Error('Media display is inactive.');}
  private sourceKey(reference:MediaReference,variant:MediaVariant){return JSON.stringify([reference.conversationId,reference.id,variant]);}
  private key(reference:MediaReference,source:MediaSource):string[]{const scope=this.client.scope;if(!scope)throw new Error('No accepted media account.');
    return [this.base,source.cacheNamespace,scope.profileId,scope.accountId,source.conversationId,source.messageId,reference.transportId,source.sourceVersion,source.variant];}
  private sameReference(key:string[],reference:MediaReference){return key[0]===this.base && key[2]===this.client.scope?.profileId && key[3]===reference.accountId && key[4]===reference.conversationId && key[5]===reference.id;}
  private async records(){return (await this.storage.list()).flatMap(value=>{const parsed=MediaRecordSchema.safeParse(value);return parsed.success?[parsed.data]:[];});}
  private async remove(record:MediaRecord,ownRead=false):Promise<boolean>{
    const id=JSON.stringify(record.key);pendingPurge.add(id);
    if(pins.has(id) && !(ownRead && pins.get(id)?.count===1)){await this.storage.touch({...record,pendingPurge:true}).catch(()=>{});return false;}
    try {await this.storage.remove(record);pendingPurge.delete(id);return true;}
    catch {await this.storage.touch({...record,pendingPurge:true}).catch(()=>{});return false;}
  }
  private async sweepLocked(){
    const records=await this.records(),kept:MediaRecord[]=[];let failed=false;
    for(const record of records){const stale=record.pendingPurge || pendingPurge.has(JSON.stringify(record.key)) || record.usedAt<this.clock.now()-week
      || record.usedAt>this.clock.now()+60000 || record.expiresAt!==null && record.expiresAt<=this.clock.now();
      if(stale){if(!await this.remove(record)){kept.push({...record,pendingPurge:true});if(!pins.has(JSON.stringify(record.key)))failed=true;}}
      else kept.push(record);
    }
    await this.storage.sweep([...kept.map(record=>record.key),...[...pins.values()].map(value=>value.key)]);
    if(failed)throw new Error('Media cleanup is pending. New downloads are stopped.');return kept;
  }
  sweep=()=>onDisk(()=>this.sweepLocked()).then(()=>this.notice(null),()=>{this.notice('Media cleanup is pending. New downloads are stopped.');});
  private invalidateLive(live:Live){for(const state of live.handles)if(state.valid){state.valid=false;for(const listener of state.listeners)listener();}}
  private revokeSource(reference:MediaReference,variant?:MediaVariant,keepVersion?:string,keepNamespace?:string){
    const changed=keepVersion===undefined || [...this.validations.values()].some(value=>value.reference.id===reference.id && value.reference.conversationId===reference.conversationId
      && (!variant || value.source.variant===variant) && (value.source.sourceVersion!==keepVersion || value.source.cacheNamespace!==keepNamespace));
    if(changed)this.sourceEpochs.set(JSON.stringify([reference.conversationId,reference.id]),this.sourceEpoch(reference)+1);
    this.trimMetadata();
    for(const [id,value] of this.validations)if(value.reference.id===reference.id && value.reference.conversationId===reference.conversationId
      && (!variant || value.source.variant===variant) && (value.source.sourceVersion!==keepVersion || value.source.cacheNamespace!==keepNamespace))this.validations.delete(id);
    for(const live of this.live.values())if(this.sameReference(live.record.key,reference) && (!variant || live.record.key[8]===variant) && (live.record.key[7]!==keepVersion || live.record.key[1]!==keepNamespace)){
      pendingPurge.add(JSON.stringify(live.record.key));this.invalidateLive(live);
    }
    void onDisk(async()=>{for(const record of await this.records())if(this.sameReference(record.key,reference) && (!variant || record.key[8]===variant) && (record.key[7]!==keepVersion || record.key[1]!==keepNamespace))await this.remove(record);
      await this.sweepLocked();}).catch(()=>this.notice('Media cleanup is pending. Revoked bytes cannot be displayed.'));
  }
  invalidate(reference:MediaReference){this.revokeSource(reference);}
  private acceptNamespace(namespace:string,current:AbortController){
    if(this.namespace===namespace)return;
    if(this.namespace!==undefined){
      this.activity++;this.validations.clear();
      for(const controller of this.controllers)if(controller!==current)controller.abort();
      for(const download of this.downloads.values())download.abort.abort();
      for(const live of this.live.values()){pendingPurge.add(JSON.stringify(live.record.key));this.invalidateLive(live);}
    }
    this.namespace=namespace;
    void onDisk(async()=>{for(const record of await this.records())if(record.key[0]===this.base && record.key[2]===this.client.scope?.profileId
      && record.key[3]===this.client.scope?.accountId && record.key[1]!==namespace)await this.remove(record);
      await this.sweepLocked();
    }).catch(()=>this.notice('Media cleanup is pending. Old service bytes cannot be displayed.'));
  }
  private async validate(reference:MediaReference,variant:MediaVariant):Promise<Validation>{
    this.check();if(reference.accountId!==this.client.scope?.accountId)throw new Error('Media belongs to another account.');
    const id=this.sourceKey(reference,variant),pending=this.metadata.get(id);if(pending)return pending.task;
    const abort=new AbortController(),activity=this.activity;this.controllers.add(abort);
    const task=this.client.mediaSource(reference.conversationId,reference.id,variant,abort.signal).then(source=>{
      this.check();if(activity!==this.activity)throw new Error('Media activity changed.');
      if(source.variant!==variant || source.conversationId!==reference.conversationId || source.messageId!==reference.id){this.revokeSource(reference);throw new Error('Media source identity changed.');}
      this.acceptNamespace(source.cacheNamespace,abort);
      if(source.state!=='available' || !source.mime){this.revokeSource(reference);throw new Error('Media is '+source.state.replaceAll('_',' ')+'.');}
      const max=variant==='video'?10*MiB:4*MiB;
      if(source.maxBytes>max || source.maxBytes<=0 || source.validUntil-source.validatedAt>30000 || source.validatedAt>this.clock.now()+5000
        || (variant==='image' && source.mime!=='image/jpeg') || (variant==='preview' && !['image/png','image/gif'].includes(source.mime))
        || (variant==='video' && source.mime!=='video/mp4'))throw new Error('Unsupported media source.');
      const remaining=Math.min(30000,source.validUntil-this.clock.now(),source.expiresAt===null?30000:source.expiresAt-this.clock.now());
      if(remaining<=0){this.revokeSource(reference);throw new Error('Media validation expired.');}
      const value={source,reference,deadline:this.monotonic()+remaining};
      this.revokeSource(reference,variant,source.sourceVersion,source.cacheNamespace);
      this.validations.set(id,value);this.trimMetadata();
      for(const live of this.live.values())if(JSON.stringify(live.record.key)===JSON.stringify(this.key(reference,source))){live.validation=value;for(const state of live.handles)if(state.valid){if(state.deadline<=this.monotonic()){state.valid=false;for(const listener of state.listeners)listener();}else state.deadline=value.deadline;}}
      this.scheduleExpiry();return value;
    }).catch(error=>{
      if(error instanceof ApiError && ['media_source_changed','media_unavailable','owner_auth_required','profile_scope_changed'].includes(error.code))this.revokeSource(reference);
      throw error;
    }).finally(()=>{this.controllers.delete(abort);this.metadata.delete(id);});
    this.metadata.set(id,{reference,task});return task;
  }
  async revalidate(){if(!this.active || !this.foreground)return;this.expire();
    const sources=new Map<string,Validation>();for(const live of this.live.values())if([...live.handles].some(state=>state.valid))sources.set(this.sourceKey(live.validation.reference,live.validation.source.variant),live.validation);
    await Promise.allSettled([...sources.values()].map(value=>this.validate(value.reference,value.source.variant)));
    this.expire();
  }
  private expire(){const expired:MediaReference[]=[];
    for(const live of this.live.values()){
      if(live.record.expiresAt!==null && live.record.expiresAt<=this.clock.now())expired.push(live.validation.reference);
      for(const state of live.handles)if(state.valid && (state.deadline<=this.monotonic() || live.validation.source.validUntil<=this.clock.now()
        || live.record.expiresAt!==null && live.record.expiresAt<=this.clock.now())){state.valid=false;for(const listener of state.listeners)listener();}
    }
    for(const reference of expired)this.revokeSource(reference);
  }
  private scheduleExpiry(){clearTimeout(this.expiryTimer);const deadlines=[...this.live.values()].flatMap(live=>[...live.handles].filter(state=>state.valid).map(state=>state.deadline));
    if(deadlines.length)this.expiryTimer=setTimeout(()=>{this.expire();this.scheduleExpiry();},Math.max(1,Math.min(...deadlines)-this.monotonic()));
  }
  private startTimer(){if(this.timer)return;this.lastValidation=this.monotonic();this.timer=setInterval(()=>{this.expire();if(this.monotonic()-this.lastValidation>=15000){this.lastValidation=this.monotonic();void this.revalidate();}},250);}
  private lastValidation=0;
  setViewerOpen(open:boolean){this.covered=open;if(open)for(const live of this.live.values())for(const state of live.handles)if(state.role==='thumbnail' && state.valid){state.valid=false;for(const listener of state.listeners)listener();}}
  setForeground(value:boolean){this.activity++;this.foreground=value;if(!value){this.validations.clear();for(const abort of this.controllers)abort.abort();for(const live of this.live.values())this.invalidateLive(live);}
    else {void this.sweep();void this.revalidate();}}
  dispose(purge=true){if(!this.active)return;this.active=false;this.foreground=false;this.activity++;clearTimeout(this.expiryTimer);clearInterval(this.timer);this.timer=undefined;
    for(const abort of this.controllers)abort.abort();for(const download of this.downloads.values())download.abort.abort();
    this.validations.clear();this.sourceEpochs.clear();for(const live of this.live.values())this.invalidateLive(live);
    if(!purge || !this.client.scope)return;
    void onDisk(async()=>{for(const record of await this.records())if(record.key[0]===this.base && record.key[2]===this.client.scope?.profileId && record.key[3]===this.client.scope?.accountId)await this.remove(record);
      await this.sweepLocked();}).catch(()=>{});
  }
  private async room(record:MediaRecord){
    const records=await this.sweepLocked();let bytes=records.reduce((total,value)=>total+value.size,0),count=records.length;
    for(const candidate of [...records].sort((a,b)=>a.usedAt-b.usedAt)){
      if(bytes+record.size<=100*MiB && count+1<=200)break;
      if(pins.has(JSON.stringify(candidate.key)))continue;
      if(!await this.remove(candidate))throw new Error('Media cleanup is pending. New downloads are stopped.');bytes-=candidate.size;count--;
    }
    if(bytes+record.size>100*MiB || count+1>200)throw new Error('The media cache is full of retained items. Close media and retry.');
  }
  private async load(reference:MediaReference,validation:Validation,abort:AbortController):Promise<Live>{
    const key=this.key(reference,validation.source),id=JSON.stringify(key),unpin=pin(key),epoch=this.sourceEpoch(reference),activity=this.activity;
    const check=()=>{this.check();if(epoch!==this.sourceEpoch(reference) || activity!==this.activity)throw new Error('Media source or activity changed.');};
    const resource:{value:StoredMedia | null}={value:null};let retained=false;
    try {
      return await boundedRead(2*validation.source.maxBytes,async()=>{
        check();if(abort.signal.aborted)throw new Error('Media read cancelled.');
        let record=await onDisk(async()=>{const records=await this.sweepLocked();return records.find(value=>JSON.stringify(value.key)===id && !value.pendingPurge && !pendingPurge.has(id));});
        if(record && record.mime===validation.source.mime && record.size<=validation.source.maxBytes){const saved=record;resource.value=await onDisk(()=>this.storage.read(saved));check();}
        if(!resource.value){
          if(record){const corrupt=record;if(!await onDisk(()=>this.remove(corrupt,true)))throw new Error('Corrupt media cleanup is pending.');}
          check();const result=await this.client.mediaContent(validation.source,abort.signal);check();
          if(abort.signal.aborted)throw new Error('Media read cancelled.');
          const current=await this.validate(reference,validation.source.variant);check();
          if(current.source.sourceVersion!==validation.source.sourceVersion || current.source.cacheNamespace!==validation.source.cacheNamespace)throw new Error('Media source changed during download.');
          if(result.mime!==current.source.mime || result.bytes.length<=0 || result.bytes.length>current.source.maxBytes)throw new Error('Invalid media content.');
          record={key,size:result.bytes.length,mime:MediaRecordSchema.shape.mime.parse(result.mime),usedAt:this.clock.now(),expiresAt:current.source.expiresAt,pendingPurge:false};
          const completeRecord=record;
          await onDisk(async()=>{check();if(abort.signal.aborted)throw new Error('Media read cancelled.');await this.room(completeRecord);check();
            await this.storage.write(completeRecord,result.bytes);check();if(abort.signal.aborted || current.deadline<=this.monotonic()){await this.remove(completeRecord);throw new Error('Media validation ended during storage.');}
            resource.value=await this.storage.read(completeRecord);});
          validation=current;
        }
        check();if(!record || !resource.value || abort.signal.aborted || validation.deadline<=this.monotonic())throw new Error('Media cache entry is unavailable.');
        const used={...record,usedAt:this.clock.now()};await onDisk(()=>this.storage.touch(used));check();
        const value:Live={record:used,resource:resource.value,handles:new Set(),validation};this.live.set(id,value);retained=true;this.notice(null);
        // Waiters attach before this cleanup. A cancelled/offscreen waiter owns no URL.
        setTimeout(()=>{if(!value.handles.size && this.live.get(id)===value){this.live.delete(id);value.resource.release();unpin();if(pendingPurge.has(id))void this.sweep();}},0);
        return value;
      });
    }catch(error){if(error instanceof ApiError && ['media_source_changed','media_unavailable'].includes(error.code))this.revokeSource(reference);throw error;}
    finally {if(!retained){resource.value?.release();unpin();}}
  }
  async acquire(reference:MediaReference,variant:MediaVariant,role:'thumbnail'|'viewer',signal?:AbortSignal):Promise<MediaHandle>{
    this.check();if(signal?.aborted || role==='thumbnail' && this.covered)throw new Error('Media is not visible.');
    const reserve=variant==='video'?10*MiB:4*MiB;
    if(liveSlots>=4 || liveByteReservation+reserve>16*MiB || role==='viewer' && viewerSlots>0)throw new Error('Close other media before opening this item.');
    this.slots++;liveSlots++;if(role==='viewer')viewerSlots++;liveByteReservation+=reserve;let attached=false;
    try {
      let validation=await this.validate(reference,variant);this.check();if(signal?.aborted || role==='thumbnail' && this.covered)throw new Error('Media is not visible.');
      const epoch=this.sourceEpoch(reference),activity=this.activity;
      const key=this.key(reference,validation.source),id=JSON.stringify(key);let live=this.live.get(id);
      if(live && [...live.handles].some(state=>!state.valid))live=undefined;
      if(!live){let pending=this.downloads.get(id);
        if(!pending){const abort=new AbortController();const task=this.load(reference,validation,abort);pending={reference,task,abort,waiters:0};this.downloads.set(id,pending);
          void task.finally(()=>{this.downloads.delete(id);}).catch(()=>{});}
        const shared=pending;shared.waiters++;let waiting=true;
        const releaseWaiter=()=>{if(!waiting)return;waiting=false;if(--shared.waiters===0)shared.abort.abort();};
        signal?.addEventListener('abort',releaseWaiter,{once:true});
        try {live=await shared.task;}finally {releaseWaiter();signal?.removeEventListener('abort',releaseWaiter);}
      }
      this.check();validation=live.validation;
      if(epoch!==this.sourceEpoch(reference) || activity!==this.activity || signal?.aborted || role==='thumbnail' && this.covered || validation.deadline<=this.monotonic() || pendingPurge.has(id))throw new Error('Media is not visible or no longer valid.');
      const state:HandleState={valid:true,released:false,deadline:validation.deadline,role,listeners:new Set()};live.handles.add(state);attached=true;this.startTimer();this.scheduleExpiry();
      const entry=live;
      return {uri:entry.resource.uri,sourceVersion:validation.source.sourceVersion,expiresAt:entry.record.expiresAt,mime:entry.record.mime,size:entry.record.size,
        revalidate:async()=>{this.expire();if(state.released || !state.valid)return false;try{const current=await this.validate(reference,variant);
          return state.valid && !state.released && current.source.sourceVersion===validation.source.sourceVersion && current.source.cacheNamespace===validation.source.cacheNamespace
            && current.deadline>this.monotonic();}catch{return false;}},
        getSnapshot:()=>state.valid && !state.released && this.active && this.foreground && state.deadline>this.monotonic()
          && entry.validation.source.validUntil>this.clock.now() && (entry.record.expiresAt===null || entry.record.expiresAt>this.clock.now()),
        subscribe:listener=>{state.listeners.add(listener);return()=>{state.listeners.delete(listener);};},
        release:()=>{if(state.released)return;state.released=true;state.valid=false;state.listeners.clear();entry.handles.delete(state);this.slots--;liveSlots--;if(role==='viewer')viewerSlots--;liveByteReservation-=reserve;this.scheduleExpiry();
          if(!entry.handles.size){if(this.live.get(id)===entry)this.live.delete(id);entry.resource.release();const value=pins.get(id);if(value && --value.count===0)pins.delete(id);
            if(pendingPurge.has(id))void this.sweep();}
          if(!this.slots){clearInterval(this.timer);this.timer=undefined;}
        },
      };
    }finally {if(!attached){this.slots--;liveSlots--;if(role==='viewer')viewerSlots--;liveByteReservation-=reserve;}}
  }
}
