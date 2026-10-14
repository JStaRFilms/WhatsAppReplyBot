import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Send, SlidersHorizontal, Smile, X } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';
import { Draft, type Message, type Action } from '@replybot/core/contracts';
import { Page, Button } from '../../components/ui';
import { MessageBubble } from '../../components/message-bubble';
import { DraftCard } from '../../components/draft-card';
import { PermissionSheet } from '../../components/permission-sheet';
import { useApp } from '../../lib/app-state';
import { Messages, PauseResult, SendResult } from '../../lib/api';
import { fonts } from '../../lib/theme';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, palette, perform, client, status, reportError } = useApp();
  const [messages, setMessages] = useState<Message[]>([]); const [text, setText] = useState('');
  const [quote, setQuote] = useState<Message | null>(null); const [selected, setSelected] = useState<Message | null>(null);
  const [permissions, setPermissions] = useState(false); const [pauseState, setPauseState] = useState<'idle'|'pending'|'acknowledged'|'failed'>('idle');
  const [sending, setSending] = useState(false); const sendLock = useRef(false);
  const pendingIntent = useRef<{ key: string; requestId: string } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const c = snapshot?.conversations.find(c => c.id === id);
  useEffect(() => { setPauseState('idle'); }, [id]);
  useEffect(() => { if (c?.control === 'assistant_allowed') setPauseState('idle'); }, [c?.control]);
  useEffect(() => {
    if (!id || status !== 'online') return;
    let active = true;
    void client.request('/v1/conversations/'+encodeURIComponent(id)+'/messages', Messages)
      .then(data => { if (active) setMessages(data); }).catch(e => { if (active) reportError(e instanceof Error ? e.message : 'Could not load messages.'); });
    return () => { active = false; };
  }, [id, client, snapshot, status]);
  const beginTyping = async () => {
    if (!id || pauseState !== 'idle') return;
    setPauseState('pending');
    const result = await perform('/v1/conversations/'+encodeURIComponent(id)+'/pause', PauseResult, {});
    setPauseState(result?.acknowledged ? 'acknowledged' : 'failed');
  };
  const send = async (action: Action, quotedMessageId: string | null = null) => {
    if (!id || sendLock.current) return; sendLock.current = true; setSending(true);
    const key = JSON.stringify({ action, quotedMessageId });
    if (pendingIntent.current?.key !== key) pendingIntent.current = { key, requestId: randomUUID() };
    const result = await perform('/v1/conversations/'+encodeURIComponent(id)+'/manual-send', SendResult,
      { action, quotedMessageId, requestId: pendingIntent.current.requestId });
    if (result) { setText(''); setQuote(null); pendingIntent.current = null; setPauseState('acknowledged'); }
    sendLock.current = false; setSending(false);
  };
  if (!c) return <Page><Text style={{ color: palette.muted, fontFamily: fonts.regular }}>Conversation unavailable. Connect to the service first.</Text></Page>;
  const drafts = snapshot?.drafts.filter(d => d.conversationId === id && ['pending','needs_owner','stale'].includes(d.state)) ?? [];
  const mode = c.mode === 'never_reply' || c.excluded ? 'AI off' : c.control === 'manual' ? 'AI paused · you are handling this' : c.mode === 'auto_reply' ? 'Auto reply · requires a current limit' : 'Drafts only';
  return <Page scroll={false}>
    <Stack.Screen options={{ title: c.name, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Contact permissions" onPress={() => setPermissions(true)} style={{ padding: 10 }}><SlidersHorizontal color={palette.text} size={21}/></Pressable> }}/>
    <View style={{ paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: palette.accent, fontFamily: fonts.regular, fontSize: 12 }}>{mode}</Text>
      {c.mode !== 'never_reply' && !c.excluded && c.control !== 'manual' && <Pressable accessibilityRole="button" onPress={() => { void perform('/v1/conversations/'+encodeURIComponent(id)+'/draft', Draft, {}); }}>
        <Text style={{ color: palette.accent, fontFamily: fonts.semibold, fontSize: 12 }}>Draft reply</Text>
      </Pressable>}
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {messages.map(m => <MessageBubble key={m.id} message={m} quoted={messages.find(q => q.id === m.quotedMessageId)} onSelect={setSelected}/>)}
        {drafts.map(d => <View key={d.id} style={{ paddingVertical: 8 }}><DraftCard draft={d}/></View>)}
      </ScrollView>
      {quote && <View style={{ padding: 12, marginHorizontal: 16, borderLeftWidth: 3, borderColor: palette.accent, backgroundColor: palette.surface, flexDirection: 'row', gap: 8 }}>
        <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.regular, color: palette.muted, fontSize: 13 }}>{quote.text || quote.media?.kind}</Text>
        <Pressable accessibilityLabel="Remove quote" onPress={() => setQuote(null)}><X size={18} color={palette.muted}/></Pressable>
      </View>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 24, gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: 26, padding: 13 }}>
          <Pressable accessibilityLabel="Insert laughing emoji" onPress={() => { setText(t => t+'😂'); void beginTyping(); }}><Smile size={21} color={palette.muted}/></Pressable>
          <TextInput accessibilityLabel="Message" value={text} multiline maxLength={4000} placeholder="Message" placeholderTextColor={palette.muted}
            onChangeText={value => { setText(value); if (value) void beginTyping(); }}
            style={{ flex: 1, color: palette.text, fontFamily: fonts.regular, fontSize: 16, maxHeight: 110, padding: 0 }}/>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Send demo message" disabled={!text.trim() || sending || status !== 'online'} onPress={() => { void send({ kind: 'text', text: text.trim(), reason: 'Owner manual message.' }, quote?.id ?? null); }}
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
