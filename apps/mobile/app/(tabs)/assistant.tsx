import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { AssistantResponse, AssistantTurn } from '@replybot/core/api';
import { Conversation } from '@replybot/core/contracts';
import { Page, Button, EmptyConnection } from '../../components/ui';
import { useApp } from '../../lib/app-state';
import { fonts } from '../../lib/theme';
const Turns = z.array(AssistantTurn);
export default function Assistant() {
  const { snapshot, palette, client, perform, status, reportError } = useApp(); const router = useRouter();
  const [turns, setTurns] = useState<AssistantTurn[]>([]); const [text, setText] = useState('');
  const [busy, setBusy] = useState(false); const [confirmed, setConfirmed] = useState<string[]>([]);
  const scroll = useRef<ScrollView>(null);
  const load = useCallback(async () => {
    try { setTurns(await client.request('/v1/assistant/turns', Turns)); } catch (e) { reportError(e instanceof Error ? e.message : 'Could not load assistant conversation.'); }
  }, [client]);
  useEffect(() => { if (status === 'online') void load(); }, [status, load]);
  const send = async (instruction = text) => {
    if (!instruction.trim() || busy) return; setBusy(true);
    const result = await perform('/v1/assistant/turns', AssistantResponse, { text: instruction.trim() });
    if (result) { setText(''); await load(); } setBusy(false);
  };
  if (!snapshot) return <Page title="Assistant"><EmptyConnection/></Page>;
  return <Page title="Assistant" scroll={false}>
    <View style={{ flex: 1, minHeight: 0 }}>
      <Text style={{ paddingHorizontal: 16, paddingVertical: 8, color: palette.muted, fontFamily: fonts.regular, fontSize: 12 }}>Owner conversation · Actions need your confirmation</Text>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1 }} contentContainerStyle={{ width: '100%', maxWidth: 784, alignSelf: 'center', padding: 12, gap: 10 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {!turns.length && <View style={{ gap: 14, paddingVertical: 12 }}>
          <Text style={{ fontFamily: fonts.regular, color: palette.muted, fontSize: 14 }}>Review unanswered messages or request a draft.</Text>
          <Button label="Review the past five hours" secondary onPress={() => { void send('review the past five hours'); }}/>
        </View>}
        {turns.map(t => {
          const proposal = t.result?.proposal; const owner = t.role === 'owner';
          const contact = proposal ? snapshot.conversations.find(c => c.id === proposal.conversationId) : undefined;
          const done = proposal ? proposal.consumed || confirmed.includes(proposal.id) : false;
          return <View key={t.id} style={{ alignItems: owner ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '86%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderTopRightRadius: owner ? 4 : 16,
              borderTopLeftRadius: owner ? 16 : 4, backgroundColor: owner ? palette.outgoing : palette.surface, gap: 12 }}>
              <Text selectable style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: palette.text }}>{t.text}</Text>
              {proposal && <View style={{ gap: 10, borderTopWidth: 1, borderColor: palette.border, paddingTop: 12 }}>
                <Text style={{ fontFamily: fonts.semibold, color: palette.text, fontSize: 14 }}>{contact?.name ?? 'Contact'} · {proposal.kind.replaceAll('_',' ')}</Text>
                <Button label={done ? 'Confirmed' : 'Confirm change'} disabled={done || proposal.confirmBy <= Date.now() || status !== 'online'}
                  onPress={() => { void perform('/v1/owner-actions/'+encodeURIComponent(proposal.id)+'/confirm', Conversation, { payloadHash: proposal.payloadHash })
                    .then(result => { if (result) setConfirmed(values => [...values,proposal.id]); }); }}/>
              </View>}
              {!!t.result?.draftId && <Button label="Open draft" secondary onPress={() => {
                const draft = snapshot.drafts.find(d => d.id === t.result?.draftId);
                if (draft) router.push({ pathname: '/conversation/[id]', params: { id: draft.conversationId } });
              }}/>}
              {t.result?.candidates.map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={'Draft for '+c.name} style={{ minHeight: 48, justifyContent: 'center' }} onPress={() => { void send('draft for '+c.name); }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: palette.accent }}>{c.name}</Text>
              </Pressable>)}
            </View>
          </View>;
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, width: '100%', maxWidth: 800, alignSelf: 'center' }}>
        <TextInput accessibilityLabel="Ask your assistant" value={text} onChangeText={setText} multiline maxLength={4000} placeholder="Ask your assistant" placeholderTextColor={palette.muted}
          style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 13, color: palette.text, fontFamily: fonts.regular, fontSize: 16, minWidth: 0, minHeight: 48, maxHeight: 132 }}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Send assistant instruction" disabled={busy || !text.trim() || status !== 'online'} onPress={() => { void send(); }}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center', opacity: busy || !text.trim() || status !== 'online' ? 0.4 : 1 }}>
          <Send size={22} color={palette.accentText}/>
        </Pressable>
      </View>
    </View>
  </Page>;
}
