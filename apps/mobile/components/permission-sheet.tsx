import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Proposal, Conversation, type Mode } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import { Button, ErrorNotice } from './ui';
const labels = { never_reply: 'AI off', draft_only: 'Drafts only', auto_reply: 'Auto reply' };
export function PermissionSheet({ conversation, visible, onClose }: { conversation: Conversation; visible: boolean; onClose: () => void }) {
  const { palette, perform, status } = useApp();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [mode, setMode] = useState<Mode>(conversation.mode ?? 'draft_only');
  const [units, setUnits] = useState(20); const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  useEffect(() => { if (visible) { setMode(conversation.mode ?? 'draft_only'); setProposal(null); } }, [visible, conversation.id]);
  const apply = async () => {
    if (lock.current) return; lock.current = true; setBusy(true);
    try {
      if (proposal) {
        const result = await perform('/v1/owner-actions/'+encodeURIComponent(proposal.id)+'/confirm', Conversation, { payloadHash: proposal.payloadHash });
        if (result) { setProposal(null); onClose(); }
      } else {
        const result = await perform('/v1/conversations/'+encodeURIComponent(conversation.id)+'/owner-actions', Proposal,
          { kind: 'configure', mode, ...(mode === 'auto_reply' ? { maxUnits: units, expiresAt: Date.now()+minutes*60000 } : {}) });
        if (result) setProposal(result);
      }
    } finally { lock.current = false; setBusy(false); }
  };
  const close = () => { if (!busy) { setProposal(null); onClose(); } };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
      <Pressable style={{ flex: 1 }} accessibilityLabel="Close permissions" onPress={close}/>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 16, paddingBottom: 36 }} style={{ maxHeight: '85%', width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: palette.background, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: palette.text }}>{conversation.name}</Text><ErrorNotice/>
        {proposal ? <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: palette.text }}>
            {labels[mode]}{mode === 'auto_reply' ? ' · '+units+' actions · '+minutes+' min' : ''}{conversation.control === 'manual' && mode !== 'never_reply' ? ' · Resume AI' : ''}?
          </Text>
          <Button label={busy ? 'Applying…' : 'Confirm'} disabled={busy || status !== 'online'} onPress={() => { void apply(); }}/>
          <Button label="Back" secondary disabled={busy} onPress={() => setProposal(null)}/>
        </> : <>
          {(['never_reply','draft_only','auto_reply'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }} accessibilityLabel={labels[value]}
            onPress={() => setMode(value)} disabled={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: mode === value ? 5 : 1, borderColor: mode === value ? palette.accent : palette.muted }}/>
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: palette.text }}>{labels[value]}</Text>
          </Pressable>)}
          {mode === 'auto_reply' && <>
            <Text style={{ fontFamily: fonts.medium, color: palette.text, fontSize: 14 }}>Reply limit</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[1,5,10,20].map(n => <Button key={n} label={String(n)} secondary={units !== n} disabled={busy} onPress={() => setUnits(n)}/>)}</View>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[15,30,60].map(n => <Button key={n} label={n+' min'} secondary={minutes !== n} disabled={busy} onPress={() => setMinutes(n)}/>)}</View>
            <Text style={{ fontFamily: fonts.regular, color: palette.muted, fontSize: 12 }}>Reactions count toward the limit.</Text>
          </>}
          <Button label={busy ? 'Saving…' : 'Save'} disabled={busy || status !== 'online'} onPress={() => { void apply(); }}/>
          <Button label="Close" secondary disabled={busy} onPress={close}/>
        </>}
      </ScrollView>
    </View>
  </Modal>;
}
