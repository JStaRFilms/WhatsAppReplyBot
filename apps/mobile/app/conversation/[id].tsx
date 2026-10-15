import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, SlidersHorizontal, Smile, X } from 'lucide-react-native';
import { randomUUID } from '../../lib/uuid';
import { Draft, type Message, OwnerAction } from '@replybot/core/contracts';
import { Image } from 'expo-image';
import { VoiceComposer, type VoiceComposerHandle } from '../../components/voice-composer';
import type { AudioClip } from '../../lib/audio-clip';
import { AttachmentPicker,type PickedImage } from '../../components/attachment-picker';
import { Page, Button } from '../../components/ui';
import { Avatar } from '../../components/avatar';
import { ChatBadge } from '../../components/chat-badge';
import { MediaViewer } from '../../components/media-viewer';
import { MessageBubble } from '../../components/message-bubble';
import { DraftCard } from '../../components/draft-card';
import { PauseControls } from '../../components/pause-controls';
import { PermissionSheet } from '../../components/permission-sheet';
import { useApp } from '../../lib/app-state';
import { ApiError } from '../../lib/api';
import { intentVisible, type PendingIntent } from '../../lib/pending-intents';
import { releaseMedia, releaseImage } from '../../lib/media-lease';
import { OutboxStatus } from '../../components/outgoing-status';
import { useLocalDraft, useLocalDraftIds } from '../../lib/local-drafts';
import { fonts } from '../../lib/theme';
import { HistoryCache } from '../../lib/history-cache';
import { useConversationScroll } from '../../lib/conversation-scroll';
import { useComposerFocus } from '../../lib/composer-focus';
import { isForeground, useForeground } from '../../lib/foreground';

const emojis = ['😀','😂','😊','😍','🥰','😎','🤔','😮','😢','😭','👍','👎','❤️','🙏','🎉','🔥','✅','👋'];

