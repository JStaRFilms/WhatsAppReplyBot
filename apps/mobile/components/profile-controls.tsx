import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ProfileDescriptor, ProfileList, ProfileTransitionInput } from '@replybot/core/api';
import { useApp } from '../lib/app-state';
import { randomUUID } from '../lib/uuid';
import { fonts } from '../lib/theme';
import { Button } from './ui';

export function ProfileControls() {
  const { palette, client, acceptedScope, discovery, profileBusy, profileNotice, operation, status,
    continueProfile, transitionProfile, refresh, reportError } = useApp();
  const [label,setLabel]=useState('');
  const [preserved,setPreserved]=useState<ProfileDescriptor[] | null>(null);
  const [confirmation,setConfirmation]=useState<ProfileTransitionInput | null>(null);
  const [targetLabel,setTargetLabel]=useState('');
  const [loading,setLoading]=useState(false);
  const lock=useRef(false);
  const disabled=profileBusy || status !== 'online';
  const text={color:palette.muted,fontFamily:fonts.regular,fontSize:14,lineHeight:21};
  const prepare=(input:ProfileTransitionInput,target:string)=>{setTargetLabel(target);setConfirmation(input);};
  return <View style={{gap:12}}>
    <Text style={{color:palette.text,fontFamily:fonts.semibold,fontSize:16}}>WhatsApp account</Text>
    {discovery && <Text style={text}>Active profile: {discovery.label}</Text>}
    {!!profileNotice && <Text accessibilityLiveRegion="polite" style={text}>{profileNotice}</Text>}
    {operation && <Text style={text}>Account operation: {operation.state}. {operation.state === 'completed' ? 'Pairing and enabling AI are separate actions.' : 'No pairing or send is performed by this screen.'}</Text>}
    {!acceptedScope && <>
      {discovery && <Button label="Continue with this profile" disabled={profileBusy} onPress={()=>{void continueProfile();}}/>}
      <Button label="Check account status" secondary onPress={()=>{void refresh();}}/>
    </>}
    {acceptedScope && <>
      <TextInput accessibilityLabel="Fresh profile label" value={label} onChangeText={setLabel} maxLength={80}
        placeholder="Name for the new profile" placeholderTextColor={palette.muted}
        style={{...text,color:palette.text,padding:12,borderWidth:1,borderColor:palette.border,borderRadius:12}}/>
      <Button label="Use another number" secondary disabled={disabled || !label.trim()} onPress={()=>prepare({kind:'create',requestId:randomUUID(),confirm:true,label:label.trim()},label.trim())}/>
      <Button label={loading?'Loading preserved profiles…':'Return to preserved profile'} secondary disabled={disabled || loading} onPress={()=>{
        if(lock.current)return;lock.current=true;setLoading(true);
        void client.request('/v1/profiles',ProfileList).then(result=>setPreserved(result.profiles.filter(profile=>!profile.active)))
          .catch(reason=>reportError(reason instanceof Error ? reason.message : 'Could not load preserved profiles.'))
          .finally(()=>{lock.current=false;setLoading(false);});
      }}/>
      {preserved?.length===0 && <Text style={text}>No preserved profile is available yet.</Text>}
      {preserved?.map(profile=><Button key={profile.profileId} label={'Return to '+profile.label} secondary disabled={disabled}
        onPress={()=>prepare({kind:'activate',requestId:randomUUID(),confirm:true,profileId:profile.profileId},profile.label)}/>)}
      <Button label="Repair this number" secondary disabled={disabled} onPress={()=>prepare({kind:'repair',requestId:randomUUID(),confirm:true},discovery?.label ?? 'this profile')}/>
    </>}
    {confirmation && <View accessibilityLabel="Confirm account change" style={{gap:12}}>
      <Text style={{...text,color:palette.text,fontFamily:fonts.semibold}}>
        {confirmation.kind==='create' ? 'Use another number with '+targetLabel+'?' : confirmation.kind==='activate' ? 'Return to '+targetLabel+'?' : 'Repair '+targetLabel+'?'}
      </Text>
      <Text style={text}>Current profile: {discovery?.label ?? 'active profile'}. Its data stays preserved. AI will be off. Queued unsent replies are cancelled. Unknown send outcomes stay recorded and will not be retried.</Text>
      <Text style={text}>{confirmation.kind==='create'
        ? 'The new profile starts empty, with no copied chats, drafts, permissions or settings. Pair the different number only after this change completes.'
        : confirmation.kind==='activate'
          ? 'The preserved profile keeps its own history and local drafts. It starts disconnected. Pairing and enabling AI need separate actions.'
          : 'Only this same number may pair again. Its owner lock and history stay intact, and its expired authentication is archived. A different number will be rejected.'}</Text>
      <Button label="Confirm account change" disabled={disabled} onPress={()=>{
        if(lock.current)return;lock.current=true;
        const input=confirmation;setConfirmation(null);
        void transitionProfile(input).finally(()=>{lock.current=false;});
      }}/>
      <Button label="Cancel account change" secondary onPress={()=>setConfirmation(null)}/>
    </View>}
  </View>;
}
