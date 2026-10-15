import { HistoryPage, type HistoryGroup } from '@replybot/core/api';
import { ApiClient, ApiError, History } from './api';

export type HistoryWindow = History & Partial<Omit<HistoryPage, 'messages'>> & { stale?: boolean; notice?: string };
export type HistoryAnchor = { id: string; offset: number };
type Entry = { value: HistoryWindow; pages: HistoryPage[]; anchor?: HistoryAnchor; generation: number; loaded:boolean };
type Direction = 'latest' | 'before' | 'after' | 'around';
const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

// This is a bounded display window, not a persistent copy of the conversation.
export class HistoryCache {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<HistoryWindow>>();
  private readonly pendingGenerations = new Map<string,number>();
  private readonly listeners = new Set<() => void>();
  private paging = false;
  private disposed = false;
  private groups:readonly HistoryGroup[]=[];
  constructor(private readonly client: ApiClient) {}
  configure(paging: boolean, groups:readonly HistoryGroup[]=[]): void { this.paging = paging;this.groups=groups; }
  get = (id: string): HistoryWindow | undefined => {const entry=this.entries.get(id);return entry?.loaded?entry.value:undefined;};
  anchor = (id: string): HistoryAnchor | undefined => this.entries.get(id)?.anchor;
  pin(id: string, anchor: HistoryAnchor): void { const entry=this.entries.get(id);if(entry)entry.anchor=anchor; }
  cancelPageReads(id:string):void {const entry=this.entries.get(id);if(entry)entry.generation++;}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { for (const listener of this.listeners) listener(); }
  dispose() { this.disposed=true;this.entries.clear();this.listeners.clear(); }
  load(id: string, refresh = false): Promise<HistoryWindow> {
    const saved=this.entries.get(id);
    if(saved?.loaded && !refresh)return Promise.resolve(saved.value);
    if(!this.paging)return this.legacy(id);
    return this.page(id,refresh && saved?.anchor ? 'around' : 'latest',refresh ? saved?.anchor?.id : undefined,refresh);
  }
  latest(id: string) {const entry=this.entries.get(id),anchor=entry?.anchor;if(entry)entry.anchor=undefined;
    return this.page(id,'latest',undefined,true).catch(error=>{if(entry)entry.anchor=anchor;throw error;});
  }
  around(id: string, sourceId: string) {
    const request=this.page(id,'around',sourceId,true),entry=this.entries.get(id),generation=entry?.generation;
    return request.then(value=>{if(entry && this.entries.get(id)===entry && entry.generation===generation && value.messages.some(message=>message.id===sourceId))entry.anchor={id:sourceId,offset:0};return value;});
  }
  older(id: string) { return this.page(id,'before',this.get(id)?.beforeCursor ?? undefined); }
  newer(id: string) { return this.page(id,'after',this.get(id)?.afterCursor ?? undefined); }
  private legacy(id: string): Promise<HistoryWindow> {
    const key=id+':legacy', running=this.pending.get(key);if(running)return running;
    const task=this.client.request('/v1/conversations/'+encodeURIComponent(id)+'/history',History).then(value=>{
      this.client.assertActive();if(this.disposed)throw new Error('History closed.');
      const old=this.entries.get(id);
      this.entries.delete(id);this.entries.set(id,{value,pages:[],anchor:old?.anchor,generation:0,loaded:true});
      try {this.bound(id);}catch(error){if(old)this.entries.set(id,old);else this.entries.delete(id);throw error;}
      this.publish();return value;
    }).catch(error=>{this.stale(id);throw error;}).finally(()=>this.pending.delete(key));
    this.pending.set(key,task);return task;
  }
  private stale(id: string) { const entry=this.entries.get(id);if(entry && !this.disposed){entry.value={...entry.value,stale:true};this.publish();} }
  private page(id: string, direction: Direction, edge?: string, refresh = false, neighborTried=false): Promise<HistoryWindow> {
    if(!this.paging)return this.legacy(id);
    if((direction==='before'||direction==='after') && !edge)return Promise.resolve(this.get(id) ?? {messages:[],watermark:0});
    const key=JSON.stringify([id,direction,edge]),running=this.pending.get(key);
    if(running && this.pendingGenerations.get(key)===this.entries.get(id)?.generation)return running;
    let entry=this.entries.get(id);
    if(!entry){entry={value:{messages:[],watermark:0},pages:[],generation:0,loaded:false};this.entries.set(id,entry);}
    const generation=refresh ? ++entry.generation : entry.generation;
    const query='?limit=50'+(edge?'&'+direction+'='+encodeURIComponent(edge):'');
    const task=this.client.request('/v1/conversations/'+encodeURIComponent(id)+'/history-page'+query,HistoryPage).then(page=>{
      this.client.assertActive();
      if(this.disposed || this.entries.get(id)!==entry || entry.generation!==generation)return entry.value;
      if(page.conversationId!==(this.groups.find(group=>group.memberIds.includes(id))?.id ?? id))throw new Error('History belongs to another conversation.');
      const old=entry.value,oldPages=entry.pages,oldLoaded=entry.loaded,epochChanged=old.sourceEpoch!==undefined && old.sourceEpoch!==page.sourceEpoch;
      const reanchor=direction==='around' && !epochChanged && entry.pages.length>0;
      let pages:HistoryPage[];
      if(reanchor && refresh && edge===entry.anchor?.id){
        const updates=new Map(page.messages.map(message=>[message.id,message]));
        pages=entry.pages.map(saved=>({...saved,messages:saved.messages.map(message=>updates.get(message.id) ?? message)}));
      }else if(direction==='before' && !epochChanged)pages=[page,...entry.pages];
      else if(direction==='after' && !epochChanged)pages=[...entry.pages,page];
      else pages=[page];
      const seen=new Set<string>();
      pages=pages.map(saved=>({...saved,messages:saved.messages.filter(message=>{if(seen.has(message.id))return false;seen.add(message.id);return true;})})).filter(saved=>saved.messages.length>0);
      entry.pages=pages;
      this.trim(entry);
      const first=entry.pages[0] ?? page, last=entry.pages.at(-1) ?? page;
      const messages=entry.pages.flatMap(saved=>saved.messages);
      const missing=direction==='around' && !!edge && !messages.some(message=>message.id===edge);
      entry.value={...page,messages,watermark:0,beforeCursor:first.beforeCursor,afterCursor:last.afterCursor,
        hasOlder:first.hasOlder,hasNewer:last.hasNewer || !!page.latestMessageId && !messages.some(message=>message.id===page.latestMessageId),
        unavailableSourceIds:[...new Set(entry.pages.flatMap(saved=>saved.unavailableSourceIds))],stale:false,
        ...(missing ? {notice:'The source is unavailable. Showing the closest stored messages.'} : {})};
      entry.loaded=true;this.entries.delete(id);this.entries.set(id,entry);
      try {this.bound(id);}catch(error){entry.value=old;entry.pages=oldPages;entry.loaded=oldLoaded;throw error;}
      this.publish();return entry.value;
    }).catch(async error=>{
      if(this.disposed)throw error;
      if(this.entries.get(id)!==entry || entry.generation!==generation)return this.get(id) ?? entry.value;
      if(!neighborTried && error instanceof ApiError && error.code==='history_source_unavailable' && direction==='around' && edge===entry.anchor?.id){
        const index=entry.value.messages.findIndex(message=>message.id===edge);
        const neighbor=entry.value.messages[index+1] ?? entry.value.messages[index-1];
        if(neighbor){entry.anchor={id:neighbor.id,offset:entry.anchor?.offset ?? 0};
          const follow=this.page(id,'around',neighbor.id,true,true),neighborGeneration=entry.generation;
          const result=await follow;if(entry.generation!==neighborGeneration)return entry.value;
          entry.value={...result,notice:'The previous source is unavailable. Showing its closest stored neighbor.'};this.publish();return entry.value;}
      }
      if(error instanceof ApiError && error.code==='history_cursor_stale' && (direction==='before'||direction==='after')){
        const anchor=entry.anchor?.id;if(anchor)return this.page(id,'around',anchor,true);
      }
      this.stale(id);throw error;
    }).finally(()=>{if(this.pending.get(key)===task){this.pending.delete(key);this.pendingGenerations.delete(key);}});
    this.pending.set(key,task);this.pendingGenerations.set(key,generation);return task;
  }
  private trim(entry: Entry) {
    while(entry.pages.length>6 || entry.pages.reduce((n,page)=>n+page.messages.length,0)>300){
      const pinned=Math.max(0,entry.pages.findIndex(page=>page.messages.some(message=>message.id===entry.anchor?.id)));
      if(pinned>=entry.pages.length/2)entry.pages.shift();else entry.pages.pop();
    }
  }
  private bound(active: string) {
    const totals=()=>({count:[...this.entries.values()].reduce((n,entry)=>n+entry.value.messages.length,0),bytes:[...this.entries.values()].reduce((n,entry)=>n+byteSize(entry.value),0)});
    for(;;){
      const size=totals();if(this.entries.size<=20 && size.count<=1000 && size.bytes<=8*1024*1024)return;
      const victim=[...this.entries.keys()].find(id=>id!==active);
      if(victim){this.entries.delete(victim);continue;}
      const entry=this.entries.get(active);
      if(!entry || entry.pages.length<=1){throw new Error('This source window exceeds the history cache limit. Text was not shortened.');}
      const pinned=Math.max(0,entry.pages.findIndex(page=>page.messages.some(message=>message.id===entry.anchor?.id)));
      if(pinned>=entry.pages.length/2)entry.pages.shift();else entry.pages.pop();
      const first=entry.pages[0],last=entry.pages[entry.pages.length-1];
      if(!first || !last)throw new Error('History page is unavailable.');
      entry.value={...entry.value,messages:entry.pages.flatMap(page=>page.messages),beforeCursor:first.beforeCursor,afterCursor:last.afterCursor,hasOlder:true,hasNewer:true};
    }
  }
}