export default function ConversationScreen() {
  const { id, draftId } = useLocalSearchParams<{ id: string; draftId?: string }>();
  const router = useRouter();
  const foreground = useForeground();
  const localDraftIds=useLocalDraftIds();
  const { snapshot, palette, mutate, intents, refresh, history, status, reportError, composer, viewedMessages, client, discovery, mediaCache, clock } = useApp();
  const pending = useSyncExternalStore(intents.subscribe, intents.get, intents.get);
  const [composerIdentity] = useState(randomUUID);
  const turns = useRef(new Map<string, number>());
  const draftOffsets = useRef(new Map<string, number>());
  const knownMedia=useRef(new Map<string,Message>());
  const cached = useSyncExternalStore(history.subscribe,() => history.get(id),() => undefined);
  const messages = cached?.messages ?? [];
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [paging,setPaging] = useState(false);
  const pendingLocation=useRef<{source:string;draftId?:string;bodyLocated?:boolean;contextArrived?:boolean} | null>(null);
  const pagingRead=useRef(0),jumpRequests=useRef(new Set<string>()),selectedNavigation=useRef<string | null>(null);
  const {text,setText,ready:draftReady}=useLocalDraft(id);
  const [attachment,setAttachment]=useState<PickedImage | null>(null);
  const [audioClip,setAudioClip]=useState<AudioClip | null>(null);
  const [audioBusy,setAudioBusy]=useState(false);
  useEffect(()=>()=>{if(audioClip)releaseMedia(audioClip,()=>audioClip.release());},[audioClip]);
  const [picking,setPicking]=useState(false);
  const pickerBusy=useRef(false);
  const [viewer,setViewer]=useState<Message | null>(null);
  const viewerOpen=useRef(false);
  const activeId=useRef(id);activeId.current=id;
  const activeClient=useRef(client);activeClient.current=client;
  const alive=useRef(true);
  const occupied=!!text || !!attachment || picking || !!audioClip || audioBusy;
  const volatileAudio=useRef({audioClip,audioBusy,text});volatileAudio.current={audioClip,audioBusy,text};
  useEffect(()=>()=>{
    const local=volatileAudio.current;
    if((local.audioClip || local.audioBusy) && !local.text)void composer(id,false).catch(()=>{});
  },[id,composer]);
  useEffect(()=>()=>{if(attachment)releaseMedia(attachment,()=>releaseImage(attachment));},[attachment]);
  const composerState=useRef<{id:string;hasText:boolean} | null>(null);
  const [composerRetry,setComposerRetry]=useState(0);
  const [quote, setQuote] = useState<Message | null>(null); const [selected, setSelected] = useState<Message | null>(null);
  const selectedGesture=useRef(0);
  const selectMessage=(message:Message)=>{selectedGesture.current++;setSelected(message);};
  const composeRevision=useRef(0);
  const composeScope=useRef({id,client});
  if(composeScope.current.id!==id || composeScope.current.client!==client){composeScope.current={id,client};composeRevision.current++;}
  const editText=(value:string)=>{composeRevision.current++;setText(value);};
  const editQuote=(value:Message | null)=>{composeRevision.current++;setQuote(value);};
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(false);
  const [reactionEmoji, setReactionEmoji] = useState('');
  const voice = useRef<VoiceComposerHandle>(null);
  const [selection, setSelection] = useState<{start:number;end:number} | undefined>();
  const [permissions, setPermissions] = useState(false); const [pauseState, setPauseState] = useState<'idle'|'pending'|'acknowledged'|'failed'>('idle');
  const [drafting, setDrafting] = useState(false);
  const draftRequest = useRef<string | null>(null);
  const [draftFeedback, setDraftFeedback] = useState<{text:string;draft?:Draft} | null>(null);
  const [draftUnconfirmed,setDraftUnconfirmed]=useState(false);
  const draftUnknownScope=useRef<{id:string;client:typeof client} | null>(null);
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const typing=useComposerFocus(id,client,focused && !viewer,foreground,!!text || !!quote || !!attachment);
  const {input}=typing;
  const quoteMessage=(message:Message | null)=>{editQuote(message);typing.focus();};
  const viewedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelViewed = useCallback(() => { clearTimeout(viewedTimer.current); }, []);
  const scrolling = useConversationScroll(history, id, !!cached, cancelViewed, cached, client);
  const { scroll, position, positioned } = scrolling;
  const group=snapshot?.historyGroups?.find(group=>group.id===id || group.memberIds.includes(id));
  const memberIds=group?.memberIds ?? [id];
  const readOnly=!!group && group.id!==id;
  const c = snapshot?.conversations.find(c => c.id === id);
  const selectedDraft=snapshot?.drafts.find(draft=>draft.id===draftId && memberIds.includes(draft.conversationId));
  useLayoutEffect(() => {
    alive.current=true;
    setPauseState('idle'); setHistoryError(null);setPaging(false);pendingLocation.current=null;pagingRead.current++;jumpRequests.current.clear();selectedNavigation.current=null;
    setViewer(null);viewerOpen.current=false;pickerBusy.current=false;mediaCache?.setViewerOpen(false);
    setReactionPicker(false);setReactionEmoji('');
    setEmojiOpen(false); setSelection(undefined); setQuote(null); setSelected(null);
    setAttachment(null);setPicking(false);setAudioClip(null);setAudioBusy(false);
    setDraftFeedback(null);setDrafting(false);setDraftUnconfirmed(false);draftUnknownScope.current=null;draftRequest.current=null;turns.current.clear();draftOffsets.current.clear();knownMedia.current.clear();
    composerState.current=null; seenMessage.current=null;
    return () => { alive.current=false; draftRequest.current=null; cancelViewed();viewerOpen.current=false;mediaCache?.setViewerOpen(false); };
  }, [id,history,client,cancelViewed]);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true; setFocused(true);
    return () => { focusedRef.current = false; setFocused(false); typing.clear(); cancelViewed(); };
  }, [id, history, typing.clear, cancelViewed]));
  useEffect(() => { if (c?.control === 'assistant_allowed') setPauseState('idle'); }, [c?.control]);
  const last = snapshot?.lastMessages.find(m => group ? m.id===group.lastMessageId : m.conversationId === id);
  const loadedVersion = useRef<string | null>(null);
  const pendingHistory = useRef<{history:HistoryCache;version:string;request:Promise<unknown>} | null>(null);
  const [readyVersion, setReadyVersion] = useState<string | null>(null);
  const historyVersion=group?.revision ?? snapshot?.historyVersions[id] ?? 0;
  const version = JSON.stringify([id,draftId,historyVersion,last?.id,last?.text,last?.reaction,last?.media?.access]);
  useEffect(() => {
    if (!id || status !== 'online' || paging || loadedVersion.current===version && history.get(id) && !history.get(id)?.stale) return;
    let active = true;
    const previous = pendingHistory.current;
    void (async () => {
      // A new version must not adopt the response from an older in-flight fetch.
      if (previous?.history === history && previous.version !== version) await previous.request.catch(() => {});
      if (!active) return;
      scrolling.preserve?.();
      const openingDraft=selectedDraft && selectedNavigation.current!==selectedDraft.id;
      if(openingDraft){selectedNavigation.current=selectedDraft.id;pendingLocation.current={source:selectedDraft.triggerMessageId,draftId:selectedDraft.id};finishLocation(selectedDraft.triggerMessageId);}
      const request = selectedDraft && pendingLocation.current?.source===selectedDraft.triggerMessageId && !history.get(id)?.messages.some(message=>message.id===selectedDraft.triggerMessageId)
        && discovery?.capabilities?.historyPaging ? history.around(id,selectedDraft.triggerMessageId) : history.load(id, loadedVersion.current !== version);
      pendingHistory.current = { history, version, request };
      await request;
      if (active) { loadedVersion.current = version; setReadyVersion(version); setHistoryError(null); }
    })().catch(e => { if (active) { setHistoryError(e instanceof Error ? e.message : 'Could not load messages. Cached text is stale.'); } });
    return () => { active = false; };
  }, [id, history, version, status, paging]);
  useEffect(()=>{
    if(!draftReady||status!=='online'||!id||readOnly)return;
    const hasText=occupied;
    if(composerState.current?.id===id&&composerState.current.hasText===hasText)return;
    let active=true;let retry:ReturnType<typeof setTimeout> | undefined;
    setPauseState('pending');
    void composer(id,hasText).then(()=>{
      if(active){composerState.current={id,hasText};setPauseState('acknowledged');}
    }).catch(e=>{
      if(active){composerState.current=null;setPauseState('failed');reportError(e instanceof Error?e.message:'AI pause was not acknowledged.');retry=setTimeout(()=>setComposerRetry(n=>n+1),2000);}
    });
    return()=>{active=false;clearTimeout(retry);};
  },[id,occupied,draftReady,status,composer,composerRetry,readOnly]);
  const seenMessage = useRef<string | null>(null);
  useEffect(() => {
    cancelViewed();
    const visible=new Set(scrolling.visibleIds ?? []);
    const ids=messages.filter(message=>visible.has(message.id) && message.direction==='inbound'
      && !cached?.unavailableSourceIds?.includes(message.id)).map(message=>message.id).slice(0,100);
    const key=JSON.stringify([historyVersion,ids]);
    if (!ids.length || !discovery?.capabilities?.historyPaging || !focused || !foreground || !positioned || !scrolling.settled || historyError || cached?.stale || paging || viewer
      || readyVersion !== version || status !== 'online' || seenMessage.current === key) return;
    viewedTimer.current = setTimeout(() => {
      if (!focusedRef.current || !isForeground() || position.dragging || position.target!==null || scrolling.isVisibilityCurrent?.()===false
        || !currentScreen() || history.get(id)!==cached) return;
      seenMessage.current = key;
      void viewedMessages(id, ids).catch(() => { if (seenMessage.current === key) seenMessage.current = null; });
    }, 600);
    return cancelViewed;
  }, [id, cached, historyVersion, version, readyVersion, focused, foreground, positioned, scrolling.visibilityRevision, scrolling.settled, historyError, paging, viewer, status, viewedMessages, position, cancelViewed]);
  useEffect(()=>{
    if(!draftUnconfirmed || draftFeedback?.draft || !c || draftUnknownScope.current?.id!==id || draftUnknownScope.current.client!==client)return;
    const available=snapshot?.drafts.filter(draft=>draft.accountId===snapshot.accountId && draft.conversationId===id
      && draft.workflowVersion===c.workflowVersion && ['pending','needs_owner'].includes(draft.state)).sort((a,b)=>b.createdAt-a.createdAt)[0];
    if(available)setDraftFeedback({text:'A current draft is available. The earlier request outcome is still unconfirmed.',draft:available});
  },[snapshot,id,c,draftUnconfirmed,draftFeedback]);
  const currentScreen = () => alive.current && activeId.current===id && activeClient.current===client;
  const closeViewer=()=>{
    if(!currentScreen())return;
    viewerOpen.current=false;mediaCache?.setViewerOpen(false);voice.current?.setViewerBlocked(false);setViewer(null);scrolling.restore?.();
  };
  const openViewer=(message:Message)=>{
    if(!currentScreen() || !discovery?.capabilities?.privateMediaCache || viewerOpen.current)return;
    if(pickerBusy.current || voice.current?.isBusy() || voice.current?.setViewerBlocked(true)===false){setHistoryError('Close the picker or finish microphone preparation, recording or audio stop before opening media.');return;}
    viewerOpen.current=true;cancelViewed();scrolling.preserve?.();pendingLocation.current=null;pagingRead.current++;history.cancelPageReads?.(id);setPaging(false);mediaCache.setViewerOpen(true);setViewer(message);
  };
  useLayoutEffect(()=>{if(viewer && (!focused || !foreground))closeViewer();},[viewer,focused,foreground]);
  useEffect(()=>{if(viewer){const current=messages.find(message=>message.id===viewer.id);
    const revoke=()=>{mediaCache.invalidate(viewer);closeViewer();};
    if(cached?.unavailableSourceIds?.includes(viewer.id) || current && (!current.media || current.media.viewOnce || current.media.access==='expired')){revoke();return;}
    if(viewer.media?.kind==='video'){
      const expiresAt=current?.media?.expiresAt ?? viewer.media.expiresAt;
      if(expiresAt!==null){let timer:ReturnType<typeof setTimeout>;
        const check=()=>{const remaining=expiresAt-clock.now();if(remaining<=0)revoke();else timer=setTimeout(check,Math.min(remaining,2147483647));};
        check();return()=>clearTimeout(timer);
      }
    }
  }},[cached,viewer,mediaCache,clock]);
  useEffect(()=>{if(focused && foreground)void mediaCache?.revalidate();},[mediaCache,historyVersion,focused,foreground]);
  const requestDraft = async () => {
    if (!id || readOnly || draftRequest.current || status !== 'online') return;
    const requestId=randomUUID(); draftRequest.current=requestId;
    setDrafting(true);setDraftUnconfirmed(false);setDraftFeedback({text:'Drafting. Waiting for the Windows service.'});
    try {
      const draft=await mutate('/v1/conversations/'+encodeURIComponent(id)+'/draft',Draft,{requestId});
      if(!currentScreen() || draftRequest.current!==requestId)return;
      if(draft.conversationId!==id || draft.accountId!==snapshot?.accountId) {
        setDraftFeedback({text:'The conversation changed. This draft is not available here.'});return;
      }
      setDraftFeedback({text:'Draft ready',draft});
    } catch(error) {
      if(!currentScreen() || draftRequest.current!==requestId)return;
      const unconfirmed=!(error instanceof ApiError) || error.code==='service_error';
      draftUnknownScope.current=unconfirmed?{id,client}:null;
      setDraftUnconfirmed(unconfirmed);
      setDraftFeedback({text:!unconfirmed && error instanceof ApiError ? error.message+' Review the conversation before requesting another draft.'
        : 'Draft outcome unconfirmed. Refresh status to check for a current draft. Do not repeat the request yet.'});
    } finally {
      if(currentScreen() && draftRequest.current===requestId){draftRequest.current=null;setDrafting(false);}
    }
  };
  const sendComposed=async()=>{
    if(!id || readOnly || !draftReady || status!=='online' || (!text.trim() && !attachment && !audioClip))return;
    const revision=composeRevision.current;
    scrolling.latest();
    try {
      const before=new Set(intents.get().map(row=>row.requestId));
      const capture=intents.enqueue({conversationId:id,composerIdentity,revision,text:text.trim(),quotedMessageId:quote?.id ?? null,
        ...(attachment?{image:attachment}:{}),...(audioClip?{clip:audioClip}:{})},()=>{
        if(!currentScreen() || composeRevision.current!==revision)return;
        composeRevision.current++;setText('');setAttachment(null);setAudioClip(null);setQuote(null);
      });
      const captured=intents.get().find(row=>row.conversationId===id && row.revision===revision && !before.has(row.requestId));
      if(captured)jumpRequests.current.add(captured.requestId);
      await capture;
    } catch(error){if(currentScreen())reportError(error instanceof Error?error.message:'Message could not be saved. Your composition is unchanged.');}
  };
  const restoreIntent=(row:PendingIntent)=>{
    void intents.restore(row.requestId,value=>{
      if(!currentScreen() || row.conversationId!==id || readOnly || text || quote || attachment || audioClip || picking || audioBusy)return false;
      composeRevision.current++;setText(value.text);
      setQuote(messages.find(message=>message.id===value.quotedMessageId) ?? null);
      if(value.mediaKind)reportError('Attachment unavailable here. Reattach it explicitly before sending.');
      else if(value.quotedMessageId && !messages.some(message=>message.id===value.quotedMessageId))reportError('The original quote is unavailable. Select a valid quote before sending.');
      return true;
    }).catch(error=>{if(currentScreen())reportError(error instanceof Error?error.message:'Could not restore this message.');});
  };
  const holdComposer=async()=>{
    if(readOnly || viewerOpen.current)throw new Error('Close the viewer and open the current conversation before choosing media.');
    await composer(id,true);
    if(!alive.current || activeId.current!==id || activeClient.current!==client)throw new Error('Conversation changed. Try again.');
    composerState.current={id,hasText:true};setPauseState('acknowledged');
  };
  const chooseReaction=(emoji:string)=>{
    if(!selected || readOnly)return;
    const action=OwnerAction.safeParse({kind:'reaction',reaction:{targetMessageId:selected.id,emoji},reason:'Owner manual reaction.'});
    if(!action.success){reportError('Choose one emoji for a reaction.');return;}
    const revision=selectedGesture.current;
    void intents.enqueue({conversationId:id,composerIdentity:composerIdentity+':reaction',revision,text:'',quotedMessageId:null,action:action.data},()=>{})
      .catch(error=>{if(currentScreen())reportError(error instanceof Error?error.message:'Reaction could not be saved.');});
    setSelected(null);setReactionPicker(false);setReactionEmoji('');
  };
  const busy=picking || audioBusy;
  const turnDrafts=new Map<string,Draft>();
  const localDraft=draftFeedback?.draft;
  const allDrafts=[...(localDraft?[localDraft]:[]),...(snapshot?.drafts ?? [])];
  for(const original of allDrafts)if(memberIds.includes(original.conversationId)){
    const physical=snapshot?.conversations.find(value=>value.id===original.conversationId);
    const draft=physical && physical.workflowVersion>original.workflowVersion && original.state==='pending' ? {...original,state:'stale' as const} : original;
    const previous=turnDrafts.get(draft.triggerMessageId);
    if(!previous || draft.createdAt>previous.createdAt || draft.id===previous.id && draft.revision>=previous.revision)turnDrafts.set(draft.triggerMessageId,draft);
  }
  if(selectedDraft){const shown=turnDrafts.get(selectedDraft.triggerMessageId);if(!shown || shown.id!==selectedDraft.id)turnDrafts.set(selectedDraft.triggerMessageId,selectedDraft);}
  const feedbackDraft=localDraft ? turnDrafts.get(localDraft.triggerMessageId) : undefined;
  const draftOutcome=feedbackDraft ? feedbackDraft.state==='stale' ? 'The conversation changed. This draft is outdated.'
    : feedbackDraft.action.kind==='silence' ? 'No reply suggested. '+feedbackDraft.action.reason
    : feedbackDraft.action.kind==='handover' || feedbackDraft.state==='needs_owner' ? 'Needs your input. '+feedbackDraft.action.reason
    : feedbackDraft.state==='pending' ? 'Draft ready' : 'Draft '+feedbackDraft.state : draftFeedback?.text;
  const pageHistory=async(direction:'older'|'newer'|'latest'|'refresh')=>{
    if(paging && direction!=='latest')return;const request=++pagingRead.current;
    if(direction==='latest')pendingLocation.current=null;
    cancelViewed();scrolling.preserve?.();setPaging(true);
    try {await (direction==='refresh' || !discovery?.capabilities?.historyPaging ? history.load(id,true):history[direction](id));
      if(!currentScreen() || request!==pagingRead.current)return;
      loadedVersion.current=version;setHistoryError(null);setReadyVersion(version);if(direction==='latest')scrolling.latest();else scrolling.restore?.();
    }catch(error){if(currentScreen() && request===pagingRead.current)setHistoryError(error instanceof Error?error.message:'Could not load this page. Cached text is stale.');}
    finally {if(currentScreen() && request===pagingRead.current)setPaging(false);}
  };
  useEffect(()=>{for(const row of pending)if(jumpRequests.current.has(row.requestId) && row.phase==='accepted'){
    jumpRequests.current.delete(row.requestId);
    if(focused && foreground && position.following && discovery?.capabilities?.historyPaging)void pageHistory('latest');
  }},[pending,focused,foreground]);
  const locateSource=async(source:string,selectedId?:string)=>{
    cancelViewed();
    if(cached?.unavailableSourceIds?.includes(source)){setHistoryError('The original source has conflicting copies and is unavailable.');return;}
    const request=++pagingRead.current;scrolling.preserve?.();pendingLocation.current={source,draftId:selectedId};
    if(messages.some(message=>message.id===source)){history.cancelPageReads?.(id);history.pin?.(id,{id:source,offset:0});setPaging(false);finishLocation(source);return;}
    if(!discovery?.capabilities?.historyPaging){setHistoryError('This service only provides the latest message window. The original source is not loaded.');return;}
    setPaging(true);
    try {const page=await history.around(id,source);if(!currentScreen() || request!==pagingRead.current)return;
      if(!page.messages.some(message=>message.id===source) || page.unavailableSourceIds?.includes(source)){
        pendingLocation.current=null;setHistoryError('The original source is missing, conflicting or expired.');
      }else {loadedVersion.current=version;setHistoryError(null);setReadyVersion(version);}
    }catch(error){if(currentScreen() && request===pagingRead.current)setHistoryError(error instanceof Error?error.message:'The original source could not be loaded.');}
    finally {if(currentScreen() && request===pagingRead.current)setPaging(false);}
  };
  const viewDraft=async()=>{if(feedbackDraft)await locateSource(feedbackDraft.triggerMessageId,feedbackDraft.id);};
  const displayedDraftIds=new Set([...turnDrafts.values()].filter(draft=>['pending','needs_owner','stale'].includes(draft.state) || draft.id===draftId || draft.id===localDraft?.id).map(draft=>draft.id));
  const turnIds=[...messages.map(message=>message.id),...[...turnDrafts].filter(([source,draft])=>displayedDraftIds.has(draft.id) && !messages.some(message=>message.id===source)).map(([source])=>source)];
  function finishLocation(source:string,measured=false){
    const target=pendingLocation.current;if(!currentScreen() || target?.source!==source || scrolling.hasCurrentGeometry?.()===false)return;
    if(target.bodyLocated && scrolling.position.editor!==null){pendingLocation.current=null;return;}
    const actual=history.get(id)?.messages.some(message=>message.id===source);
    if(target.bodyLocated && (!actual || !target.contextArrived))return;
    if(target.bodyLocated && actual && !measured){requestAnimationFrame(()=>{if(pendingLocation.current===target)finishLocation(source,true);});return;}
    const offset=turns.current.get(source),card=target.draftId && displayedDraftIds.has(target.draftId)?draftOffsets.current.get(target.draftId):0;
    if(offset===undefined || card===undefined || !actual && !target.draftId)return;
    scrolling.locate(offset+card,()=>{
      if(pendingLocation.current!==target)return;
      if(actual)pendingLocation.current=null;else target.bodyLocated=true;
    });
  }
  useLayoutEffect(()=>{
    for(const message of messages){const previous=knownMedia.current.get(message.id);
      if(previous?.media && !message.media || cached?.unavailableSourceIds?.includes(message.id))mediaCache?.invalidate(previous ?? message);
    }
    knownMedia.current=new Map(messages.filter(message=>message.media).map(message=>[message.id,message]));
    const target=pendingLocation.current;
    if(target && !target.contextArrived && messages.some(message=>message.id===target.source))target.contextArrived=true;
    scrolling.retainRows?.(messages.map(message=>message.id),turnIds,layouts=>{
      if(!currentScreen() || history.get(id)!==cached)return;
      turns.current.clear();
      for(const [source,row] of layouts){
        turns.current.set(source,row.y);
        const draft=turnDrafts.get(source);if(draft)draftOffsets.current.set(draft.id,row.sourceY+row.sourceHeight);
      }
      const target=pendingLocation.current;if(target)finishLocation(target.source);
    });
  },[cached,turnIds.join('\n'),[...displayedDraftIds].join('\n')]);
  const header = <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingRight: 4, gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Chats" onPress={() => router.dismissTo('/(tabs)')}
      style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <ChevronLeft color={palette.text} size={24}/>
    </Pressable>
    {c && <Avatar name={c.name} size={40}/>}
    <View style={{ flex: 1, minWidth: 0, paddingVertical: 8, gap: 3 }}>
      <Text accessibilityRole="header" style={{ color: palette.text, fontFamily: fonts.semibold, fontSize: 18 }}>{c?.name ?? 'Conversation'}</Text>
      {c && <View style={{ alignSelf: 'flex-start' }}><ChatBadge conversation={c} pending={[...turnDrafts.values()].some(d => d.state === 'pending')}/></View>}
    </View>
    {c && <Pressable accessibilityRole="button" accessibilityLabel="Contact permissions" onPress={() => setPermissions(true)}
      style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><SlidersHorizontal color={palette.text} size={22}/></Pressable>}
  </View>;
  if (!c) return <Page header={header} bottomInset><Text style={{ color: palette.muted, fontFamily: fonts.regular }}>Conversation unavailable. Connect to the service first.</Text></Page>;
  return <Page scroll={false} header={header} bottomInset>
    {readOnly && <View style={{padding:12,gap:8}}><Text style={{color:palette.muted}}>This is a retired identity. History and original pending work are read-only. Your local draft stays here.</Text><Button label="Open current conversation" secondary onPress={()=>router.push({pathname:'/conversation/[id]',params:{id:group.id}})}/></View>}
    {!readOnly && c.kind === 'direct' && c.mode !== 'never_reply' && !c.excluded && <View style={{ paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderColor: palette.border }}>
      <PauseControls conversation={c}/>
      {c.control !== 'manual' && <Pressable accessibilityRole="button" accessibilityState={{ busy: drafting, disabled: drafting || draftUnconfirmed || status !== 'online' }}
        disabled={drafting || draftUnconfirmed || status !== 'online'} onPress={() => { void requestDraft(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 48, paddingHorizontal: 8 }}>
        {drafting && <ActivityIndicator size="small" color={palette.accent}/>}
        <Text style={{ color: palette.accent, fontFamily: fonts.semibold, fontSize: 12, lineHeight:18 }} numberOfLines={1}>{drafting ? 'Drafting…' : 'Draft reply'}</Text>
      </Pressable>}
    </View>}
    {(snapshot?.conversations ?? []).filter(member=>member.id!==id && memberIds.includes(member.id) && (member.control==='manual' || member.pause?.composing || member.pause?.sending || member.pause?.handover || member.pause?.indefinite)).map(member=><View key={member.id} style={{paddingHorizontal:12,paddingVertical:6}}><Text style={{color:palette.muted,fontSize:12}}>Linked original identity: {member.name}. {member.pause?.sending?'Send in progress. ':''}{member.pause?.composing?'Composer hold. ':''}{member.pause?.handover?'Owner handover. ':''}{member.control==='manual'?'Manual control.':''} No request or local draft is moved.</Text><Button label="View original identity" secondary onPress={()=>router.push({pathname:'/conversation/[id]',params:{id:member.id}})}/></View>)}
    {localDraftIds.filter(original=>original!==id && memberIds.includes(original)).map(original=><View key={'local-'+original} style={{paddingHorizontal:12,paddingVertical:6}}><Text style={{color:palette.muted,fontSize:12}}>A local draft remains on the original identity. It is not moved into this composer.</Text><Button label="Open original local draft" secondary onPress={()=>router.push({pathname:'/conversation/[id]',params:{id:original}})}/></View>)}
    {draftFeedback && <View accessibilityLiveRegion="polite" style={{paddingHorizontal:16,paddingVertical:8,gap:4,borderBottomWidth:1,borderColor:palette.border}}>
      <Text style={{color:palette.text,fontFamily:fonts.regular,fontSize:13}}>{draftOutcome}</Text>
      {((draftUnconfirmed && !!draftFeedback.draft) || draftFeedback.text.startsWith('Draft ready.')) && <Text style={{color:palette.muted,fontSize:12}}>{draftFeedback.text}</Text>}
      {feedbackDraft && ['pending','needs_owner','stale'].includes(feedbackDraft.state) && feedbackDraft.action.kind!=='silence' && <Button label="View draft" secondary onPress={()=>{void viewDraft();}}/>}
      {draftUnconfirmed && <Button label="Refresh draft status" secondary disabled={status!=='online'} onPress={()=>{void refresh();}}/>}
    </View>}
    <View style={{ flex: 1, minHeight: 0 }}>
      {(historyError || cached?.stale || cached?.notice) && <View style={{padding:10,gap:6}}><Text accessibilityRole="alert" style={{color:palette.muted}}>{historyError ?? cached?.notice ?? 'Showing stale cached text. Visibility is not acknowledged.'}</Text><Button label="Refresh history" secondary disabled={paging || status!=='online'} onPress={()=>{void pageHistory('refresh');}}/></View>}
      {!discovery?.capabilities?.historyPaging && <Text style={{color:palette.muted,paddingHorizontal:12,fontSize:12}}>Latest message window only. Update the Windows service for older history.</Text>}
      <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView key={'history:'+id} ref={scroll} contentInsetAdjustmentBehavior="never" keyboardDismissMode="none" keyboardShouldPersistTaps="always"
        accessibilityLabel="Conversation history" scrollEnabled style={{ flex: 1 }}
        onLayout={scrolling.onLayout} onContentSizeChange={scrolling.onContentSizeChange}
        onScrollBeginDrag={()=>{pendingLocation.current=null;scrolling.onScrollBeginDrag();}} onScrollEndDrag={scrolling.onScrollEndDrag}
        onMomentumScrollBegin={()=>{pendingLocation.current=null;scrolling.onMomentumScrollBegin();}} onMomentumScrollEnd={scrolling.onMomentumScrollEnd}
        scrollEventThrottle={16} onScroll={scrolling.onScroll}>
        <View ref={scrolling.content} collapsable={false} testID="history-content" style={{ width: '100%', maxWidth: 784, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12+scrolling.editorSpace, gap: 4 }}>
        {!cached && <View style={{ padding: 24, alignItems: 'center' }}>{historyError ? <Text style={{ color: palette.muted, fontFamily: fonts.regular }}>Could not load messages.</Text> : <ActivityIndicator color={palette.accent}/>}</View>}
        {cached?.hasOlder && <Button label="Load older" secondary disabled={paging || status!=='online'} onPress={()=>{void pageHistory('older');}}/>}
        {turnIds.map(source=>{
          const m=messages.find(message=>message.id===source),draft=turnDrafts.get(source);
          const refs=scrolling.rowRefs?.(source);
          return <View key={source} ref={refs?.turn} collapsable={false} testID={'turn-'+source} onLayout={event=>{
            if(!currentScreen() || history.get(id)?.messages!==cached?.messages)return;
            const {y}=event.nativeEvent.layout;turns.current.set(source,y);
            scrolling.refreshRows?.();finishLocation(source);
          }}>
            <View key={m?'source':'missing-source'} ref={refs?.source} collapsable={false} onLayout={event=>{
              if(!currentScreen() || history.get(id)?.messages!==cached?.messages)return;
              const {y,height}=event.nativeEvent.layout;scrolling.refreshRows?.();
              // The card follows this measured sibling with no intervening margin. Keep its editor mounted when the source first arrives.
              if(draft)draftOffsets.current.set(draft.id,y+height);finishLocation(source);
            }}>{m ? cached?.unavailableSourceIds?.includes(source) ? <Text style={{color:palette.muted,padding:8}}>Original source unavailable. Its verified copies conflict.</Text> : <MessageBubble message={m} active={focused && foreground && !viewer} visible={scrolling.visibleIds?.includes(m.id) ?? false} onOpenMedia={openViewer} quoted={messages.find(q=>q.id===m.quotedMessageId)} onSelect={selectMessage} onQuote={quoteMessage} onQuoteSource={source=>{void locateSource(source);}}/>
              : <View style={{padding:8,gap:4}}><Text style={{color:palette.muted,fontSize:12}}>{historyError ? 'Original source unavailable. The known draft is kept below.' : 'Original source is not loaded. The known draft is kept below.'}</Text><Button label="View original source" secondary disabled={paging || status!=='online'} onPress={()=>{void locateSource(source,draft?.id);}}/></View>}</View>
            {draft && displayedDraftIds.has(draft.id) && <View key={'draft-'+draft.id} onLayout={event=>{if(currentScreen() && history.get(id)?.messages===cached?.messages){draftOffsets.current.set(draft.id,event.nativeEvent.layout.y);scrolling.refreshRows?.();finishLocation(source);}}} style={{paddingVertical:8}}><DraftCard draft={draft} sourceReady={!!m && !cached?.stale && !historyError && readyVersion===version && !cached?.unavailableSourceIds?.includes(source) && !readOnly && (!group || draft.conversationId===group.id)} onEditorFocus={scrolling.editorFocus} onSent={()=>{if(discovery?.capabilities?.historyPaging)void pageHistory('latest');else scrolling.latest();}}/></View>}
          </View>;
        })}
        {cached?.hasNewer && <Button label="Load newer" secondary disabled={paging || status!=='online'} onPress={()=>{void pageHistory('newer');}}/>}
        {pending.filter(row=>memberIds.includes(row.conversationId) && intentVisible(row,messages)).map(row=><View key={row.requestId} accessibilityLabel="Pending outgoing message" accessibilityLiveRegion="polite"
          style={{alignSelf:'flex-end',maxWidth:'86%',padding:12,gap:5,borderRadius:12,backgroundColor:palette.outgoing}}>
          <Text selectable style={{color:palette.text,fontFamily:fonts.regular,fontSize:15}}>{row.text || row.action && 'reaction' in row.action && row.action.reaction.emoji || row.mediaKind || 'Message'}</Text>
          {row.quotedMessageId && <Text style={{color:palette.muted,fontSize:12}}>Quoted reply</Text>}
          <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>{({preparing:'Preparing',waiting:'Waiting behind earlier message',uploading:'Uploading',sending:'Sending',pending:'Pending',accepted:'Accepted by transport',uncertain:'Outcome uncertain. Do not resend.',failed:'Not sent',stopped:'Not submitted'})[row.phase]}</Text>
          {row.outbox && <OutboxStatus outbox={row.outbox} simulated={row.simulated ?? snapshot?.demo}/>}
          {row.detail && <Text style={{color:palette.muted,fontSize:12}}>{row.detail}</Text>}
          {['failed','stopped','waiting'].includes(row.phase) && (row.conversationId===id && !readOnly ? <Button label="Restore to composer" secondary onPress={()=>restoreIntent(row)}/>
            : <Button label="View original pending identity" secondary onPress={()=>router.push({pathname:'/conversation/[id]',params:{id:row.conversationId}})}/>)}
        </View>)}
        {(snapshot?.outbox ?? []).filter(box=>memberIds.includes(box.conversationId) && ['unknown','partial','queued','dispatching'].includes(box.state)
          && !pending.some(row=>row.outbox?.id===box.id && intentVisible(row,messages))).map(box=><View key={box.id} style={{padding:10,gap:4}}><OutboxStatus outbox={box} simulated={snapshot?.demo}/></View>)}
        </View>
      </ScrollView>
      {(scrolling.showLatest || cached?.hasNewer) && <Pressable accessibilityRole="button" accessibilityLabel="Jump to latest message" onPress={()=>{void pageHistory('latest');}}
        style={{ position: 'absolute', right: 16, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10,
          minHeight: 48, borderRadius: 24, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
        <ChevronDown size={18} color={palette.accent}/><Text style={{ color: palette.accent, fontFamily: fonts.semibold, fontSize: 13 }}>Latest</Text>
      </Pressable>}
      </View>
      {emojiOpen && <View accessibilityLabel="Emoji picker" style={{flexDirection:'row',flexWrap:'wrap',paddingHorizontal:16,paddingVertical:6,gap:4,backgroundColor:palette.surface}}>
        {emojis.map(emoji => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={'Insert '+emoji} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => {
            const start=Math.min(selection?.start ?? text.length,text.length);
            const end=Math.min(selection?.end ?? start,text.length);
            const next=text.slice(0,start)+emoji+text.slice(end);
            if(next.length>4000)return;
            editText(next); setSelection({start:start+emoji.length,end:start+emoji.length});
            typing.focus();
          }}><Text style={{fontSize:24}}>{emoji}</Text></Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Close emoji picker" style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }} onPress={() => setEmojiOpen(false)}><X size={22} color={palette.muted}/></Pressable>
      </View>}
      {attachment && <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:10,marginHorizontal:16,backgroundColor:palette.surface,borderRadius:12}}>
        <Image source={{uri:attachment.uri}} accessibilityLabel="Selected image preview" contentFit="contain" style={{width:110,height:100}}/>
        <Text style={{flex:1,color:palette.muted,fontFamily:fonts.regular,fontSize:13}}>Add a caption below</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove image" disabled={busy} style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }} onPress={()=>{composeRevision.current++;setAttachment(null);}}><X color={palette.muted} size={20}/></Pressable>
      </View>}
      {quote && <View style={{ padding: 12, marginHorizontal: 16, borderLeftWidth: 3, borderColor: palette.accent, backgroundColor: palette.surface, flexDirection: 'row', gap: 8 }}>
        <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.regular, color: palette.muted, fontSize: 13 }}>{quote.text || quote.media?.kind}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove quote" style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }} onPress={() => editQuote(null)}><X size={18} color={palette.muted}/></Pressable>
      </View>}
      <VoiceComposer key={'voice:'+id} ref={voice} clip={audioClip} active={focused && foreground && !viewer} scope={client} inactiveReason={!foreground ? 'background' : 'chat'}
        disabled={!!viewer || readOnly || busy || !draftReady || status!=='online'} canSend={!!text.trim() || !!attachment || !!audioClip} sending={false}
        onSend={()=>{void sendComposed();}} onClip={clip=>{
          if(!alive.current || activeId.current!==id || activeClient.current!==client){clip?.release();return;}
          composeRevision.current++;setAudioClip(clip);
        }} onBusyChange={setAudioBusy} beforePick={holdComposer}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 0, minWidth: 0, minHeight: 48, backgroundColor: palette.surface, borderRadius: 24, paddingHorizontal: 0, paddingVertical: 0 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose emoji" accessibilityState={{expanded:emojiOpen}} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }} onPress={() => setEmojiOpen(open=>!open)}><Smile size={21} color={palette.muted}/></Pressable>
          <TextInput ref={input} accessibilityLabel="Message" value={text} multiline maxLength={4000} placeholder={attachment ? 'Caption' : 'Message'} placeholderTextColor={palette.muted}
            editable={!readOnly && draftReady && !picking && !audioBusy && !audioClip} onChangeText={editText} onFocus={typing.onFocus} onBlur={typing.onBlur} selection={selection} onSelectionChange={event => setSelection(event.nativeEvent.selection)}
            style={{ flex: 1, color: palette.text, fontFamily: fonts.regular, fontSize: 16, minWidth: 0, maxHeight: 132, paddingVertical: 12, paddingHorizontal: 0 }}/>
          <AttachmentPicker key={'attachments:'+id} audioDisabled={!!text.trim() || !!attachment} onPickAudio={()=>voice.current?.pickAudio()} disabled={!!viewer || readOnly || busy || !!audioClip || !draftReady || status!=='online'} onPick={image=>{
              if(!alive.current || activeId.current!==id || activeClient.current!==client){if(process.env.EXPO_OS==='web' && image.uri.startsWith('blob:'))URL.revokeObjectURL(image.uri);return;}
              composeRevision.current++;setAttachment(image);
            }} onBusyChange={value=>{pickerBusy.current=value;setPicking(value);}} beforePick={holdComposer}/>
        </View>
      </VoiceComposer>
      {pauseState !== 'idle' && <Text style={{ color: pauseState === 'failed' ? palette.danger : palette.muted, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center', paddingBottom: 7 }}>
        {pauseState === 'pending' ? 'Pause requested…' : pauseState === 'failed' ? 'Pause was not acknowledged' : 'Pause acknowledged'}
      </Text>}
    </View>
    {viewer && focused && foreground && <MediaViewer key={viewer.id} message={viewer} onClose={closeViewer}
      canPlay={()=>{
        const current=messages.find(message=>message.id===viewer.id);
        return currentScreen() && viewerOpen.current && focusedRef.current && isForeground() && !pickerBusy.current && !voice.current?.isBusy()
          && !cached?.unavailableSourceIds?.includes(viewer.id) && (!current || !!current.media && !current.media.viewOnce && current.media.access!=='expired'
            && (current.media.expiresAt===null || current.media.expiresAt>clock.now()));
      }}/>}
    <PermissionSheet conversation={c} visible={permissions} onClose={() => setPermissions(false)}/>
    <Modal transparent visible={selected !== null} animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
        <Pressable style={{ flex: 1 }} onPress={() => setSelected(null)}/>
        <View style={{ padding: 22, gap: 12, backgroundColor: palette.background, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <Button label="Quote this message" onPress={() => { quoteMessage(selected); setSelected(null); }}/>
          <View style={{ flexDirection: 'row', flexWrap:'wrap', gap:4 }}>{(reactionPicker ? emojis : ['👍','😂','❤️','🙏','🎉','😮','😢','🔥']).map(emoji =>
            <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={'React '+emoji} disabled={readOnly || busy || status!=='online'} onPress={()=>chooseReaction(emoji)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:24}}>{emoji}</Text></Pressable>)}</View>
          {!reactionPicker ? <Button label="More emoji" secondary onPress={()=>setReactionPicker(true)}/> : <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <TextInput accessibilityLabel="Another reaction emoji" placeholder="Paste or type one emoji" placeholderTextColor={palette.muted} value={reactionEmoji} onChangeText={setReactionEmoji} maxLength={64}
              style={{flex:1,color:palette.text,fontFamily:fonts.regular,fontSize:16}}/>
            <Button label="React" disabled={!reactionEmoji || busy || status!=='online'} onPress={()=>chooseReaction(reactionEmoji)}/>
          </View>}
          <Button label="Cancel" secondary onPress={() => setSelected(null)}/>
        </View>
      </View>
    </Modal>
  </Page>;
}
