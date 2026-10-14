import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { z } from 'zod';
import { Conversation } from '@replybot/core/contracts';
import { ClientSnapshot } from '@replybot/core/api';
import { ApiClient } from './api';
import { HistoryCache } from './history-cache';
import { ClientClock } from './client-clock';
import { readSetting, saveSetting, getClientId } from './storage';
import { palettes, type Palette, type ThemeChoice } from './theme';

interface Controller {
  snapshot: ClientSnapshot | null; status: 'offline' | 'connecting' | 'online'; error: string | null;
  palette: Palette; dark: boolean; themeChoice: ThemeChoice; baseUrl: string; client: ApiClient; history: HistoryCache; clock: ClientClock;
  refresh: () => Promise<void>; clearError: () => void; reportError: (message: string) => void;
  connect: (url: string, token?: string) => Promise<void>;
  setTheme: (choice: ThemeChoice) => void;
  composer: (id: string,hasText: boolean) => Promise<void>;
  viewed: (id:string,watermark:number) => Promise<void>;
  control: (id:string,action:'resume'|'extend'|'indefinite') => Promise<Conversation | undefined>;
  perform: <T>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>) => Promise<T | undefined>;
}
const Context = createContext<Controller | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const [baseUrl, setBaseUrl] = useState(() => {
    const host = process.env.EXPO_OS === 'web' ? globalThis.location?.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
    return process.env.EXPO_PUBLIC_BACKEND_URL || (host ? 'http://'+host+':3210' : Constants.expoConfig?.extra?.backendUrl || '');
  });
  const [token, setToken] = useState('');
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [status, setStatus] = useState<Controller['status']>('offline');
  const [error, setError] = useState<string | null>(null);
  const client = useMemo(() => new ApiClient(baseUrl, token), [baseUrl, token]);
  const composerQueue = useMemo(()=>new Map<string,Promise<void>>(),[client]);
  const history = useMemo(() => new HistoryCache(client),[client]);
  const clock = useMemo(() => new ClientClock(), [client]);
  useEffect(() => { clock.calibrate(snapshot?.serverTime ?? 0); }, [clock]);
  const snapshotRequest = useRef(0);
  const acceptedSnapshot = useRef(0);
  const activeClient=useRef(client);activeClient.current=client;
  const sessionEpoch=useRef(0);
  const dark = themeChoice === 'dark' || (themeChoice === 'system' && system === 'dark');
  useEffect(() => {
    let active = true;
    void Promise.all([readSetting('replybot-session'), readSetting('replybot-theme')]).then(([session, theme]) => {
      if (!active) return;
      if (theme === 'light' || theme === 'dark' || theme === 'system') setThemeChoice(theme);
      if (session) {
        const parsed = z.object({ url: z.string().url(), token: z.string() }).parse(JSON.parse(session));
        setBaseUrl(parsed.url); setToken(parsed.token);
      }
    }).catch(() => { if (active) setError('Saved connection could not be restored. Reconnect this client.'); });
    return () => { active = false; };
  }, []);
  const refresh = useCallback(async () => {
    if (!token) return;
    const epoch=sessionEpoch.current;
    const request = ++snapshotRequest.current;
    try {
      const data=await client.request('/v1/snapshot',ClientSnapshot);
      if(activeClient.current!==client||sessionEpoch.current!==epoch||request<acceptedSnapshot.current)return;
      acceptedSnapshot.current=request;
      clock.calibrate(data.serverTime);
      setSnapshot(current => {
        if(activeClient.current!==client||sessionEpoch.current!==epoch)return current;
        if (!current || current.accountId !== data.accountId) return data;
        const savedConversations=new Map(current.conversations.map(c=>[c.id,c]));
        return {...data, conversations:data.conversations.map(incoming => {
          const saved=savedConversations.get(incoming.id);
          return saved && saved.workflowVersion>incoming.workflowVersion ? saved : incoming;
        })};
      });
      setStatus('online');
    }
    catch (e) { if(activeClient.current===client&&sessionEpoch.current===epoch&&request>=acceptedSnapshot.current){setStatus('offline');setError(e instanceof Error ? e.message : 'Service unavailable.');} }
  }, [client, token, clock]);
  useEffect(() => {
    if (!token) return;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [refresh, token]);
  const connect = async (url: string, enteredToken?: string) => {
    const epoch=++sessionEpoch.current;
    setStatus('connecting'); setError(null);
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Use an HTTP or HTTPS service address.');
      const secret = enteredToken?.trim() || await ApiClient.provision(url);
      const candidate = new ApiClient(url, secret);
      const data = await candidate.request('/v1/snapshot', ClientSnapshot);
      await saveSetting('replybot-session', JSON.stringify({ url, token: secret }));
      if(sessionEpoch.current!==epoch)return;
      setBaseUrl(url); setToken(secret); setSnapshot(data); setStatus('online');
    } catch (e) { if(sessionEpoch.current===epoch){setStatus('offline');setError(e instanceof Error ? e.message : 'Connection failed.');} }
  };
  const composer = useCallback((id:string,hasText:boolean):Promise<void> => {
    const epoch=sessionEpoch.current;
    const previous=composerQueue.get(id) ?? Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{
      if(activeClient.current!==client||sessionEpoch.current!==epoch)throw new Error('Connection changed. Try again.');
      const result=await client.request('/v1/conversations/'+encodeURIComponent(id)+'/composer',z.object({acknowledged:z.literal(true),conversation:Conversation}),{hasText,clientId:await getClientId()});
      if(activeClient.current!==client||sessionEpoch.current!==epoch)throw new Error('Connection changed. Try again.');
      setSnapshot(current=>activeClient.current===client&&sessionEpoch.current===epoch&&current ? {...current,conversations:current.conversations.map(c=>c.id===id&&c.accountId===result.conversation.accountId&&result.conversation.workflowVersion>=c.workflowVersion?result.conversation:c)}:current);
    }).finally(()=>{if(composerQueue.get(id)===task)composerQueue.delete(id);});
    composerQueue.set(id,task);return task;
  },[client,composerQueue]);
  const viewed=useCallback(async(id:string,watermark:number)=>{
    const epoch=sessionEpoch.current;
    await client.request('/v1/conversations/'+encodeURIComponent(id)+'/viewed',z.object({viewed:z.boolean()}),{watermark});
    if(activeClient.current!==client||sessionEpoch.current!==epoch)return;
    // The server knows whether newer messages arrived beyond this watermark.
    await refresh();
  },[client,refresh]);
  const control=useCallback(async(id:string,action:'resume'|'extend'|'indefinite'):Promise<Conversation | undefined>=>{
    const epoch=sessionEpoch.current;
    setError(null);
    try{
      const conversation=await client.request('/v1/conversations/'+encodeURIComponent(id)+'/control',Conversation,{action});
      if(activeClient.current!==client||sessionEpoch.current!==epoch)return undefined;
      setSnapshot(current=>activeClient.current===client&&sessionEpoch.current===epoch&&current ? {...current,conversations:current.conversations.map(c=>c.id===conversation.id&&c.accountId===conversation.accountId&&conversation.workflowVersion>=c.workflowVersion?conversation:c)}:current);
      void refresh();
      return conversation;
    }catch(e){
      if(activeClient.current===client&&sessionEpoch.current===epoch)setError(e instanceof Error ? e.message : 'Action failed.');
      return undefined;
    }
  },[client,refresh]);
  const perform = async <T,>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>): Promise<T | undefined> => {
    const epoch=sessionEpoch.current;
    setError(null);
    try {
      const result = await client.request(path, schema, payload);
      if(activeClient.current!==client||sessionEpoch.current!==epoch)return undefined;
      await refresh();
      return activeClient.current===client&&sessionEpoch.current===epoch ? result : undefined;
    }
    catch (e) { if(activeClient.current===client&&sessionEpoch.current===epoch)setError(e instanceof Error ? e.message : 'Action failed.'); return undefined; }
  };
  return <Context value={{ snapshot, status, error, palette: dark ? palettes.dark : palettes.light, dark,
    themeChoice, baseUrl, client, history, clock, refresh, connect, perform, composer, viewed, control, clearError: () => setError(null), reportError: setError,
    setTheme: choice => { setThemeChoice(choice); void saveSetting('replybot-theme', choice).catch(() => setError('Theme preference could not be saved.')); } }}>
    {children}
  </Context>;
}
export function useApp(): Controller {
  const controller = use(Context);
  if (!controller) throw new Error('AppProvider is missing');
  return controller;
}
