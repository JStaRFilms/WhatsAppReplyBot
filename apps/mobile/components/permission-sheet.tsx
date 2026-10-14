import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Proposal, Conversation, type Mode } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import { Button, ErrorNotice } from './ui';
export function PermissionSheet({ conversation, visible, onClose }: { conversation: Conversation; visible: boolean; onClose: () => void }) {
  const { palette, perform, status } = useApp(); const [proposal, setProposal] = useState<Proposal | null>(null);
  const [units, setUnits] = useState(20); const [minutes, setMinutes] = useState(30); const [busy, setBusy] = useState(false);
  const propose = async (kind: 'change_mode'|'resume'|'delegate', mode?: Mode) => {
    setBusy(true);
    const payload = kind === 'change_mode' ? { kind, mode } : kind === 'delegate' ? { kind, maxUnits: units, expiresAt: Date.now()+minutes*60000 } : { kind };
    const result = await perform('/v1/conversations/'+encodeURIComponent(conversation.id)+'/owner-actions', Proposal, payload);
    if (result) setProposal(result); setBusy(false);
  };
  const confirm = async () => {
    if (!proposal) return; setBusy(true);
    const result = await perform('/v1/owner-actions/'+encodeURIComponent(proposal.id)+'/confirm', Conversation, { payloadHash: proposal.payloadHash });
    if (result) { setProposal(null); onClose(); } setBusy(false);
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { setProposal(null); onClose(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
      <Pressable style={{ flex: 1 }} accessibilityLabel="Close permissions" onPress={() => { setProposal(null); onClose(); }}/>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 16, paddingBottom: 36 }} style={{ maxHeight: '85%', width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: palette.background, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: palette.text }}>{conversation.name}</Text><ErrorNotice/>
        {proposal ? <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: palette.text }}>
            {proposal.kind === 'change_mode' ? 'Change to '+proposal.mode?.replaceAll('_',' ')+'?'
              : proposal.kind === 'resume' ? 'Resume AI? Old grants and drafts will not return.'
              : 'Allow up to '+proposal.maxUnits+' reply actions until '+new Date(proposal.expiresAt ?? 0).toLocaleTimeString()+'? Reactions count too.'}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.muted }}>No change has been applied. This confirmation expires in five minutes.</Text>
          <Button label="Confirm change" disabled={busy || status !== 'online'} onPress={() => { void confirm(); }}/>
          <Button label="Back" secondary onPress={() => setProposal(null)}/>
        </> : <>
          {([['never_reply','Never reply','No AI. You can still message.'],['draft_only','Drafts only','Approve each reply or reaction.'],['auto_reply','Auto reply','Requires a time limit and reply budget.']] as const).map(([mode,label,description]) =>
            <Pressable key={mode} accessibilityRole="button" onPress={() => { void propose('change_mode', mode); }} disabled={busy || status !== 'online'}
              style={{ paddingVertical: 11, borderBottomWidth: 1, borderColor: palette.border }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: conversation.mode === mode ? palette.accent : palette.text }}>{label}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.muted, marginTop: 5 }}>{description}</Text>
            </Pressable>)}
          {conversation.control === 'manual' && <Button label="Resume AI" secondary disabled={busy || conversation.mode === 'never_reply'} onPress={() => { void propose('resume'); }}/>}
          {conversation.mode === 'auto_reply' && conversation.control !== 'manual' && <>
            <Text style={{ fontFamily: fonts.semibold, color: palette.text, fontSize: 15 }}>Follow-up limit</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[1,5,10,20].map(n => <Button key={n} label={String(n)} secondary={units !== n} onPress={() => setUnits(n)}/>)}</View>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[15,30,60].map(n => <Button key={n} label={n+' min'} secondary={minutes !== n} onPress={() => setMinutes(n)}/>)}</View>
            <Button label="Allow follow-up" disabled={busy || status !== 'online'} onPress={() => { void propose('delegate'); }}/>
          </>}
          <Button label="Close" secondary onPress={onClose}/>
        </>}
      </ScrollView>
    </View>
  </Modal>;
}
