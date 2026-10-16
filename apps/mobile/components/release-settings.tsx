import { useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import { OwnerInstructions, OwnerInstructionsInput, ContactNameSettings, ContactNamesInput, ContactNamesImportInput, ContactNamesImportResult } from '@replybot/core/api';
import { useApp } from '../lib/app-state';
import { ApiError } from '../lib/api';
import { isForeground } from '../lib/foreground';
import { canReadPhoneContacts, readMatchedNames } from '../lib/phone-contacts';
import { randomUUID } from '../lib/uuid';
import { fonts } from '../lib/theme';
import { Button } from './ui';

export function ReleaseSettings() {
  const { palette, client, acceptedScope, discovery, snapshot, status, mutate } = useApp();
  const instructionsAvailable = !!acceptedScope && discovery?.capabilities?.ownerInstructions === true;
  const namesAvailable = !!acceptedScope && discovery?.capabilities?.contactBookNames === true;
  const alive = useRef(true);
  const [instructions, setInstructions] = useState<OwnerInstructions | null>(null);
  const [text, setText] = useState(''); const editor = useRef('');
  const [instructionsFeedback, setInstructionsFeedback] = useState('');
  const [saving, setSaving] = useState(false); const saveLock = useRef(false);
  const [names, setNames] = useState<ContactNameSettings | null>(null);
  const [namesFeedback, setNamesFeedback] = useState('');
  const [namesBusy, setNamesBusy] = useState<'toggle' | 'sync' | null>(null);
  const namesOperation = useRef(0);
  const nameLock = useRef<'toggle' | 'sync' | null>(null);
  const unknownImport = useRef<string | null>(null);
  const [importUnconfirmed, setImportUnconfirmed] = useState(false);
  const instructionRead = useRef(0), namesRead = useRef(0);
  const foregroundEpoch = useRef(0);
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',state=>{if(state!=='active')foregroundEpoch.current++;});
    return()=>subscription.remove();
  },[]);
  useEffect(() => { alive.current=true; return () => {alive.current=false;namesOperation.current++;instructionRead.current++;namesRead.current++;}; }, [client]);
  const current = () => alive.current && !!acceptedScope;
  const loadInstructions = async () => {
    const request=++instructionRead.current, captured=editor.current;
    try {
      const data=await client.request('/v1/owner-instructions',OwnerInstructions);
      if(!current() || request!==instructionRead.current)return;
      setInstructions(data);
      if(editor.current===captured){setText(data.text);editor.current=data.text;setInstructionsFeedback('');}
      else setInstructionsFeedback('Your newer edits are kept.');
    } catch(error){if(current() && request===instructionRead.current)setInstructionsFeedback(error instanceof Error?error.message:'Could not load instructions.');}
  };
  const loadNames = async () => {
    const request=++namesRead.current;
    try {
      const data=await client.request('/v1/contact-names',ContactNameSettings);
      if(!current() || request!==namesRead.current)return;
      setNames(data);
      if(unknownImport.current) {
        if(data.lastPhoneImportRequestId===unknownImport.current) {
          unknownImport.current=null;setImportUnconfirmed(false);setNamesFeedback('Matched names synchronized.');
        } else setNamesFeedback('That import is still unconfirmed. No action was retried.');
      } else setNamesFeedback('');
    } catch(error){if(current() && request===namesRead.current)setNamesFeedback(error instanceof Error?error.message:'Could not load name settings.');}
  };
  useEffect(()=>{if(instructionsAvailable)void loadInstructions();},[client,instructionsAvailable]);
  useEffect(()=>{if(namesAvailable)void loadNames();},[client,namesAvailable]);
  const saveInstructions=async()=>{
    if(!instructions || saveLock.current || !current())return;
    const parsed=OwnerInstructionsInput.safeParse({requestId:randomUUID(),expectedRevision:instructions.revision,text:editor.current});
    if(!parsed.success){setInstructionsFeedback('Use plain text within 2,000 characters and 4,000 UTF-8 bytes. Nothing was saved.');return;}
    saveLock.current=true;setSaving(true);setInstructionsFeedback('Saving instructions.');
    instructionRead.current++;
    try {
      const saved=await mutate('/v1/owner-instructions',OwnerInstructions,parsed.data);
      if(!current())return;
      setInstructions(saved);
      setInstructionsFeedback(editor.current===saved.text?'Instructions saved.': 'Submitted instructions saved. Your newer edits are not saved.');
    } catch(error){if(current())setInstructionsFeedback(error instanceof ApiError && error.code==='owner_instructions_changed'
      ? 'Saved instructions changed on another client. Your edits are kept. Reload saved instructions before saving again.'
      : error instanceof ApiError && error.code!=='service_error' ? error.message : 'Save unconfirmed. Your edits are kept. Reload saved instructions to check; no save was retried.');}
    finally{if(current()){saveLock.current=false;setSaving(false);}}
  };
  const toggleNames=async()=>{
    if(!names || !current() || nameLock.current==='toggle')return;
    const operation=++namesOperation.current;
    namesRead.current++;nameLock.current='toggle';setNamesBusy('toggle');
    try {
      const payload=ContactNamesInput.parse({requestId:randomUUID(),expectedRevision:names.revision,enabled:!names.enabled});
      const saved=await mutate('/v1/contact-names',ContactNameSettings,payload);
      if(!current() || operation!==namesOperation.current)return;
      setNames(saved);unknownImport.current=null;setImportUnconfirmed(false);
      setNamesFeedback(saved.enabled?'Saved names enabled. Phone contacts are read only when you choose Sync matched names.':'Saved names off. Saved-book and phone aliases deleted on the PC. Android Contacts permission is unchanged.');
    } catch(error){if(current() && operation===namesOperation.current)setNamesFeedback(error instanceof ApiError && error.code==='contact_names_changed'
      ? 'Name settings changed. Reload, then choose a new explicit action.'
      : error instanceof ApiError && error.code!=='service_error'?error.message:'Setting change unconfirmed. Reload settings to check. No action was retried.');}
    finally{if(current() && operation===namesOperation.current){nameLock.current=null;setNamesBusy(null);}}
  };
  const syncNames=async()=>{
    if(!names?.enabled || !snapshot || !acceptedScope || !canReadPhoneContacts || nameLock.current || importUnconfirmed || !isForeground())return;
    const operation=++namesOperation.current, requestId=randomUUID(), foreground=foregroundEpoch.current;
    const accountId=acceptedScope.accountId, revision=names.revision, conversations=snapshot.conversations;
    const scopeValid=()=>current() && operation===namesOperation.current;
    const valid=()=>scopeValid() && foregroundEpoch.current===foreground && isForeground();
    nameLock.current='sync';setNamesBusy('sync');setNamesFeedback('Reading matched names. Nothing synchronized yet.');
    let submitted=false;
    try {
      const entries=await readMatchedNames(conversations,accountId,valid);
      if(!valid()){if(scopeValid())setNamesFeedback('Name sync stopped after leaving the foreground. No import was submitted.');return;}
      const payload=ContactNamesImportInput.parse({requestId,expectedRevision:revision,entries});
      if(new TextEncoder().encode(JSON.stringify(payload)).length>512*1024)throw new Error('Matched names exceed the import size limit. Nothing was imported.');
      namesRead.current++;submitted=true;
      const result=await mutate('/v1/contact-names/import',ContactNamesImportResult,payload);
      if(!scopeValid())return;
      if(result.settings.lastPhoneImportRequestId!==requestId)throw new Error('Import acknowledgment did not match.');
      setNames(result.settings);setNamesFeedback('Matched names synchronized.');
    } catch(error) {
      if(!scopeValid())return;
      if(submitted && (!(error instanceof ApiError) || error.code==='service_error')) {
        unknownImport.current=requestId;setImportUnconfirmed(true);
        setNamesFeedback('Import unconfirmed. Check sync status before syncing again. No action was retried.');
      } else setNamesFeedback(error instanceof ApiError && error.code==='contact_names_changed' ? 'Name settings changed. Reload and choose Sync matched names again explicitly.'
        : error instanceof Error ? error.message : 'Names were not synchronized.');
    } finally {
      if(current() && operation===namesOperation.current){nameLock.current=null;setNamesBusy(null);}
    }
  };
  const heading={fontFamily:fonts.semibold,fontSize:16,color:palette.text};
  const copy={fontFamily:fonts.regular,fontSize:13,lineHeight:20,color:palette.muted};
  const section={gap:12,paddingBottom:20,borderBottomWidth:1,borderColor:palette.border};
  return <>
    <View style={section}>
      <Text style={heading}>About me and reply instructions</Text>
      <Text style={copy}>Saved on your PC for this profile. Used for AI replies when enabled. Do not paste secrets.</Text>
      {instructionsAvailable ? <>
        <TextInput accessibilityLabel="About me and reply instructions" multiline value={text} onChangeText={value=>{editor.current=value;setText(value);}} editable={!!instructions}
          style={{color:palette.text,fontFamily:fonts.regular,fontSize:15,minHeight:120,textAlignVertical:'top',padding:14,borderWidth:1,borderColor:palette.border,borderRadius:12,backgroundColor:palette.surface}}/>
        <Text style={copy}>{[...text].length}/2,000 characters · 4,000-byte limit. Saving empty text clears it.</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          <Button label={saving?'Saving instructions…':'Save instructions'} disabled={saving || !instructions || status!=='online'} onPress={()=>{void saveInstructions();}}/>
          <Button label="Reload saved instructions" secondary disabled={saving || status!=='online'} onPress={()=>{void loadInstructions();}}/>
        </View>
        {!!instructionsFeedback && <Text accessibilityLiveRegion="polite" style={copy}>{instructionsFeedback}</Text>}
      </> : <Text style={copy}>Instructions unavailable. Continue with a supported PC profile to edit them.</Text>}
      <Text style={copy}>Changes make pending AI drafts outdated and cancel unsent AI replies. Messages already sending cannot be recalled.</Text>
    </View>
    <View style={section}>
      <Text style={heading}>Saved contact names</Text>
      <Text style={copy}>Use saved WhatsApp names, then matched phone names. Turning off deletes these saved names from the PC; Android permission stays unchanged.</Text>
      {namesAvailable ? <>
        <Text style={copy}>{names ? names.enabled?'Saved names on':'Saved names off':'Name settings not loaded'}</Text>
        <Button label={namesBusy==='toggle'?'Applying name setting…':names?.enabled?'Turn saved names off':'Enable saved names'} secondary
          disabled={!names || namesBusy==='toggle' || status!=='online'} onPress={()=>{void toggleNames();}}/>
        {canReadPhoneContacts ? <>
          <Text style={copy}>Android allows access to all contacts. Names and phone numbers are read while this app is in the foreground. Only matched chat IDs and names go to this PC. Unmatched contacts and raw numbers are not uploaded or saved.</Text>
          <Button label={namesBusy==='sync'?'Syncing matched names…':'Sync matched names'} disabled={!names?.enabled || !!namesBusy || importUnconfirmed || status!=='online'} onPress={()=>{void syncNames();}}/>
        </> : <Text style={copy}>Browser uses names synchronized to the PC. To sync phone names, use the Android app.</Text>}
        <Button label={importUnconfirmed?'Check sync status':'Reload name settings'} secondary disabled={!!namesBusy || status!=='online'} onPress={()=>{void loadNames();}}/>
        {names?.lastPhoneSyncAt !== null && names?.lastPhoneSyncAt !== undefined && <Text style={copy}>Last committed phone sync: {new Date(names.lastPhoneSyncAt).toLocaleString()}</Text>}
        {!!namesFeedback && <Text accessibilityLiveRegion="polite" style={copy}>{namesFeedback}</Text>}
      </> : <Text style={copy}>Saved-name controls are unavailable. Continue with a supported PC profile.</Text>}
    </View>
  </>;
}
