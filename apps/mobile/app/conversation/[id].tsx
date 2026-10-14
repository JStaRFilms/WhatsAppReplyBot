import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Send, SlidersHorizontal, Smile, X } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';
import { Draft, type Message, type Action } from '@replybot/core/contracts';
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

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, palette, perform, history, status, reportError, composer, viewed } = useApp();
  const cached = useSyncExternalStore(history.subscribe,() => history.get(id),() => undefined);
  const messages = cached?.messages ?? [];
  const [historyError, setHistoryError] = useState(false);
  const {text,setText,ready:draftReady}=useLocalDraft(id);
  const composerState=useRef<{id:string;hasText:boolean} | null>(null);
  const [composerRetry,setComposerRetry]=useState(0);
  const [quote, setQuote] = useState<Message | null>(null); const [selected, setSelected] = useState<Message | null>(null);
  const [permissions, setPermissions] = useState(false); const [pauseState, setPauseState] = useState<'idle'|'pending'|'acknowledged'|'failed'>('idle');
  const [sending, setSending] = useState(false); const sendLock = useRef(false);
  const [drafting, setDrafting] = useState(false); const draftLock = useRef(false);
  const pendingIntent = useRef<{ key: string; requestId: string } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true); const opened = useRef(false); const viewportHeight = useRef(0);
  const scrollToLatest = () => {
    if (!opened.current || nearBottom.current) requestAnimationFrame(() => {
      scroll.current?.scrollToEnd({ animated: false });
      if (messages.length && viewportHeight.current > 0) opened.current = true;
    });
  };
  const c = snapshot?.conversations.find(c => c.id === id);
  useEffect(() => { setPauseState('idle'); setHistoryError(false); nearBottom.current = true; opened.current = false; composerState.current=null; seenMessage.current=null; }, [id,history]);
  useEffect(() => { if (c?.control === 'assistant_allowed') setPauseState('idle'); }, [c?.control]);
  const last = snapshot?.lastMessages.find(m => m.conversationId === id);
  const loadedVersion = useRef<string | null>(null);
  const historyVersion=snapshot?.historyVersions[id] ?? 0;
  const version = JSON.stringify([id,historyVersion,last?.id,last?.text,last?.reaction,last?.media?.access]);
  useEffect(() => {
    if (!id || status !== 'online') return;
    let active = true;
    const changed = loadedVersion.current !== version;
    void history.load(id,changed).then(() => { if (active) { loadedVersion.current = version; setHistoryError(false); } })
      .catch(e => { if (active) { setHistoryError(true); reportError(e instanceof Error ? e.message : 'Could not load messages.'); } });
    return () => { active = false; };
  }, [id, history, version, status]);
  useFocusEffect(useCallback(()=>{
    if(status==='online'&&id&&!history.get(id))void history.load(id).catch(e=>{setHistoryError(true);reportError(e instanceof Error?e.message:'Could not load messages.');});
  },[id,history,status]));
  useEffect(()=>{
    if(!draftReady||status!=='online'||!id)return;
    const hasText=!!text;
    if(composerState.current?.id===id&&composerState.current.hasText===hasText)return;
    let active=true;let retry:ReturnType<typeof setTimeout> | undefined;
    setPauseState('pending');
    void composer(id,hasText).then(()=>{
      if(active){composerState.current={id,hasText};setPauseState('acknowledged');}
    }).catch(e=>{
      if(active){composerState.current=null;setPauseState('failed');reportError(e instanceof Error?e.message:'AI pause was not acknowledged.');retry=setTimeout(()=>setComposerRetry(n=>n+1),2000);}
    });
    return()=>{active=false;clearTimeout(retry);};
  },[id,!!text,draftReady,status,composer,composerRetry]);
  const seenMessage = useRef<number | null>(null);
  const lastLoaded = cached?.watermark;
  useFocusEffect(useCallback(()=>{
    if(!lastLoaded||seenMessage.current===lastLoaded||status!=='online')return;
    seenMessage.current=lastLoaded;
    void viewed(id,lastLoaded,historyVersion).catch(()=>{seenMessage.current=null;});
  },[id,lastLoaded,status,viewed,historyVersion]));
  const requestDraft = async () => {
    if (!id || draftLock.current || status !== 'online') return;
    draftLock.current = true; setDrafting(true);
    try { await perform('/v1/conversations/'+encodeURIComponent(id)+'/draft', Draft, {}); }
    finally { draftLock.current = false; setDrafting(false); }
  };
  const send = async (action: Action, quotedMessageId: string | null = null) => {
    if (!id || sendLock.current) return; sendLock.current = true; setSending(true);
    const key = JSON.stringify({ action, quotedMessageId });
    if (pendingIntent.current?.key !== key) pendingIntent.current = { key, requestId: randomUUID() };
    const result = await perform('/v1/conversations/'+encodeURIComponent(id)+'/manual-send', SendResult,
      { action, quotedMessageId, requestId: pendingIntent.current.requestId });
    if (result && result.outbox.state !== 'accepted') reportError(result.outbox.state === 'unknown' || result.outbox.state === 'partial' ? 'Send outcome is uncertain. Do not resend this message.' : 'The message was not accepted. Check WhatsApp connection.');
    if (result?.outbox.state === 'accepted') { nearBottom.current = true; scrollToLatest(); setText(''); setQuote(null); pendingIntent.current = null; setPauseState('acknowledged'); }
    sendLock.current = false; setSending(false);
  };
  if (!c) return <Page><Text style={{ color: palette.muted, fontFamily: fonts.regular }}>Conversation unavailable. Connect to the service first.</Text></Page>;
  const drafts = snapshot?.drafts.filter(d => d.conversationId === id && ['pending','needs_owner','stale'].includes(d.state)) ?? [];
  return <Page scroll={false}>
    <Stack.Screen options={{ title: c.name, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Contact permissions" onPress={() => setPermissions(true)} style={{ padding: 10 }}><SlidersHorizontal color={palette.text} size={21}/></Pressable> }}/>
    <View style={{ paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
      <View style={{ flexDirection:'row',alignItems:'center',gap:8 }}><ChatBadge conversation={c} pending={drafts.some(d => d.state === 'pending')}/><PauseControls conversation={c}/></View>
      {c.kind === 'direct' && c.mode !== 'never_reply' && !c.excluded && c.control !== 'manual' && <Pressable accessibilityRole="button" accessibilityState={{ busy: drafting, disabled: drafting || status !== 'online' }}
        disabled={drafting || status !== 'online'} onPress={() => { void requestDraft(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {drafting && <ActivityIndicator size="small" color={palette.accent}/>}
        <Text style={{ color: palette.accent, fontFamily: fonts.semibold, fontSize: 12 }}>{drafting ? 'Drafting…' : 'Draft reply'}</Text>
      </Pressable>}
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}
        style={{ flex: 1 }} onLayout={e => { viewportHeight.current = e.nativeEvent.layout.height; scrollToLatest(); }} onContentSizeChange={scrollToLatest}
        scrollEventThrottle={100} onScroll={({ nativeEvent: e }) => { nearBottom.current = e.contentSize.height-e.layoutMeasurement.height-e.contentOffset.y < 80; }}>
        {!cached && <View style={{ padding: 24, alignItems: 'center' }}>{historyError ? <Text style={{ color: palette.muted, fontFamily: fonts.regular }}>Could not load messages.</Text> : <ActivityIndicator color={palette.accent}/>}</View>}
        {messages.map(m => <MessageBubble key={m.id} message={m} quoted={messages.find(q => q.id === m.quotedMessageId)} onSelect={setSelected}/>)}
        {cached && drafts.map(d => <View key={d.id} style={{ paddingVertical: 8 }}><DraftCard draft={d}/></View>)}
      </ScrollView>
      {quote && <View style={{ padding: 12, marginHorizontal: 16, borderLeftWidth: 3, borderColor: palette.accent, backgroundColor: palette.surface, flexDirection: 'row', gap: 8 }}>
        <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.regular, color: palette.muted, fontSize: 13 }}>{quote.text || quote.media?.kind}</Text>
        <Pressable accessibilityLabel="Remove quote" onPress={() => setQuote(null)}><X size={18} color={palette.muted}/></Pressable>
      </View>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 24, gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: 26, padding: 13 }}>
          <Pressable accessibilityLabel="Insert laughing emoji" onPress={() => setText(text+'😂')}><Smile size={21} color={palette.muted}/></Pressable>
          <TextInput accessibilityLabel="Message" value={text} multiline maxLength={4000} placeholder="Message" placeholderTextColor={palette.muted}
            editable={draftReady} onChangeText={setText}
            style={{ flex: 1, color: palette.text, fontFamily: fonts.regular, fontSize: 16, maxHeight: 110, padding: 0 }}/>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!text.trim() || sending || status !== 'online'} onPress={() => { void send({ kind: 'text', text: text.trim(), reason: 'Owner manual message.' }, quote?.id ?? null); }}
          style={{ height: 49, width: 49, borderRadius: 25, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', opacity: !text.trim() || sending || status !== 'online' ? 0.4 : 1 }}><Send color={palette.accentText} size={22}/></Pressable>
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
