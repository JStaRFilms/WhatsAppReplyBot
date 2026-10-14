import type { Message } from '@replybot/core';
interface Entry {
  timer:ReturnType<typeof setTimeout> | undefined;
  resolve:()=>void; reject:(error:unknown)=>void; finish:()=>void;
}
export class ReplyWindow {
  private readonly entries=new Map<string,Entry>();
  private readonly jobs=new Set<Promise<void>>();
  private closed=false;
  constructor(private readonly run:(message:Message,isCurrent:()=>boolean)=>Promise<void>,private readonly delayMs=5000,
    private readonly onWindow?: (message:Message,isCurrent:()=>boolean)=>()=>void) {}
  enqueue(message:Message):Promise<void> {
    if(this.closed || message.source!=='live' || message.direction!=='inbound')return Promise.resolve();
    const previous=this.entries.get(message.conversationId);
    previous?.finish();
    if(previous?.timer){clearTimeout(previous.timer);previous.resolve();}
    return new Promise<void>((resolve,reject)=>{
      const entry:Entry={timer:undefined,resolve,reject,finish:()=>{}};
      const isCurrent=()=>!this.closed && this.entries.get(message.conversationId)===entry;
      entry.timer=setTimeout(()=>{
        entry.timer=undefined;
        const job=Promise.resolve().then(()=>this.run(message,isCurrent)).then(resolve,error=>{
          if(isCurrent())reject(error);else resolve();
        }).finally(()=>{
          entry.finish();
          if(this.entries.get(message.conversationId)===entry)this.entries.delete(message.conversationId);
          this.jobs.delete(job);
        });
        this.jobs.add(job);
      },this.delayMs);
      this.entries.set(message.conversationId,entry);
      entry.finish=this.onWindow?.(message,isCurrent) ?? (()=>{});
    });
  }
  clear():void {
    for(const entry of this.entries.values()){
      entry.finish();
      if(entry.timer){clearTimeout(entry.timer);entry.resolve();}
    }
    this.entries.clear();
  }
  async close():Promise<void> {
    this.closed=true;this.clear();await Promise.allSettled(this.jobs);
  }
}
