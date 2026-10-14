import { memo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Draft, type Action } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { DecisionResult } from '../lib/api';
import { fonts } from '../lib/theme';
import { Button } from './ui';

export const DraftCard = memo(function DraftCard({ draft }: { draft: Draft }) {
  const { palette, perform, status } = useApp();
  const [editing, setEditing] = useState(false);
  const [editingRevision, setEditingRevision] = useState(draft.revision);
  const editableText=draft.action.kind==='text_sequence' ? draft.action.messages.map(message=>message.text).join('\n\n') : 'text' in draft.action ? draft.action.text : '';
  const [text, setText] = useState(editableText);
  const [busy, setBusy] = useState(false);
  const pending = draft.state === 'pending';
  const decide = async (operation: 'approve' | 'dismiss' | 'edit' | 'needs_owner') => {
    setBusy(true);
    const action: Action | undefined = operation === 'edit' ? { kind: 'text', text, reason: 'Owner edited this draft.' } : undefined;
    const result = await perform('/v1/drafts/'+encodeURIComponent(draft.id)+'/decision', DecisionResult,
      { operation, revision: operation === 'edit' ? editingRevision : draft.revision, ...(action ? { action } : {}) });
    if (result) setEditing(false);
    setBusy(false);
  };
  return <View style={{ borderWidth: 1, borderColor: pending ? palette.accent : palette.border, borderRadius: 12,
    padding: 14, gap: 10, backgroundColor: pending ? palette.accentSoft : palette.surface }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.semibold, color: palette.accent, fontSize: 12 }}>
        {draft.state === 'needs_owner' ? 'Needs you' : draft.state === 'stale' ? 'Outdated draft' : pending ? 'Suggested reply' : draft.state === 'approved' ? 'Approved' : 'Dismissed'}
      </Text>
      {pending && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>Not sent</Text>}
    </View>
    {editing && draft.action.kind==='text_sequence' && <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>Saving combines these messages into one text reply. Sequence quotes are removed. Keep it under 4000 characters.</Text>}
    {editing ? <TextInput accessibilityLabel="Edit draft" multiline maxLength={4000} value={text} onChangeText={setText} style={{ color: palette.text, fontFamily: fonts.regular, fontSize: 16, minHeight: 54 }}/>
      : draft.action.kind==='text_sequence' ? <View accessibilityLabel="Ordered reply sequence" style={{gap:8}}>
        {draft.action.messages.map((message,index)=><View key={index} style={{padding:10,borderRadius:8,backgroundColor:palette.surface}}>
          <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:11}}>Message {index+1}{message.quotedMessageId ? ' · quoted reply' : ''}</Text>
          <Text selectable style={{fontFamily:fonts.regular,fontSize:16,lineHeight:23,color:palette.text}}>{message.text}</Text>
        </View>)}
      </View> : <Text selectable style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: palette.text }}>
        {'text' in draft.action ? draft.action.text : 'reaction' in draft.action ? 'React '+draft.action.reaction.emoji : draft.action.reason}
      </Text>}
    {draft.state === 'stale' && <Button label="Dismiss" secondary disabled={busy || status!=='online'} onPress={()=>{void decide('dismiss');}}/>}
    {draft.state === 'needs_owner' && <Button label="Handled" secondary disabled={busy || status !== 'online'} onPress={() => { void decide('dismiss'); }}/>}
    {pending && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button label={editing ? 'Save draft' : 'Send reply'} disabled={busy || status !== 'online' || (editing && (!text.trim() || text.trim().length>4000))} onPress={() => { void decide(editing ? 'edit' : 'approve'); }}/>
      {!editing && ('text' in draft.action || draft.action.kind==='text_sequence') && <Button label={draft.action.kind==='text_sequence' ? 'Edit as one reply' : 'Edit'} secondary disabled={busy} onPress={() => { setText(editableText); setEditingRevision(draft.revision); setEditing(true); }}/>}
      <Button label="Dismiss" secondary disabled={busy || status !== 'online'} onPress={() => { void decide('dismiss'); }}/>
    </View>}
  </View>;
});
