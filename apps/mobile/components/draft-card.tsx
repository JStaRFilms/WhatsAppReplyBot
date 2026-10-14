import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Draft, type Action } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { DecisionResult } from '../lib/api';
import { fonts } from '../lib/theme';
import { Button } from './ui';

export function DraftCard({ draft }: { draft: Draft }) {
  const { palette, perform, status } = useApp();
  const [editing, setEditing] = useState(false);
  const [editingRevision, setEditingRevision] = useState(draft.revision);
  const [text, setText] = useState('text' in draft.action ? draft.action.text : '');
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
        {draft.state === 'needs_owner' ? 'Needs you' : draft.state === 'stale' ? 'Outdated draft' : pending ? 'Suggested reply' : draft.state === 'approved' ? 'Demo approved' : 'Dismissed'}
      </Text>
      {pending && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>Not sent</Text>}
    </View>
    {editing ? <TextInput accessibilityLabel="Edit draft" multiline value={text} onChangeText={setText} style={{ color: palette.text, fontFamily: fonts.regular, fontSize: 16, minHeight: 54 }}/>
      : <Text selectable style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: palette.text }}>
        {'text' in draft.action ? draft.action.text : 'reaction' in draft.action ? 'React '+draft.action.reaction.emoji : draft.action.reason}
      </Text>}
    {pending && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button label={editing ? 'Save draft' : 'Approve demo'} disabled={busy || status !== 'online' || (editing && !text.trim())} onPress={() => { void decide(editing ? 'edit' : 'approve'); }}/>
      {!editing && 'text' in draft.action && <Button label="Edit" secondary disabled={busy} onPress={() => { setText('text' in draft.action ? draft.action.text : ''); setEditingRevision(draft.revision); setEditing(true); }}/>}
      <Button label="Dismiss" secondary disabled={busy || status !== 'online'} onPress={() => { void decide('dismiss'); }}/>
    </View>}
  </View>;
}
