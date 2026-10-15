import { memo, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Draft, type Action, type Outbox } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { ApiError, DecisionResult } from '../lib/api';
import { fonts } from '../lib/theme';
import { Button } from './ui';
import { OutboxStatus } from './outgoing-status';

export const DraftCard = memo(function DraftCard({ draft: provided, onEditorFocus, onSent }: {
  draft: Draft; onEditorFocus?: (target: number | null) => void; onSent?: () => void;
}) {
  const { palette, mutate, status, client } = useApp();
  const [acknowledged,setAcknowledged]=useState<{client:typeof client;id:string;revision:number;draft?:Draft | null;outbox?:Outbox | null;simulated?:boolean} | null>(null);
  const local=acknowledged?.client===client && acknowledged?.id===provided.id && acknowledged.revision>=provided.revision ? acknowledged : null;
  const draft=local?.draft && local.draft.revision>=provided.revision && provided.state==='pending' ? local.draft : provided;
  const scope=useRef({client,id:provided.id});
  if(scope.current.client!==client || scope.current.id!==provided.id)scope.current={client,id:provided.id};
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;setBusy(false);decisionLock.current=false;setDecisionFeedback(null);setUnconfirmed(false);return()=>{alive.current=false;};},[client,provided.id]);
  const [editing, setEditing] = useState(false);
  const [editingRevision, setEditingRevision] = useState(draft.revision);
  const editableText=draft.action.kind==='text_sequence' ? draft.action.messages.map(message=>message.text).join('\n\n') : 'text' in draft.action ? draft.action.text : '';
  const [text, setText] = useState(editableText);
  const [busy, setBusy] = useState(false);
  const decisionLock=useRef(false);
  const [decisionFeedback,setDecisionFeedback]=useState<string | null>(null);
  const [unconfirmed,setUnconfirmed]=useState(false);
  const blocked=busy || unconfirmed;
  const pending = draft.state === 'pending' && !local?.outbox;
  const title=local?.outbox ? local.outbox.state==='accepted'?'Approved':'Send outcome '+local.outbox.state : draft.state === 'needs_owner' ? 'Needs you' : draft.state === 'stale' ? 'Outdated draft' : pending ? 'Suggested reply' : draft.state === 'approved' ? 'Approved' : 'Dismissed';
  useEffect(() => { if (editing) return () => onEditorFocus?.(null); }, [editing, onEditorFocus]);
  const decide = async (operation: 'approve' | 'dismiss' | 'edit' | 'needs_owner') => {
    if(decisionLock.current || unconfirmed)return;
    const source=scope.current;
    decisionLock.current=true;setBusy(true);setDecisionFeedback(null);
    const action: Action | undefined = operation === 'edit' ? { kind: 'text', text, reason: 'Owner edited this draft.' } : undefined;
    try {
      const result = await mutate('/v1/drafts/'+encodeURIComponent(draft.id)+'/decision', DecisionResult,
        { operation, revision: operation === 'edit' ? editingRevision : draft.revision, ...(action ? { action } : {}) });
      if(!alive.current || scope.current!==source)return;
      setAcknowledged({client,id:provided.id,revision:result.draft?.revision ?? draft.revision,...result});
      setEditing(false);
      if (operation === 'approve' && result.outbox?.state === 'accepted' && draft.action.kind !== 'reaction') onSent?.();
    } catch(error) {
      if(!alive.current || scope.current!==source)return;
      const uncertain=!(error instanceof ApiError) || error.code==='service_error';
      setUnconfirmed(uncertain);
      setDecisionFeedback(uncertain?'Decision outcome unconfirmed. Check current status. No decision was retried.':error instanceof Error?error.message:'Decision rejected.');
    } finally {
      if(alive.current && scope.current===source){decisionLock.current=false;setBusy(false);}
    }
  };
  return <View style={{ borderWidth: 1, borderColor: pending ? palette.accent : palette.border, borderStyle: pending ? 'dashed' : 'solid', borderRadius: 12,
    padding: 14, gap: 10, backgroundColor: pending ? palette.accentSoft : palette.surface }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.semibold, color: palette.accent, fontSize: 12 }}>
        {title}
      </Text>
      {pending && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>{unconfirmed ? 'Outcome unconfirmed' : busy ? 'Decision pending' : 'Not sent'}</Text>}
    </View>
    {editing && draft.action.kind==='text_sequence' && <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>Saving combines these messages into one text reply. Sequence quotes are removed. Keep it under 4000 characters.</Text>}
    {editing ? <TextInput accessibilityLabel="Edit draft" autoFocus multiline maxLength={4000} value={text} onChangeText={setText}
      onFocus={event => onEditorFocus?.(event.nativeEvent.target)} onBlur={() => onEditorFocus?.(null)}
      style={{ color: palette.text, fontFamily: fonts.regular, fontSize: 16, minHeight: 54, maxHeight: 180, textAlignVertical: 'top' }}/>
      : draft.action.kind==='text_sequence' ? <View accessibilityLabel="Ordered reply sequence" style={{gap:8}}>
        {draft.action.messages.map((message,index)=><View key={index} style={{padding:10,borderRadius:8,backgroundColor:palette.surface}}>
          <Text style={{color:palette.muted,fontFamily:fonts.regular,fontSize:12}}>Message {index+1}{message.quotedMessageId ? ' · quoted reply' : ''}</Text>
          <Text selectable style={{fontFamily:fonts.regular,fontSize:16,lineHeight:23,color:palette.text}}>{message.text}</Text>
        </View>)}
      </View> : <Text selectable style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: palette.text }}>
        {'text' in draft.action ? draft.action.text : 'reaction' in draft.action ? 'React '+draft.action.reaction.emoji : draft.action.reason}
      </Text>}
    {decisionFeedback && <Text accessibilityRole="alert" style={{color:palette.danger,fontFamily:fonts.regular,fontSize:13}}>{decisionFeedback}</Text>}
    {local?.outbox && <OutboxStatus outbox={local.outbox} simulated={local.simulated}/>}
    {draft.state === 'stale' && <Button label="Dismiss" secondary disabled={blocked || status!=='online'} onPress={()=>{void decide('dismiss');}}/>}
    {draft.state === 'needs_owner' && <Button label="Handled" secondary disabled={blocked || status !== 'online'} onPress={() => { void decide('dismiss'); }}/>}
    {pending && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button label={editing ? 'Save draft' : 'Send reply'} disabled={blocked || status !== 'online' || (editing && (!text.trim() || text.trim().length>4000))} onPress={() => { void decide(editing ? 'edit' : 'approve'); }}/>
      {!editing && ('text' in draft.action || draft.action.kind==='text_sequence') && <Button label={draft.action.kind==='text_sequence' ? 'Edit as one reply' : 'Edit'} secondary disabled={blocked} onPress={() => { setText(editableText); setEditingRevision(draft.revision); setEditing(true); }}/>}
      <Button label="Dismiss" secondary disabled={blocked || status !== 'online'} onPress={() => { void decide('dismiss'); }}/>
    </View>}
  </View>;
});
