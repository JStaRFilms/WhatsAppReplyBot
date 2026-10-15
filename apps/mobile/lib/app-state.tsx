import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { z } from 'zod';
import { Conversation } from '@replybot/core/contracts';
import { ClientSnapshot, ProfileScope, ProfileOperation, SessionDiscovery, ProfileTransitionInput, ProfileTransitionResult } from '@replybot/core/api';
import { ApiClient, ApiError, ReadError, sameScope } from './api';
import { HistoryCache } from './history-cache';
import { PendingIntents } from './pending-intents';
import { ClientClock } from './client-clock';
import { stopPlayback } from './audio-lane';
import { readSetting, saveSetting, getClientId } from './storage';
import { palettes, type Palette, type ThemeChoice } from './theme';

interface Controller {
  snapshot: ClientSnapshot | null; status: 'offline' | 'connecting' | 'online'; error: string | null;
  pcStatus: 'offline' | 'connecting' | 'authenticated' | 'auth-required'; snapshotFresh: boolean; hasSavedCredential: boolean;
  palette: Palette; dark: boolean; themeChoice: ThemeChoice; baseUrl: string; client: ApiClient; history: HistoryCache; clock: ClientClock;
  acceptedScope: ProfileScope | null; sessionKey: string; discovery: SessionDiscovery | null;
  operation: ProfileOperation | null; profileBusy: boolean; profileNotice: string | null;
  continueProfile: () => Promise<void>; transitionProfile: (input: ProfileTransitionInput) => Promise<void>;
  refresh: () => Promise<void>; clearError: () => void; reportError: (message: string) => void;
  connect: (url: string, token?: string) => Promise<void>;
  setTheme: (choice: ThemeChoice) => void;
  composer: (id: string,hasText: boolean) => Promise<void>;
  viewed: (id:string,watermark:number) => Promise<void>;
  control: (id:string,action:'resume'|'extend'|'indefinite') => Promise<Conversation | undefined>;
  intents: PendingIntents;
  mutate: <T>(path: string, schema: z.ZodType<T>, payload: Record<string, unknown>) => Promise<T>;
  perform: <T>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>) => Promise<T | undefined>;
}
const Context = createContext<Controller | null>(null);
const SavedSession = z.object({url:z.string().url(),token:z.string(),scope:ProfileScope.optional()});
type Credentials = z.infer<typeof SavedSession>;
function sessionState(client: ApiClient, epoch: number) {
  return { client, epoch, history:new HistoryCache(client), clock:new ClientClock(), intents:new PendingIntents(client,client.scope,epoch), composerQueue:new Map<string,Promise<void>>(), request:0, acceptedRequest:0 };
}
type SessionState = ReturnType<typeof sessionState>;
type OwnTransition = {input:ProfileTransitionInput;source:ProfileScope};
function acknowledgedOperation(own: OwnTransition | null, operation: ProfileOperation | null, scope: ProfileScope): boolean {
  if (!own || !operation || operation.state !== 'completed' || operation.requestId !== own.input.requestId || operation.kind !== own.input.kind
    || !sameScope(operation.sourceScope,own.source) || !sameScope(operation.resultScope,scope) || scope.revision <= own.source.revision
    || operation.targetProfileId !== scope.profileId) return false;
  return own.input.kind === 'activate' ? own.input.profileId === scope.profileId
    : own.input.kind === 'repair' ? own.source.profileId === scope.profileId && own.source.accountId === scope.accountId
    : own.source.profileId !== scope.profileId && own.source.accountId !== scope.accountId;
}
export function defaultBackendUrl(): string {
  if (process.env.EXPO_OS === 'web' && process.env.EXPO_PUBLIC_DESKTOP === '1' && globalThis.location?.origin)
    return globalThis.location.origin;
  const host = process.env.EXPO_OS === 'web' ? globalThis.location?.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
  return process.env.EXPO_PUBLIC_BACKEND_URL || (host ? 'http://'+host+':3210' : Constants.expoConfig?.extra?.backendUrl || '');
}
export function AppProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const [baseUrl, setBaseUrl] = useState(defaultBackendUrl);
  const [binding,setBinding] = useState(()=>sessionState(new ApiClient(baseUrl,''),0));
  const active = useRef(binding);
  const credentials = useRef<Credentials | null>(null);
  const connectionEpoch = useRef(0);
  const sessionWrites = useRef(Promise.resolve());
  const highRevision = useRef(-1);
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [status, setStatus] = useState<Controller['status']>('offline');
  const [error, setError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [pcStatus, setPcStatus] = useState<Controller['pcStatus']>('offline');
  const [snapshotFresh, setSnapshotFresh] = useState(false);
  const [hasSavedCredential, setHasSavedCredential] = useState(false);
  const persistedSession = useRef<string | null>(null);
  const pendingRestore = useRef<ProfileScope | undefined>(undefined);
  const readRun = useRef<{abort:AbortController;task:Promise<void>} | null>(null);
  const foreground = useRef(AppState.currentState === 'active' || AppState.currentState === null);
  const [discovery,setDiscovery] = useState<SessionDiscovery | null>(null);
  const latestDiscovery = useRef<SessionDiscovery | null>(null);
  const [operation,setOperation] = useState<ProfileOperation | null>(null);
  const ownTransition = useRef<OwnTransition | null>(null);
  const transitionLock = useRef(false);
  const [profileBusy,setProfileBusy] = useState(false);
  const [profileNotice,setProfileNotice] = useState<string | null>(null);
  const pollBudget = useRef(0);
  const monitorEpoch = useRef(0);
  const [polling,setPolling] = useState(false);
  const dark = themeChoice === 'dark' || (themeChoice === 'system' && system === 'dark');

  // Revoke synchronously, before React commits the new subtree. Old handlers cannot
  // submit work in the gap between discovering a revision and unmounting screens.
  const replaceBinding = (scope: ProfileScope | null): SessionState => {
    active.current.intents.stop();
    active.current.client.revoke();
    stopPlayback();
    const epoch = active.current.epoch+1;
    const saved = credentials.current;
    const client = new ApiClient(saved?.url ?? baseUrl,saved?.token ?? '',scope ?? undefined,reason=>{
      if (active.current.client !== client) return;
      replaceBinding(null);
      setStatus('offline'); setError(reason.message);
      setDiscovery(null); latestDiscovery.current=null;
      pollBudget.current=30; setPolling(true);
    });
    const next=sessionState(client,epoch);
    active.current=next; setBinding(next); setSnapshot(null);setSnapshotFresh(false);
    return next;
  };
  const current = (session: SessionState) => active.current === session;
  const persistScope = async (scope: ProfileScope | undefined, epoch: number) => {
    const saved = credentials.current;
    if (!saved || connectionEpoch.current !== epoch) return;
    // Serialize SecureStore writes so a late old connection cannot replace the
    // credentials or revision saved by a newer accepted session.
    const value=JSON.stringify({...saved,scope});
    if(persistedSession.current===value)return;
    const write=sessionWrites.current.catch(()=>{}).then(async()=>{
      if(connectionEpoch.current===epoch && credentials.current===saved && (!scope || sameScope(active.current.client.scope,scope))) {
        await saveSetting('replybot-session',value);
        if(connectionEpoch.current===epoch && credentials.current===saved) {
          persistedSession.current=value;setHasSavedCredential(true);
        }
      }
    });
    sessionWrites.current=write;await write;
  };
  const loadSnapshot = async (session: SessionState, signal: AbortSignal): Promise<void> => {
    if (!session.client.scope || !current(session)) return;
    const request=++session.request;
    const data=await session.client.request('/v1/snapshot',ClientSnapshot,undefined,signal);
    if (signal.aborted || !current(session) || request < session.acceptedRequest) return;
    if (!sameScope(data.profileScope,session.client.scope) || data.accountId !== session.client.scope.accountId || data.profileScope.revision < highRevision.current) {
      replaceBinding(null); setStatus('offline');
      setError('The active account changed. Review it before continuing.');
      return;
    }
    session.acceptedRequest=request;
    session.intents.reconcile(data.outbox);
    session.clock.calibrate(data.serverTime);
    setSnapshot(previous=>{
      if (signal.aborted || !current(session) || request < session.acceptedRequest) return previous;
      if (!previous) return data;
      const savedConversations=new Map(previous.conversations.map(c=>[c.id,c]));
      return {...data,conversations:data.conversations.map(incoming=>{
        const saved=savedConversations.get(incoming.id);
        return saved && saved.workflowVersion>incoming.workflowVersion ? saved : incoming;
      })};
    });
    setStatus('online');setSnapshotFresh(true);
  };
  const discover = async (epoch: number, signal: AbortSignal, allowRestore?: ProfileScope, monitor = monitorEpoch.current): Promise<void> => {
    const saved=credentials.current;
    if (!saved) return;
    const reader=new ApiClient(saved.url,saved.token);
    const data=await reader.session(signal);
    if (signal.aborted || connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || data.scope.revision < highRevision.current) return;
    setPcStatus('authenticated');setReadError(null);
    if (data.scope.revision === highRevision.current && latestDiscovery.current && !sameScope(data.scope,latestDiscovery.current.scope)) return;
    highRevision.current=data.scope.revision;
    latestDiscovery.current=data;setDiscovery(data);
    if(!sameScope(pendingRestore.current,data.scope))pendingRestore.current=undefined;
    const pendingTransition=data.transition && !['completed','failed'].includes(data.transition.state);
    if (active.current.client.scope && (!sameScope(active.current.client.scope,data.scope) || pendingTransition)) replaceBinding(null);
    let observed=data.transition;
    const own=ownTransition.current;
    if (own) {
      try {
        const recorded=await reader.operation(own.input.requestId,signal);
        if (signal.aborted || connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || latestDiscovery.current !== data) return;
        observed=recorded;
      } catch (reason) {
        if (signal.aborted || connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || latestDiscovery.current !== data) return;
        setProfileNotice(reason instanceof ApiError ? 'The profile change is not confirmed yet. Check its status again.' : 'Waiting for the Windows service. The profile change is not confirmed.');
      }
    }
    if (signal.aborted || connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || latestDiscovery.current !== data) return;
    setOperation(observed);
    if (observed && !['completed','failed'].includes(observed.state)) {
      if (active.current.client.scope) replaceBinding(null);
      setProfileBusy(true); setStatus('connecting');
      setProfileNotice('Account change '+observed.state+'. Waiting for the Windows service.');
      return;
    }
    setProfileBusy(transitionLock.current);
    if (observed?.state === 'failed') {
      ownTransition.current=null;
      setProfileNotice('Account change failed. '+(observed.error?.replaceAll('_',' ') ?? 'Review the service before trying another action.'));
    }
    const bound=active.current;
    if (sameScope(bound.client.scope,data.scope)) { await loadSnapshot(bound,signal); return; }
    if (bound.client.scope) replaceBinding(null);
    const acknowledged=sameScope(allowRestore,data.scope) || acknowledgedOperation(ownTransition.current,observed,data.scope);
    if (!acknowledged) {
      await persistScope(undefined,epoch);
      if(signal.aborted || connectionEpoch.current!==epoch)return;
      setStatus('offline');
      if (observed?.state !== 'failed') setProfileNotice('Review the active account, then Continue. Its chats have not been loaded.');
      return;
    }
    ownTransition.current=null;
    pendingRestore.current=undefined;
    const next=replaceBinding(data.scope);
    setProfileNotice(null);setProfileBusy(false);
    await persistScope(data.scope,epoch);
    if (!signal.aborted && current(next)) await loadSnapshot(next,signal);
  };
  const startRead = (allowRestore = pendingRestore.current, supersede = true): Promise<void> => {
    if(!credentials.current || !foreground.current)return Promise.resolve();
    if(readRun.current && !supersede)return readRun.current.task;
    readRun.current?.abort.abort();
    const abort=new AbortController(), epoch=connectionEpoch.current, monitor=monitorEpoch.current;
    const valid=()=>!abort.signal.aborted && connectionEpoch.current===epoch && monitorEpoch.current===monitor;
    const task=(async()=>{
      for(let attempt=0;attempt<3;attempt++) {
        try { await discover(epoch,abort.signal,allowRestore,monitor);return; }
        catch(reason) {
          if(!valid())return;
          setSnapshotFresh(false);setStatus('offline');
          const authRequired=reason instanceof ApiError && reason.code==='owner_auth_required';
          setPcStatus(authRequired?'auth-required':'offline');
          if(authRequired || reason instanceof ApiError && reason.code==='client_upgrade_required')setPolling(false);
          if(reason instanceof ApiError && reason.code==='client_upgrade_required') {
            replaceBinding(null);latestDiscovery.current=null;setDiscovery(null);
          }
          setReadError(reason instanceof Error ? reason.message : 'Could not refresh from the Windows service.');
          if(!(reason instanceof ReadError) || attempt===2)return;
          await new Promise<void>(resolve=>{
            const done=()=>{clearTimeout(timer);abort.signal.removeEventListener('abort',done);resolve();};
            const timer=setTimeout(done,attempt===0?250:750);
            abort.signal.addEventListener('abort',done,{once:true});
          });
          if(!valid())return;
        }
      }
    })().finally(()=>{if(readRun.current?.abort===abort)readRun.current=null;});
    readRun.current={abort,task};return task;
  };
  const refresh = useCallback(() => {
    pollBudget.current=30;setPolling(true);return startRead();
  },[]);
  useEffect(()=>{
    let disposed=false;
    const epoch=connectionEpoch.current;
    void Promise.all([readSetting('replybot-session'),readSetting('replybot-theme')]).then(async([saved,theme])=>{
      if (disposed || connectionEpoch.current !== epoch) return;
      if (theme==='light'||theme==='dark'||theme==='system')setThemeChoice(theme);
      if (!saved) return;
      const parsed=SavedSession.parse(JSON.parse(saved));
      parsed.url=parsed.url.replace(/\/$/,'');
      credentials.current=parsed;pendingRestore.current=parsed.scope;persistedSession.current=JSON.stringify(parsed);setHasSavedCredential(true);
      setBaseUrl(parsed.url);setStatus('connecting');setPcStatus('connecting');pollBudget.current=30;setPolling(true);
      await startRead(parsed.scope);
    }).catch(reason=>{if(!disposed && connectionEpoch.current===epoch){setStatus('offline');setError(reason instanceof Error ? reason.message : 'Saved connection could not be restored.');}});
    return()=>{disposed=true;};
  },[]);
  useEffect(()=>{
    if (!polling) return;
    const timer=setInterval(()=>{
      if(!foreground.current)return;
      const needsReview=!active.current.client.scope;
      if (needsReview && pollBudget.current-- <= 0) {
        monitorEpoch.current++;
        setPolling(false);setProfileBusy(false);setStatus('offline');
        setProfileNotice('The account change is not confirmed. Check status to read it again. Do not repeat the action.');
        return;
      }
      void startRead(undefined,false);
    },2000);
    return()=>clearInterval(timer);
  },[polling,refresh]);
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',state=>{
      const visible=state==='active';
      if(visible===foreground.current)return;
      foreground.current=visible;
      active.current.intents.setForeground(visible);
      readRun.current?.abort.abort();active.current.client.abortReads();
      setSnapshotFresh(false);
      if(visible && credentials.current) {
        setStatus('connecting');setPcStatus('connecting');pollBudget.current=30;setPolling(true);
        void refresh();
      } else if(!visible) {
        setStatus('offline');setPcStatus('offline');
      }
    });
    return()=>{subscription.remove();readRun.current?.abort.abort();active.current.intents.stop();active.current.client.revoke();stopPlayback();};
  },[refresh]);
  const connect = async (url: string, enteredToken?: string) => {
    const previous=credentials.current;
    const normalized=url.trim().replace(/\/$/,'');
    if(!enteredToken?.trim() && previous?.url===normalized) {
      setStatus('connecting');setPcStatus('connecting');pollBudget.current=30;setPolling(true);
      await startRead();return;
    }
    const epoch=++connectionEpoch.current;
    readRun.current?.abort.abort();
    credentials.current=null;pendingRestore.current=undefined;setHasSavedCredential(false);persistedSession.current=null;
    ownTransition.current=null;transitionLock.current=false;
    replaceBinding(null);highRevision.current=-1;latestDiscovery.current=null;setDiscovery(null);setOperation(null);
    setStatus('connecting');setPcStatus('connecting');setError(null);setReadError(null);setProfileNotice(null);setProfileBusy(false);setPolling(false);
    try {
      const parsedUrl=new URL(normalized);
      if (!['http:','https:'].includes(parsedUrl.protocol)) throw new Error('Use an HTTP or HTTPS service address.');
      const secret=enteredToken?.trim() || await ApiClient.provision(normalized);
      if (connectionEpoch.current !== epoch) return;
      credentials.current={url:normalized,token:secret};setBaseUrl(normalized);
      pollBudget.current=30;setPolling(true);await startRead();
    } catch (reason) {
      if(connectionEpoch.current===epoch){setStatus('offline');setPcStatus('offline');setError(reason instanceof Error ? reason.message : 'Connection failed.');}
    }
  };
  const continueProfile = async () => {
    const descriptor=latestDiscovery.current;
    if (!descriptor || profileBusy) return;
    const epoch=connectionEpoch.current;
    setStatus('connecting');setError(null);
    try {
      // A Continue click acknowledges only the descriptor actually shown, not a
      // different account discovered while the confirmation is in flight.
      pollBudget.current=30;setPolling(true);await startRead(descriptor.scope);
    } catch(reason){if(connectionEpoch.current===epoch){setStatus('offline');setError(reason instanceof Error ? reason.message : 'Could not verify this account.');}}
  };
  const transitionProfile = async (input: ProfileTransitionInput) => {
    const session=active.current;
    if (transitionLock.current || !session.client.scope || !current(binding)) return;
    const parsed=ProfileTransitionInput.parse(input);
    readRun.current?.abort.abort();
    transitionLock.current=true;setProfileBusy(true);setError(null);
    const intent={input:parsed,source:session.client.scope};
    ownTransition.current=intent;
    const epoch=connectionEpoch.current;
    try {
      const result=await session.client.request('/v1/profile-transitions',ProfileTransitionResult,parsed);
      if(connectionEpoch.current!==epoch || ownTransition.current!==intent)return;
      setOperation(result.operation);
      setProfileNotice('Account change requested. Waiting for confirmation from the Windows service.');
      replaceBinding(null);setStatus('connecting');
    } catch(reason) {
      if(connectionEpoch.current!==epoch || ownTransition.current!==intent)return;
      // Never replay a mutation, even when a restart loses its HTTP response.
      if(reason instanceof ApiError)ownTransition.current=null;
      setError(reason instanceof Error ? reason.message : 'Account change was not acknowledged.');
      setProfileNotice('No action was retried. Check status before trying again.');
      replaceBinding(null);setStatus('offline');
    } finally {
      if(connectionEpoch.current===epoch){transitionLock.current=false;pollBudget.current=30;setPolling(true);}
    }
  };
  const {client,history,clock,composerQueue,intents}=binding;
  useEffect(()=>{intents.setForeground(foreground.current);void intents.load();},[intents]);
  intents.onMutation=()=>{if(current(binding))void refresh();};
  const composer = useCallback((id:string,hasText:boolean):Promise<void> => {
    const previous=composerQueue.get(id) ?? Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{
      if(!current(binding))throw new Error('Connection changed. Try again.');
      const clientId=await getClientId();
      if(!current(binding))throw new Error('Connection changed. Try again.');
      const result=await client.request('/v1/conversations/'+encodeURIComponent(id)+'/composer',z.object({acknowledged:z.literal(true),conversation:Conversation}),{hasText,clientId});
      if(!current(binding))throw new Error('Connection changed. Try again.');
      setSnapshot(previous=>current(binding)&&previous ? {...previous,conversations:previous.conversations.map(c=>c.id===id&&c.accountId===result.conversation.accountId&&result.conversation.workflowVersion>=c.workflowVersion?result.conversation:c)}:previous);
    }).finally(()=>{if(composerQueue.get(id)===task)composerQueue.delete(id);});
    composerQueue.set(id,task);return task;
  },[binding]);
  const viewed=useCallback(async(id:string,watermark:number)=>{
    if(!current(binding))return;
    await client.request('/v1/conversations/'+encodeURIComponent(id)+'/viewed',z.object({viewed:z.boolean()}),{watermark});
    if(current(binding))await refresh();
  },[binding,refresh]);
  const control=useCallback(async(id:string,action:'resume'|'extend'|'indefinite'):Promise<Conversation | undefined>=>{
    if(!current(binding))return;
    setError(null);
    try{
      const conversation=await client.request('/v1/conversations/'+encodeURIComponent(id)+'/control',Conversation,{action});
      if(!current(binding))return undefined;
      setSnapshot(previous=>current(binding)&&previous ? {...previous,conversations:previous.conversations.map(c=>c.id===conversation.id&&c.accountId===conversation.accountId&&conversation.workflowVersion>=c.workflowVersion?conversation:c)}:previous);
      void refresh();return conversation;
    }catch(reason){if(current(binding))setError(reason instanceof Error ? reason.message : 'Action failed.');return undefined;}
  },[binding,refresh]);
  const mutate = async <T,>(path: string, schema: z.ZodType<T>, payload: Record<string, unknown>): Promise<T> => {
    if(!current(binding))throw new Error('The active account changed. No action was submitted.');
    const result=await client.request(path,schema,payload);
    if(!current(binding))throw new Error('The active account changed. The request outcome is unconfirmed.');
    void refresh();
    return result;
  };
  const perform = async <T,>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>): Promise<T | undefined> => {
    if(!current(binding))return undefined;
    try {
      if(payload !== undefined)return await mutate(path,schema,payload);
      const result=await client.request(path,schema);
      return current(binding) ? result : undefined;
    } catch(reason){if(current(binding))setError(reason instanceof Error ? reason.message : 'Action failed.');return undefined;}
  };
  return <Context value={{snapshot,status,error:error ?? readError,pcStatus,snapshotFresh,hasSavedCredential,palette:dark?palettes.dark:palettes.light,dark,themeChoice,baseUrl,client,history,clock,
    acceptedScope:client.scope ?? null,sessionKey:String(binding.epoch)+':'+JSON.stringify(client.scope ?? null),discovery,operation,profileBusy,profileNotice,
    refresh,connect,continueProfile,transitionProfile,perform,mutate,intents,composer,viewed,control,
    clearError:()=>{setError(null);setReadError(null);},reportError:message=>{if(current(binding))setError(message);},
    setTheme:choice=>{setThemeChoice(choice);void saveSetting('replybot-theme',choice).catch(()=>setError('Theme preference could not be saved.'));}}}>
    {children}
  </Context>;
}
export function useApp(): Controller {
  const controller = use(Context);
  if (!controller) throw new Error('AppProvider is missing');
  return controller;
}
