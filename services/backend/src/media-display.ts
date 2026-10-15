import { normalizeMessageContent } from '@whiskeysockets/baileys';
import { DomainError, historyDigest, type Workflow } from '@replybot/core';
import { MediaSource, type MediaVariant } from '@replybot/core/api';
import { attachmentIdentity, decodeStoredMessage, isViewOnce } from './whatsapp-normalize.ts';
import type { MediaService, DisplayBytes } from './media.ts';

export class MediaDisplay {
  constructor(private readonly flow:Workflow,private readonly media:MediaService,private readonly now=Date.now,
    private readonly admitted=()=>true) {}
  source(conversationId:string,messageId:string,variant:MediaVariant):MediaSource {
    const {store,accountId}=this.flow;
    this.flow.conversation(conversationId);
    const group=store.historyGroup(accountId,conversationId);
    const source=store.historySource(accountId,conversationId,messageId,this.now());
    const message=source?.message;
    const physical=source?.conversationId ?? conversationId;
    const raw=message ? decodeStoredMessage(store.waMessage(accountId,physical,message.transportId)) : undefined;
    const content=normalizeMessageContent(raw?.message);
    const attachment=content?.imageMessage ?? content?.stickerMessage ?? content?.videoMessage;
    const upload=message ? store.sentImageIdentity(accountId,physical,message.transportId) : undefined;
    const identity=raw ? attachmentIdentity(raw) : upload ? historyDigest([upload.id,upload.identity,upload.size]) : null;
    let state:MediaSource['state']=source?.state ?? 'missing';
    let mime:MediaSource['mime']=null;
    const expiresAt=source?.expiresAt ?? null;
    if(raw && isViewOnce(raw))state='view_once';
    if(state==='available'){
      if(!this.admitted())state='denied';
      else if(!identity || !attachment && !upload)state='missing';
      else if(variant==='video'){
        const v=content?.videoMessage;
        const seconds=Number(v?.seconds ?? 0),size=Number(v?.fileLength ?? 0),width=Number(v?.width ?? 0),height=Number(v?.height ?? 0);
        if(!v || v.gifPlayback || v.mimetype!=='video/mp4' || ![seconds,size,width,height].every(n=>Number.isFinite(n) && n>0)
          || seconds>300 || size>10*1024*1024 || width>1920 || height>1080)state='unsupported';
        else mime='video/mp4';
      }else if(variant==='image'){
        if(!content?.imageMessage && !upload)state='unsupported';else mime='image/jpeg';
      }else{
        if(content?.videoMessage && !content.videoMessage.gifPlayback || !['image','sticker','animated_sticker','gif'].includes(message?.media?.kind ?? ''))state='unsupported';
        else mime=message?.media?.kind==='gif' || message?.media?.kind==='animated_sticker' ? 'image/gif':'image/png';
      }
    }
    const validatedAt=this.now();
    if(expiresAt!==null && expiresAt<=validatedAt && state==='available')state='expired';
    if(state!=='available')mime=null;
    // CDN URL/directPath, profile revisions and receipt revisions are deliberately absent.
    const sourceVersion=historyDigest([1,accountId,physical,source?.messageId ?? messageId,source?.transportId ?? null,
      message?.direction ?? null,message?.contentState ?? null,message?.contentRecovered ?? false,
      message ? historyDigest([message.text,message.quotedMessageId,message.media]) : null,
      identity,state,expiresAt,group.memberIds,variant]);
    this.media.validateSource(accountId,physical,source?.messageId ?? messageId,variant,state==='available'?sourceVersion:null);
    return MediaSource.parse({cacheNamespace:store.mediaCacheId(accountId),conversationId:physical,messageId:source?.messageId ?? messageId,
      sourceVersion,variant,state,mime,maxBytes:variant==='video'?10*1024*1024:4*1024*1024,expiresAt,validatedAt,
      validUntil:Math.min(validatedAt+30000,expiresAt ?? Infinity)});
  }
  check(conversationId:string,messageId:string,variant:MediaVariant,version:string):MediaSource {
    const source=this.source(conversationId,messageId,variant);
    if(source.sourceVersion!==version || source.state!=='available' || !this.admitted())throw new DomainError('media_source_changed');
    return source;
  }
  async content(conversationId:string,messageId:string,variant:MediaVariant,version:string):Promise<DisplayBytes> {
    this.check(conversationId,messageId,variant,version);
    const source=this.flow.store.historySource(this.flow.accountId,conversationId,messageId,this.now());
    if(!source)throw new DomainError('media_source_changed');
    const check=()=>{this.check(conversationId,messageId,variant,version);};
    const result=await this.media.display(source.message,variant,version,check);
    const descriptor=this.check(conversationId,messageId,variant,version);
    if(result.mime!==descriptor.mime || !result.bytes.length || result.bytes.length>descriptor.maxBytes)throw new DomainError('media_unsupported',422);
    return result;
  }
}
