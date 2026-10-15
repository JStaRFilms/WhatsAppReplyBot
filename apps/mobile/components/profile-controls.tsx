import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ProfileDescriptor, ProfileList, ProfileTransitionInput } from '@replybot/core/api';
import { useApp } from '../lib/app-state';
import { randomUUID } from '../lib/uuid';
import { fonts } from '../lib/theme';
import { Button } from './ui';

export function ProfileControls() {
  const { palette, client, acceptedScope, discovery, profileBusy, profileNotice, operation, status, sessionKey, pcStatus,
    continueProfile, transitionProfile, refresh, reportError } = useApp();
  const [form,setForm]=useState<'create'|'switch'|null>(null);
  const [label,setLabel]=useState('');
  const [profiles,setProfiles]=useState<ProfileDescriptor[] | null>(null);
  const [confirmation,setConfirmation]=useState<ProfileTransitionInput | null>(null);
  const [targetLabel,setTargetLabel]=useState('');
  const [loading,setLoading]=useState(false);
  const lock=useRef(false);
  const listRead=useRef<AbortController | null>(null);
  useEffect(()=>{
    setForm(null);setConfirmation(null);setProfiles(null);setLabel('');setLoading(false);lock.current=false;
    return()=>listRead.current?.abort();
  },[sessionKey]);
  const disabled=profileBusy || status !== 'online';
  const text={color:palette.muted,fontFamily:fonts.regular,fontSize:14,lineHeight:21};
  const prepare=(input:ProfileTransitionInput,target:string)=>{setTargetLabel(target);setConfirmation(input);setForm(null);};
  const showProfiles=async()=>{
    if(lock.current)return;
    lock.current=true;setLoading(true);setForm('switch');setConfirmation(null);
    const abort=new AbortController();listRead.current=abort;
    try {
      const result=await client.request('/v1/profiles',ProfileList,undefined,abort.signal);
      if(!abort.signal.aborted)setProfiles(result.profiles);
    } catch(reason) {
      if(!abort.signal.aborted)reportError(reason instanceof Error ? reason.message : 'Could not load profiles.');
    } finally {
      if(!abort.signal.aborted){lock.current=false;setLoading(false);}
    }
  };
  return <View style={{gap:12}}>
    <Text style={{color:palette.text,fontFamily:fonts.semibold,fontSize:16}}>Profile</Text>
    {discovery && <Text style={text}>Active profile: {discovery.label}</Text>}
    {!!profileNotice && <Text accessibilityLiveRegion="polite" style={text}>{profileNotice}</Text>}
    {operation && <Text style={text}>Profile change: {operation.state}. {operation.state === 'completed' ? 'WhatsApp linking and AI permission are separate.' : 'Wait for the result before starting another change.'}</Text>}
    {!acceptedScope && <>
      {discovery && <Button label="Continue with this profile" disabled={profileBusy || pcStatus!=='authenticated'} onPress={()=>{void continueProfile();}}/>}
      <Button label="Check profile status" secondary onPress={()=>{void refresh();}}/>
    </>}
    {acceptedScope && !confirmation && <>
      <Button label="Create profile" secondary disabled={disabled} onPress={()=>{setForm('create');setProfiles(null);}}/>
      <Button label={loading?'Loading profiles…':'Switch profile'} secondary disabled={disabled || loading} onPress={()=>{void showProfiles();}}/>
      <Button label="Relink this profile" secondary disabled={disabled} onPress={()=>prepare({kind:'repair',requestId:randomUUID(),confirm:true},discovery?.label ?? 'this profile')}/>
    </>}
    {form==='create' && <>
      <Text style={text}>A profile is a separate workspace. Its name is a label, not a phone number.</Text>
      <TextInput accessibilityLabel="Profile name" value={label} onChangeText={setLabel} maxLength={80}
        placeholder="Name for the new profile" placeholderTextColor={palette.muted}
        style={{...text,color:palette.text,padding:12,borderWidth:1,borderColor:palette.border,borderRadius:12}}/>
      <Button label="Review new profile" disabled={disabled || !label.trim()} onPress={()=>prepare({kind:'create',requestId:randomUUID(),confirm:true,label:label.trim()},label.trim())}/>
    </>}
    {form==='switch' && <>
      {profiles?.every(profile=>profile.active) && <Text style={text}>No other saved profile yet.</Text>}
      {profiles?.map(profile=><Button key={profile.profileId} label={profile.label+(profile.active?' · Active':'')} secondary disabled={disabled || profile.active}
        onPress={()=>prepare({kind:'activate',requestId:randomUUID(),confirm:true,profileId:profile.profileId},profile.label)}/>)}
    </>}
    {form && <Button label="Cancel" secondary onPress={()=>{listRead.current?.abort();lock.current=false;setLoading(false);setForm(null);}}/>}
    {confirmation && <View accessibilityLabel="Confirm profile change" style={{gap:12}}>
      <Text style={{...text,color:palette.text,fontFamily:fonts.semibold}}>
        {confirmation.kind==='create' ? 'Create '+targetLabel+'?' : confirmation.kind==='activate' ? 'Switch to '+targetLabel+'?' : 'Relink '+targetLabel+'?'}
      </Text>
      <Text style={text}>Current profile: {discovery?.label ?? 'active profile'}. Its data stays preserved. AI will be off. Queued unsent replies are cancelled. Unknown send outcomes stay recorded and will not be retried.</Text>
      <Text style={text}>{confirmation.kind==='create'
        ? 'The new profile starts empty. Chats, drafts, permissions, settings and AI data are not copied. Link the intended WhatsApp account after this change completes.'
        : confirmation.kind==='activate'
          ? 'This profile keeps its own history and local drafts. It starts disconnected with AI off. Link WhatsApp to reuse its saved session. Relink only if that session no longer works.'
          : 'Only the same WhatsApp account can link again. Its owner lock and history stay intact. Old pairing material is archived after safe shutdown. Use a separate profile for a different number.'}</Text>
      <Button label="Confirm profile change" disabled={disabled} onPress={()=>{
        if(lock.current)return;lock.current=true;
        const input=confirmation;setConfirmation(null);
        void transitionProfile(input).finally(()=>{lock.current=false;});
      }}/>
      <Button label="Cancel" secondary onPress={()=>setConfirmation(null)}/>
    </View>}
  </View>;
}
