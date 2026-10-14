import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Send, SlidersHorizontal, Smile, X } from 'lucide-react-native';
import { randomUUID } from '../../lib/uuid';
import { Draft, type Message, type OwnerAction } from '@replybot/core/contracts';
import { Image } from 'expo-image';
import { VoiceComposer } from '../../components/voice-composer';
import type { AudioClip } from '../../lib/audio-clip';
import { AttachmentPicker,type PickedImage } from '../../components/attachment-picker';
import { Page, Button } from '../../components/ui';
import { ChatBadge } from '../../components/chat-badge';
import { MessageBubble } from '../../components/message-bubble';
import { DraftCard } from '../../components/draft-card';
import { PauseControls } from '../../components/pause-controls';
import { PermissionSheet } from '../../components/permission-sheet';
import { useApp } from '../../lib/app-state';
import { SendResult } from '../../lib/api';
import { useLocalDraft } from '../../lib/local-drafts';
import { fonts } from '../../lib/theme';
import { HistoryCache } from '../../lib/history-cache';
import { isForeground, useForeground } from '../../lib/foreground';

const scrollPositions = new WeakMap<HistoryCache, Map<string, { offset: number; atBottom: boolean }>>();
const emojis = ['😀','😂','😊','😍','🥰','😎','🤔','😮','😢','😭','👍','👎','❤️','🙏','🎉','🔥','✅','👋'];

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const foreground = useForeground();
  const { snapshot, palette, perform, history, status, reportError, composer, viewed, client } = useApp();
  const cached = useSyncExternalStore(history.subscribe,() => history.get(id),() => undefined);
  const messages = cached?.messages ?? [];
  const [historyError, setHistoryError] = useState(false);
  const {text,setText,ready:draftReady}=useLocalDraft(id);
  const [attachment,setAttachment]=useState<PickedImage | null>(null);
  const [audioClip,setAudioClip]=useState<AudioClip | null>(null);
  const [audioBusy,setAudioBusy]=useState(false);
  const audioIntent=useRef<{clip:AudioClip;requestId:string;uploadId?:string} | null>(null);
  useEffect(()=>()=>audioClip?.release(),[audioClip]);
  const [picking,setPicking]=useState(false);const [uploading,setUploading]=useState(false);
  const uploadLock=useRef(false);const activeId=useRef(id);activeId.current=id;
  const uploadIntent=useRef<{image:PickedImage;requestId:string;uploadId?:string} | null>(null);
  const occupied=!!text || !!attachment || picking || !!audioClip || audioBusy;
  const volatileAudio=useRef({audioClip,audioBusy,text});volatileAudio.current={audioClip,audioBusy,text};
  useEffect(()=>()=>{
    const local=volatileAudio.current;
    if((local.audioClip || local.audioBusy) && !local.text)void composer(id,false).catch(()=>{});
  },[id,composer]);
  useEffect(()=>()=>{if(process.env.EXPO_OS==='web' && attachment?.uri.startsWith('blob:'))URL.revokeObjectURL(attachment.uri);},[attachment]);
  const composerState=useRef<{id:string;hasText:boolean} | null>(null);
  const [composerRetry,setComposerRetry]=useState(0);
  const [quote, setQuote] = useState<Message | null>(null); const [selected, setSelected] = useState<Message | null>(null);
  const input = useRef<TextInput>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [selection, setSelection] = useState<{start:number;end:number} | undefined>();
  const [permissions, setPermissions] = useState(false); const [pauseState, setPauseState] = useState<'idle'|'pending'|'acknowledged'|'failed'>('idle');
  const [sending, setSending] = useState(false); const sendLock = useRef(false);
  const [drafting, setDrafting] = useState(false); const draftLock = useRef(false);
  const pendingIntent = useRef<{ key: string; requestId: string } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const position = useMemo(() => {
    const saved = scrollPositions.get(history)?.get(id);
    return { offset: saved?.offset ?? 0, initialOffset: saved?.offset ?? 0, atBottom: saved?.atBottom ?? true, height: 0, contentHeight: 0, positioned: false };
  }, [id, history]);
  const [positioned, setPositioned] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const viewedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelViewed = useCallback(() => { clearTimeout(viewedTimer.current); }, []);
  const frames = useRef<number[]>([]);
  const finishPosition = () => {
    position.positioned = true;
    position.atBottom = position.contentHeight - position.height - position.offset <= 24;
    setAtBottom(position.atBottom);
    setPositioned(true);
  };
  const scrollToLatest = () => {
    if (!cached || position.height <= 0 || position.positioned && !position.atBottom) return;
    frames.current.forEach(cancelAnimationFrame);
    frames.current = [requestAnimationFrame(() => {
      const bottom = Math.max(0, position.contentHeight - position.height);
      const target = !position.positioned && !position.atBottom ? Math.min(position.initialOffset, bottom) : bottom;
      scroll.current?.scrollTo({ y: target, animated: false });
      // Long histories are revealed by the scroll acknowledgment, not by a guessed timeout.
      if (Math.abs(position.offset - target) <= 2) {
        frames.current.push(requestAnimationFrame(finishPosition));
      }
    })];
  };
  const c = snapshot?.conversations.find(c => c.id === id);
  useLayoutEffect(() => {
    setPauseState('idle'); setHistoryError(false); setPositioned(false); setAtBottom(false);
    setEmojiOpen(false); setSelection(undefined); setQuote(null); setSelected(null);
    setAttachment(null);setPicking(false);uploadIntent.current=null;setAudioClip(null);audioIntent.current=null;setAudioBusy(false);
    composerState.current=null; seenMessage.current=null;
    return () => { frames.current.forEach(cancelAnimationFrame); cancelViewed(); };
  }, [id,history,cancelViewed]);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true; setFocused(true);
    return () => { focusedRef.current = false; setFocused(false); cancelViewed(); };
  }, [id, history, cancelViewed]));
  useEffect(() => { if (c?.control === 'assistant_allowed') setPauseState('idle'); }, [c?.control]);
  const last = snapshot?.lastMessages.find(m => m.conversationId === id);
  const loadedVersion = useRef<string | null>(null);
  const pendingHistory = useRef<{history:HistoryCache;version:string;request:Promise<unknown>} | null>(null);
  const [readyVersion, setReadyVersion] = useState<string | null>(null);
  const historyVersion=snapshot?.historyVersions[id] ?? 0;
  const version = JSON.stringify([id,historyVersion,last?.id,last?.text,last?.reaction,last?.media?.access]);
  useEffect(() => {
    if (!id || status !== 'online') return;
    let active = true;
    const previous = pendingHistory.current;
    void (async () => {
      // A new version must not adopt the response from an older in-flight fetch.
      if (previous?.history === history && previous.version !== version) await previous.request.catch(() => {});
      if (!active) return;
      const request = history.load(id, loadedVersion.current !== version);
      pendingHistory.current = { history, version, request };
      await request;
      if (active) { loadedVersion.current = version; setReadyVersion(version); setHistoryError(false); }
    })().catch(e => { if (active) { setHistoryError(true); reportError(e instanceof Error ? e.message : 'Could not load messages.'); } });
    return () => { active = false; };
  }, [id, history, version, status]);
  useFocusEffect(useCallback(()=>{
    if(status==='online'&&id&&!history.get(id))void history.load(id).catch(e=>{setHistoryError(true);reportError(e instanceof Error?e.message:'Could not load messages.');});
  },[id,history,status]));
  useEffect(()=>{
    if(!draftReady||status!=='online'||!id)return;
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
  },[id,occupied,draftReady,status,composer,composerRetry]);
  const seenMessage = useRef<string | null>(null);
  useEffect(() => {
    cancelViewed();
    const watermark = cached?.watermark;
    const key = historyVersion + ':' + watermark;
    if (!watermark || !focused || !foreground || !positioned || !atBottom || historyError
      || readyVersion !== version || status !== 'online' || seenMessage.current === key) return;
    viewedTimer.current = setTimeout(() => {
      if (!focusedRef.current || !isForeground() || !position.positioned || !position.atBottom) return;
      seenMessage.current = key;
      void viewed(id, watermark).catch(() => { if (seenMessage.current === key) seenMessage.current = null; });
    }, 600);
    return cancelViewed;
  }, [id, cached, historyVersion, version, readyVersion, focused, foreground, positioned, atBottom, historyError, status, viewed, position, cancelViewed]);
  const requestDraft = async () => {
    if (!id || draftLock.current || status !== 'online') return;
    draftLock.current = true; setDrafting(true);
    try { await perform('/v1/conversations/'+encodeURIComponent(id)+'/draft', Draft, {}); }
    finally { draftLock.current = false; setDrafting(false); }
  };
  const send = async (action: OwnerAction, quotedMessageId: string | null = null) => {
    if (!id || sendLock.current) return; sendLock.current = true; setSending(true);
    const key = JSON.stringify({ action, quotedMessageId });
    if (pendingIntent.current?.key !== key) pendingIntent.current = { key, requestId: randomUUID() };
    const result = await perform('/v1/conversations/'+encodeURIComponent(id)+'/manual-send', SendResult,
      { action, quotedMessageId, requestId: pendingIntent.current.requestId });
    if (result && result.outbox.state !== 'accepted') reportError(result.outbox.state === 'unknown' || result.outbox.state === 'partial' ? 'Send outcome is uncertain. Do not resend this message.' : 'The message was not accepted. Check WhatsApp connection.');
    if(result?.outbox.state==='accepted'){
      if(action.kind!=='reaction')setText('');
      if(activeId.current===id){position.atBottom=true;scrollToLatest();
        if(action.kind!=='reaction'){setAttachment(null);uploadIntent.current=null;setAudioClip(null);audioIntent.current=null;setQuote(null);}
        pendingIntent.current=null;setPauseState('acknowledged');}
    }
    if(result?.outbox.state==='failed')pendingIntent.current=null;
    sendLock.current=false;setSending(false);
  };
  const sendComposed=async()=>{
    if(audioClip){
      if(uploadLock.current || sendLock.current)return;uploadLock.current=true;setUploading(true);
      try {
        if(audioIntent.current?.clip!==audioClip)audioIntent.current={clip:audioClip,requestId:randomUUID()};
        const intent=audioIntent.current;
        if(!intent.uploadId)intent.uploadId=(await client.uploadAudio(id,await audioClip.bytes(),intent.requestId)).id;
        if(activeId.current!==id)return;
        await send({kind:'audio',uploadId:intent.uploadId,reason:'Owner voice note.'},quote?.id ?? null);
      }catch(error){reportError(error instanceof Error ? error.message : 'Audio could not be uploaded.');}
      finally{uploadLock.current=false;setUploading(false);}
      return;
    }
    if(!attachment){await send({kind:'text',text:text.trim(),reason:'Owner manual message.'},quote?.id ?? null);return;}
    if(uploadLock.current || sendLock.current)return;uploadLock.current=true;setUploading(true);
    try{
      if(uploadIntent.current?.image!==attachment)uploadIntent.current={image:attachment,requestId:randomUUID()};
      const intent=uploadIntent.current;
      if(!intent.uploadId)intent.uploadId=(await client.uploadImage(id,attachment.base64,intent.requestId)).id;
      await send({kind:'image',uploadId:intent.uploadId,caption:text.trim(),reason:'Owner image message.'},quote?.id ?? null);
    }catch(error){reportError(error instanceof Error ? error.message : 'The image could not be uploaded.');}
    finally{uploadLock.current=false;setUploading(false);}
  };
  const busy=sending || uploading || picking || audioBusy;
  const header = <Stack.Screen options={{
    title: c?.name ?? 'Conversation', headerBackVisible: false,
    headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Back to Chats" onPress={() => router.dismissTo('/(tabs)')}
      style={{ flexDirection:'row', alignItems:'center', paddingVertical:8, paddingRight:8 }}>
      <ChevronLeft color={palette.text} size={21}/><Text style={{color:palette.text,fontFamily:fonts.medium,fontSize:14}}>Chats</Text>
    </Pressable>,
    headerRight: c ? () => <Pressable accessibilityRole="button" accessibilityLabel="Contact permissions" onPress={() => setPermissions(true)} style={{ padding: 10 }}><SlidersHorizontal color={palette.text} size={21}/></Pressable> : undefined,
  }}/>;
  if (!c) return <Page>{header}<Text style={{ color: palette.muted, fontFamily: fonts.regular }}>Conversation unavailable. Connect to the service first.</Text></Page>;
  const turnDrafts=new Map<string,Draft>();
  for(const draft of snapshot?.drafts ?? [])if(draft.conversationId===id){
    const previous=turnDrafts.get(draft.triggerMessageId);
    if(!previous || draft.createdAt>=previous.createdAt)turnDrafts.set(draft.triggerMessageId,draft);
  }
  const drafts=[...turnDrafts.values()].filter(d=>['pending','needs_owner','stale'].includes(d.state));
  return <Page scroll={false}>
    {header}
    <View style={{ paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexDirection:'row',alignItems:'center',gap:8,flexShrink:1,minWidth:0 }}><ChatBadge conversation={c} pending={drafts.some(d => d.state === 'pending')}/><PauseControls conversation={c}/></View>
      {c.kind === 'direct' && c.mode !== 'never_reply' && !c.excluded && c.control !== 'manual' && <Pressable accessibilityRole="button" accessibilityState={{ busy: drafting, disabled: drafting || status !== 'online' }}
        disabled={drafting || status !== 'online'} onPress={() => { void requestDraft(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {drafting && <ActivityIndicator size="small" color={palette.accent}/>}
        <Text style={{ color: palette.accent, fontFamily: fonts.semibold, fontSize: 12, lineHeight:18 }} numberOfLines={1}>{drafting ? 'Drafting…' : 'Draft reply'}</Text>
      </Pressable>}
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <ScrollView key={id} ref={scroll} contentInsetAdjustmentBehavior="never" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}
        accessibilityLabel="Conversation history" accessibilityElementsHidden={!!cached && !positioned} importantForAccessibility={cached && !positioned ? 'no-hide-descendants' : 'auto'}
        scrollEnabled={positioned} style={{ flex: 1, opacity: cached && !positioned ? 0 : 1 }}
        onLayout={e => { position.height = e.nativeEvent.layout.height; scrollToLatest(); }}
        onContentSizeChange={(_, height) => { cancelViewed(); setAtBottom(false); position.contentHeight = height; scrollToLatest(); }}
        scrollEventThrottle={16} onScroll={({ nativeEvent: e }) => {
          position.offset = e.contentOffset.y;
          position.height = e.layoutMeasurement.height;
          position.contentHeight = e.contentSize.height;
          const bottom = Math.max(0, position.contentHeight - position.height);
          const target = position.atBottom ? bottom : Math.min(position.initialOffset, bottom);
          if (!position.positioned && Math.abs(position.offset - target) <= 2) finishPosition();
          if (position.positioned) {
            position.atBottom = bottom - position.offset <= 24;
            setAtBottom(position.atBottom);
            if (!position.atBottom) cancelViewed();
            let saved = scrollPositions.get(history);
            if (!saved) { saved = new Map(); scrollPositions.set(history, saved); }
            saved.set(id, { offset: position.offset, atBottom: position.atBottom });
          }
        }}>
        {!cached && <View style={{ padding: 24, alignItems: 'center' }}>{historyError ? <Text style={{ color: palette.muted, fontFamily: fonts.regular }}>Could not load messages.</Text> : <ActivityIndicator color={palette.accent}/>}</View>}
        {messages.map(m=>{
          const draft=turnDrafts.get(m.id);
          return <View key={m.id} testID={'turn-'+m.id}>
            <MessageBubble message={m} active={focused && foreground} quoted={messages.find(q=>q.id===m.quotedMessageId)} onSelect={setSelected} onQuote={setQuote}/>
            {draft && ['pending','needs_owner','stale'].includes(draft.state) && <View style={{paddingVertical:8}}><DraftCard draft={draft}/></View>}
          </View>;
        })}
      </ScrollView>
      {emojiOpen && <View accessibilityLabel="Emoji picker" style={{flexDirection:'row',flexWrap:'wrap',paddingHorizontal:16,paddingVertical:6,gap:4,backgroundColor:palette.surface}}>
        {emojis.map(emoji => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={'Insert '+emoji} style={{padding:8}}
          onPress={() => {
            const start=Math.min(selection?.start ?? text.length,text.length);
            const end=Math.min(selection?.end ?? start,text.length);
            const next=text.slice(0,start)+emoji+text.slice(end);
            if(next.length>4000)return;
            setText(next); setSelection({start:start+emoji.length,end:start+emoji.length});
            requestAnimationFrame(() => input.current?.focus());
          }}><Text style={{fontSize:24}}>{emoji}</Text></Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Close emoji picker" style={{padding:8}} onPress={() => setEmojiOpen(false)}><X size={22} color={palette.muted}/></Pressable>
      </View>}
      {attachment && <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:10,marginHorizontal:16,backgroundColor:palette.surface,borderRadius:12}}>
        <Image source={{uri:attachment.uri}} accessibilityLabel="Selected image preview" contentFit="contain" style={{width:110,height:100}}/>
        <Text style={{flex:1,color:palette.muted,fontFamily:fonts.regular,fontSize:13}}>Add a caption below</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove image" disabled={busy} onPress={()=>{setAttachment(null);uploadIntent.current=null;}}><X color={palette.muted} size={20}/></Pressable>
      </View>}
      <VoiceComposer key={id} clip={audioClip} active={focused && foreground} disabled={sending || uploading || picking || !!attachment || !!text || !draftReady || status!=='online'}
        onClip={clip=>{setAudioClip(clip);audioIntent.current=null;}} onBusyChange={setAudioBusy}
        beforePick={async()=>{await composer(id,true);composerState.current={id,hasText:true};setPauseState('acknowledged');}}/>
      {quote && <View style={{ padding: 12, marginHorizontal: 16, borderLeftWidth: 3, borderColor: palette.accent, backgroundColor: palette.surface, flexDirection: 'row', gap: 8 }}>
        <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.regular, color: palette.muted, fontSize: 13 }}>{quote.text || quote.media?.kind}</Text>
        <Pressable accessibilityLabel="Remove quote" onPress={() => setQuote(null)}><X size={18} color={palette.muted}/></Pressable>
      </View>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 24, gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: 26, padding: 13 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose emoji" accessibilityState={{expanded:emojiOpen}} onPress={() => setEmojiOpen(open=>!open)}><Smile size={21} color={palette.muted}/></Pressable>
          <TextInput ref={input} accessibilityLabel="Message" value={text} multiline maxLength={4000} placeholder={attachment ? 'Caption' : 'Message'} placeholderTextColor={palette.muted}
            editable={draftReady && !busy && !audioClip} onChangeText={setText} selection={selection} onSelectionChange={event => setSelection(event.nativeEvent.selection)}
            style={{ flex: 1, color: palette.text, fontFamily: fonts.regular, fontSize: 16, maxHeight: 110, padding: 0 }}/>
          <AttachmentPicker disabled={busy || !!audioClip || !draftReady || status!=='online'} onPick={image=>{setAttachment(image);uploadIntent.current=null;}} onBusyChange={setPicking}
            beforePick={async()=>{await composer(id,true);composerState.current={id,hasText:true};setPauseState('acknowledged');}}/>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={(!text.trim() && !attachment && !audioClip) || busy || status!=='online'} onPress={()=>{void sendComposed();}}
          style={{ height: 49, width: 49, borderRadius: 25, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', opacity: (!text.trim() && !attachment && !audioClip) || busy || status!=='online' ? 0.4 : 1 }}>{sending || uploading ? <ActivityIndicator color={palette.accentText}/> : <Send color={palette.accentText} size={22}/>}</Pressable>
      </View>
      {pauseState !== 'idle' && <Text style={{ color: pauseState === 'failed' ? palette.danger : palette.muted, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center', paddingBottom: 7 }}>
        {pauseState === 'pending' ? 'Pause requested…' : pauseState === 'failed' ? 'Pause was not acknowledged' : 'Pause acknowledged'}
      </Text>}
    </KeyboardAvoidingView>
    <PermissionSheet conversation={c} visible={permissions} onClose={() => setPermissions(false)}/>
    <Modal transparent visible={selected !== null} animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
        <Pressable style={{ flex: 1 }} onPress={() => setSelected(null)}/>
        <View style={{ padding: 22, gap: 12, backgroundColor: palette.background, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <Button label="Quote this message" onPress={() => { setQuote(selected); setSelected(null); }}/>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{(['👍','😂','❤️','🙏','🎉','😮','😢'] as const).map(emoji =>
            <Pressable key={emoji} accessibilityLabel={'React '+emoji} onPress={() => { if (selected) void send({ kind: 'reaction', reaction: { targetMessageId: selected.id, emoji }, reason: 'Owner manual reaction.' }); setSelected(null); }} style={{ padding: 8 }}><Text style={{ fontSize: 24 }}>{emoji}</Text></Pressable>)}</View>
          <Button label="Cancel" secondary onPress={() => setSelected(null)}/>
        </View>
      </View>
    </Modal>
  </Page>;
}
