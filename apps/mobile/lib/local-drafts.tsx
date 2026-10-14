import { createContext, use, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { useApp } from './app-state';
class LocalDraftStore {
  private values: Record<string,string> = {};
  private keys: string[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writes = Promise.resolve();
  ready = false;
  constructor(private readonly key: string,private readonly failed: () => void) {}
  async load(): Promise<void> {
    try { const saved = await AsyncStorage.getItem(this.key); if(saved) this.values = z.record(z.string(),z.string().max(4000)).parse(JSON.parse(saved)); }
    catch { this.failed(); }
    this.keys = Object.keys(this.values); this.ready = true; this.emit();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get = (id: string) => this.values[id] ?? '';
  ids = () => this.keys;
  private emit() { for(const listener of this.listeners) listener(); }
  set(id: string,text: string): void {
    if(!this.ready) return;
    const existed = !!this.values[id];
    if(text) this.values[id] = text; else delete this.values[id];
    if(existed !== !!text) this.keys = Object.keys(this.values);
    this.emit(); clearTimeout(this.timer); this.timer = setTimeout(()=>this.persist(),250);
  }
  private persist(): void {
    const json = JSON.stringify(this.values);
    this.writes = this.writes.then(()=>AsyncStorage.setItem(this.key,json)).catch(()=>this.failed());
  }
  dispose(): void { clearTimeout(this.timer); if(this.ready)this.persist(); }
}
const Context = createContext<LocalDraftStore | null>(null);
export function LocalDraftProvider({children}:{children:ReactNode}) {
  const {baseUrl,snapshot,reportError}=useApp();
  const key='replybot-drafts:'+baseUrl+':'+(snapshot?.accountId ?? 'unconnected');
  const store=useMemo(()=>new LocalDraftStore(key,()=>reportError('Your draft could not be saved on this device.')),[key]);
  useEffect(()=>{void store.load();return()=>store.dispose();},[store]);
  return <Context value={store}>{children}</Context>;
}
export function useLocalDraft(id: string) {
  const store=use(Context);if(!store)throw new Error('LocalDraftProvider missing');
  const text=useSyncExternalStore(store.subscribe,()=>store.get(id),()=> '');
  const ready=useSyncExternalStore(store.subscribe,()=>store.ready,()=>false);
  return {text,ready,setText:(value:string)=>store.set(id,value)};
}
export function useLocalDraftIds(): readonly string[] {
  const store=use(Context);if(!store)throw new Error('LocalDraftProvider missing');
  return useSyncExternalStore(store.subscribe,store.ids,store.ids);
}
