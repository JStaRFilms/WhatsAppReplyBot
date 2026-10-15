import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { z } from 'zod';
import { Conversation } from '@replybot/core/contracts';
import { ClientSnapshot, ProfileScope, ProfileOperation, SessionDiscovery, ProfileTransitionInput, ProfileTransitionResult } from '@replybot/core/api';
import { ApiClient, ApiError, sameScope } from './api';
import { HistoryCache } from './history-cache';
import { ClientClock } from './client-clock';
import { stopPlayback } from './audio-lane';
import { readSetting, saveSetting, getClientId } from './storage';
import { palettes, type Palette, type ThemeChoice } from './theme';

interface Controller {
  snapshot: ClientSnapshot | null; status: 'offline' | 'connecting' | 'online'; error: string | null;
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
  perform: <T>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>) => Promise<T | undefined>;
}
const Context = createContext<Controller | null>(null);
const SavedSession = z.object({url:z.string().url(),token:z.string(),scope:ProfileScope.optional()});
type Credentials = z.infer<typeof SavedSession>;
function sessionState(client: ApiClient, epoch: number) {
  return { client, epoch, history:new HistoryCache(client), clock:new ClientClock(), composerQueue:new Map<string,Promise<void>>(), request:0, acceptedRequest:0 };
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
export function AppProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const [baseUrl, setBaseUrl] = useState(() => {
    const host = process.env.EXPO_OS === 'web' ? globalThis.location?.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
    return process.env.EXPO_PUBLIC_BACKEND_URL || (host ? 'http://'+host+':3210' : Constants.expoConfig?.extra?.backendUrl || '');
  });
  const [binding,setBinding] = useState(()=>sessionState(new ApiClient(baseUrl,''),0));
  const active = useRef(binding);
  const credentials = useRef<Credentials | null>(null);
  const connectionEpoch = useRef(0);
  const sessionWrites = useRef(Promise.resolve());
  const highRevision = useRef(-1);
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [status, setStatus] = useState<Controller['status']>('offline');
  const [error, setError] = useState<string | null>(null);
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
    active.current=next; setBinding(next); setSnapshot(null);
    return next;
  };
  const current = (session: SessionState) => active.current === session;
  const persistScope = async (scope: ProfileScope, epoch: number) => {
    const saved = credentials.current;
    if (!saved || connectionEpoch.current !== epoch) return;
    // Serialize SecureStore writes so a late old connection cannot replace the
    // credentials or revision saved by a newer accepted session.
    const write=sessionWrites.current.catch(()=>{}).then(async()=>{
      if(connectionEpoch.current===epoch && sameScope(active.current.client.scope,scope))
        await saveSetting('replybot-session',JSON.stringify({...saved,scope}));
    });
    sessionWrites.current=write;await write;
  };
  const loadSnapshot = async (session: SessionState): Promise<void> => {
    if (!session.client.scope || !current(session)) return;
    const request=++session.request;
    const data=await session.client.request('/v1/snapshot',ClientSnapshot);
    if (!current(session) || request < session.acceptedRequest) return;
    if (!sameScope(data.profileScope,session.client.scope) || data.accountId !== session.client.scope.accountId || data.profileScope.revision < highRevision.current) {
      replaceBinding(null); setStatus('offline');
      setError('The active account changed. Review it before continuing.');
      return;
    }
    session.acceptedRequest=request;
    session.clock.calibrate(data.serverTime);
    setSnapshot(previous=>{
      if (!current(session)) return null;
      if (!previous) return data;
      const savedConversations=new Map(previous.conversations.map(c=>[c.id,c]));
      return {...data,conversations:data.conversations.map(incoming=>{
        const saved=savedConversations.get(incoming.id);
        return saved && saved.workflowVersion>incoming.workflowVersion ? saved : incoming;
      })};
    });
    setStatus('online');
  };
  const discover = async (epoch: number, allowRestore?: ProfileScope, monitor = monitorEpoch.current): Promise<void> => {
    const saved=credentials.current;
    if (!saved) return;
    const reader=new ApiClient(saved.url,saved.token);
    const data=await reader.session();
    if (connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || data.scope.revision < highRevision.current) return;
    if (data.scope.revision === highRevision.current && latestDiscovery.current && !sameScope(data.scope,latestDiscovery.current.scope)) return;
    highRevision.current=data.scope.revision;
    latestDiscovery.current=data;setDiscovery(data);
    const pendingTransition=data.transition && !['completed','failed'].includes(data.transition.state);
    if (active.current.client.scope && (!sameScope(active.current.client.scope,data.scope) || pendingTransition)) replaceBinding(null);
    let observed=data.transition;
    const own=ownTransition.current;
    if (own) {
      try {
        const recorded=await reader.operation(own.input.requestId);
        if (connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || latestDiscovery.current !== data) return;
        observed=recorded;
      } catch (reason) {
        if (connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || latestDiscovery.current !== data) return;
        setProfileNotice(reason instanceof ApiError ? 'The operation is not available yet. No action was retried.' : 'Waiting for the Windows service. The account change is not confirmed.');
      }
    }
    if (connectionEpoch.current !== epoch || monitorEpoch.current !== monitor || latestDiscovery.current !== data) return;
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
    if (sameScope(bound.client.scope,data.scope)) { await loadSnapshot(bound); return; }
    if (bound.client.scope) replaceBinding(null);
    const acknowledged=sameScope(allowRestore,data.scope) || acknowledgedOperation(ownTransition.current,observed,data.scope);
    if (!acknowledged) {
      setStatus('offline');
      if (observed?.state !== 'failed') setProfileNotice('Review the active account, then Continue. Its chats have not been loaded.');
      return;
    }
    ownTransition.current=null;
    const next=replaceBinding(data.scope);
    setProfileNotice(null);setError(null);setProfileBusy(false);
    await persistScope(data.scope,epoch);
    if (current(next)) await loadSnapshot(next);
  };
  const refresh = useCallback(async () => {
    const epoch=connectionEpoch.current;
    const session=active.current;
    try { await discover(epoch); }
    catch (reason) {
      if (connectionEpoch.current !== epoch || !current(session)) return;
      if (reason instanceof ApiError && reason.code==='client_upgrade_required') {replaceBinding(null);latestDiscovery.current=null;setDiscovery(null);}
      setStatus('offline');setError(reason instanceof Error ? reason.message : 'Service unavailable.');
    }
  },[]);
  useEffect(()=>{
    let disposed=false;
    const epoch=connectionEpoch.current;
    void Promise.all([readSetting('replybot-session'),readSetting('replybot-theme')]).then(async([saved,theme])=>{
      if (disposed || connectionEpoch.current !== epoch) return;
      if (theme==='light'||theme==='dark'||theme==='system')setThemeChoice(theme);
      if (!saved) return;
      const parsed=SavedSession.parse(JSON.parse(saved));
      credentials.current=parsed;setBaseUrl(parsed.url);setStatus('connecting');pollBudget.current=30;setPolling(true);
      await discover(epoch,parsed.scope);
    }).catch(reason=>{if(!disposed && connectionEpoch.current===epoch){setStatus('offline');setError(reason instanceof Error ? reason.message : 'Saved connection could not be restored.');}});
    return()=>{disposed=true;};
  },[]);
  useEffect(()=>{
    if (!polling) return;
    const timer=setInterval(()=>{
      const needsReview=!active.current.client.scope;
      if (needsReview && pollBudget.current-- <= 0) {
        monitorEpoch.current++;
        setPolling(false);setProfileBusy(false);setStatus('offline');
        setProfileNotice('The account change is not confirmed. Check status to read it again. Do not repeat the action.');
        return;
      }
      void refresh();
    },2000);
    return()=>clearInterval(timer);
  },[polling,refresh]);
  useEffect(()=>()=>{active.current.client.revoke();stopPlayback();},[]);
  const connect = async (url: string, enteredToken?: string) => {
    const epoch=++connectionEpoch.current;
    credentials.current=null;ownTransition.current=null;transitionLock.current=false;
    replaceBinding(null);highRevision.current=-1;latestDiscovery.current=null;setDiscovery(null);setOperation(null);
    setStatus('connecting');setError(null);setProfileNotice(null);setProfileBusy(false);setPolling(false);
    try {
      const parsedUrl=new URL(url);
      if (!['http:','https:'].includes(parsedUrl.protocol)) throw new Error('Use an HTTP or HTTPS service address.');
      const secret=enteredToken?.trim() || await ApiClient.provision(url);
      if (connectionEpoch.current !== epoch) return;
      credentials.current={url,token:secret};setBaseUrl(url);
      await discover(epoch);
      if (connectionEpoch.current===epoch) {pollBudget.current=30;setPolling(true);}
    } catch (reason) {
      if(connectionEpoch.current===epoch){setStatus('offline');setError(reason instanceof Error ? reason.message : 'Connection failed.');}
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
      await discover(epoch,descriptor.scope);
      if(connectionEpoch.current===epoch){pollBudget.current=30;setPolling(true);}
    } catch(reason){if(connectionEpoch.current===epoch){setStatus('offline');setError(reason instanceof Error ? reason.message : 'Could not verify this account.');}}
  };
  const transitionProfile = async (input: ProfileTransitionInput) => {
    const session=active.current;
    if (transitionLock.current || !session.client.scope || !current(binding)) return;
    const parsed=ProfileTransitionInput.parse(input);
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
  const {client,history,clock,composerQueue}=binding;
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
  const perform = async <T,>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>): Promise<T | undefined> => {
    if(!current(binding))return undefined;
    setError(null);
    try {
      const result=await client.request(path,schema,payload);
      if(!current(binding))return undefined;
      await refresh();return current(binding) ? result : undefined;
    } catch(reason){if(current(binding))setError(reason instanceof Error ? reason.message : 'Action failed.');return undefined;}
  };
  return <Context value={{snapshot,status,error,palette:dark?palettes.dark:palettes.light,dark,themeChoice,baseUrl,client,history,clock,
    acceptedScope:client.scope ?? null,sessionKey:String(binding.epoch)+':'+JSON.stringify(client.scope ?? null),discovery,operation,profileBusy,profileNotice,
    refresh,connect,continueProfile,transitionProfile,perform,composer,viewed,control,
    clearError:()=>setError(null),reportError:message=>{if(current(binding))setError(message);},
    setTheme:choice=>{setThemeChoice(choice);void saveSetting('replybot-theme',choice).catch(()=>setError('Theme preference could not be saved.'));}}}>
    {children}
  </Context>;
}
export function useApp(): Controller {
  const controller = use(Context);
  if (!controller) throw new Error('AppProvider is missing');
  return controller;
}
