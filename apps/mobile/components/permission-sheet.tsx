import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Proposal, Conversation, type Mode } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import { Button, ErrorNotice } from './ui';
import { DateTimeField } from './date-time-field';
const labels={never_reply:'AI off',draft_only:'Drafts only',auto_reply:'Auto reply'};
export function PermissionSheet({conversation,visible,onClose}:{conversation:Conversation;visible:boolean;onClose:()=>void}) {
  const {palette,perform,status}=useApp();
  const [proposal,setProposal]=useState<Proposal | null>(null);
  const [mode,setMode]=useState<Mode>(conversation.mode ?? 'draft_only');
  const [limit,setLimit]=useState('20');const [unlimited,setUnlimited]=useState(false);
  const [minutes,setMinutes]=useState<number | null>(30);const [dated,setDated]=useState(false);
  const [end,setEnd]=useState(()=>new Date(Date.now()+86400000));const [riskAccepted,setRiskAccepted]=useState(false);
  const [busy,setBusy]=useState(false);const lock=useRef(false);
  useEffect(()=>{if(visible){setMode(conversation.mode ?? 'draft_only');setProposal(null);setRiskAccepted(false);}},[visible,conversation.id]);
  useEffect(()=>{setRiskAccepted(false);},[limit,unlimited,minutes,dated,end]);
  const units=unlimited ? null : Number(limit);
  const expiresAt=dated ? end.getTime() : minutes===null ? null : Date.now()+minutes*60000;
  const validLimit=units===null || /^\d+$/.test(limit) && Number.isSafeInteger(units) && units>0;
  const validEnd=expiresAt===null || Number.isFinite(expiresAt) && expiresAt>Date.now();
  const risky=mode==='auto_reply' && (units===null || units>20 || expiresAt===null || expiresAt>Date.now()+86400000);
  const apply=async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);
    try{
      if(proposal){
        const result=await perform('/v1/owner-actions/'+encodeURIComponent(proposal.id)+'/confirm',Conversation,{payloadHash:proposal.payloadHash});
        if(result){setProposal(null);onClose();}
      }else{
        const result=await perform('/v1/conversations/'+encodeURIComponent(conversation.id)+'/owner-actions',Proposal,
          {kind:'configure',mode,...(mode==='auto_reply' ? {maxUnits:units,expiresAt,acknowledgeRisk:riskAccepted} : {})});
        if(result)setProposal(result);
      }
    }finally{lock.current=false;setBusy(false);}
  };
  const close=()=>{if(!busy){setProposal(null);onClose();}};
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'#00000088'}}>
      <Pressable style={{flex:1}} accessibilityLabel="Close permissions" onPress={close}/>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:22,gap:16,paddingBottom:36}} style={{maxHeight:'85%',width:'100%',maxWidth:680,alignSelf:'center',backgroundColor:palette.background,borderTopLeftRadius:22,borderTopRightRadius:22}}>
        <Text style={{fontFamily:fonts.semibold,fontSize:20,color:palette.text}}>{conversation.name}</Text><ErrorNotice/>
        {proposal ? <>
          <Text style={{fontFamily:fonts.regular,fontSize:16,lineHeight:24,color:palette.text}}>
            {labels[proposal.mode ?? mode]}{proposal.mode==='auto_reply' ? '\n'+(proposal.maxUnits===null ? 'Unlimited actions' : proposal.maxUnits+' actions')+' · '+(proposal.expiresAt===null ? 'No expiry' : 'Until '+new Date(proposal.expiresAt).toLocaleString()) : ''}{conversation.control==='manual' && proposal.mode!=='never_reply' ? '\nResume AI' : ''}?
          </Text>
          {proposal.riskAccepted && <Text style={{color:palette.manual,fontFamily:fonts.regular,fontSize:13,lineHeight:19}}>AI can send incorrect messages and incur ongoing API charges. You can pause at any time.</Text>}
          <Button label={busy ? 'Applying…' : 'Confirm'} disabled={busy || status!=='online'} onPress={()=>{void apply();}}/>
          <Button label="Back" secondary disabled={busy} onPress={()=>setProposal(null)}/>
        </> : <>
          {(['never_reply','draft_only','auto_reply'] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:mode===value}} accessibilityLabel={labels[value]} onPress={()=>setMode(value)} disabled={busy} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10}}>
            <View style={{width:18,height:18,borderRadius:9,borderWidth:mode===value ? 5 : 1,borderColor:mode===value ? palette.accent : palette.muted}}/>
            <Text style={{fontFamily:fonts.medium,fontSize:16,color:palette.text}}>{labels[value]}</Text>
          </Pressable>)}
          {mode==='auto_reply' && <>
            <Text style={{fontFamily:fonts.medium,color:palette.text,fontSize:14}}>Reply limit</Text>
            <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[5,20].map(n=><Button key={n} label={String(n)} secondary={unlimited || limit!==String(n)} disabled={busy} onPress={()=>{setUnlimited(false);setLimit(String(n));}}/>)}
              <Button label="Unlimited" secondary={!unlimited} disabled={busy} onPress={()=>setUnlimited(true)}/></View>
            <TextInput accessibilityLabel="Custom reply limit" value={unlimited ? '' : limit} placeholder={unlimited ? 'Unlimited' : 'Custom number'} placeholderTextColor={palette.muted} keyboardType="number-pad" maxLength={15} editable={!busy}
              onChangeText={value=>{setUnlimited(false);setLimit(value);}} style={{backgroundColor:palette.surface,color:palette.text,fontFamily:fonts.regular,padding:12,borderRadius:10,borderWidth:1,borderColor:palette.border}}/>
            <Text style={{fontFamily:fonts.medium,color:palette.text,fontSize:14}}>Duration</Text>
            <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{[30,60,1440,2880].map(n=><Button key={n} label={n<60 ? n+' min' : n/60+' hr'} secondary={dated || minutes!==n} disabled={busy} onPress={()=>{setDated(false);setMinutes(n);}}/>)}
              <Button label="Indefinitely" secondary={dated || minutes!==null} disabled={busy} onPress={()=>{setDated(false);setMinutes(null);}}/>
              <Button label="Choose date" secondary={!dated} disabled={busy} onPress={()=>setDated(true)}/></View>
            {dated && <DateTimeField value={end} onChange={setEnd}/>}
            {(!validLimit || !validEnd) && <Text style={{fontFamily:fonts.regular,color:palette.danger,fontSize:13}}>Choose a positive whole number and a future end time.</Text>}
            <Text style={{fontFamily:fonts.regular,color:palette.muted,fontSize:12}}>Reactions count toward the limit.</Text>
            {risky && <Pressable accessibilityRole="checkbox" accessibilityState={{checked:riskAccepted}} accessibilityLabel="Accept extended automation risk" onPress={()=>setRiskAccepted(v=>!v)} disabled={busy} style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <Text style={{color:palette.manual,fontSize:22}}>{riskAccepted ? '☑' : '☐'}</Text>
              <Text style={{flex:1,color:palette.manual,fontFamily:fonts.regular,fontSize:13,lineHeight:19}}>AI can send incorrect messages and incur ongoing API charges. I accept this longer or unlimited run.</Text>
            </Pressable>}
          </>}
          <Button label={busy ? 'Saving…' : 'Save'} disabled={busy || status!=='online' || mode==='auto_reply' && (!validLimit || !validEnd || risky && !riskAccepted)} onPress={()=>{void apply();}}/>
          <Button label="Close" secondary disabled={busy} onPress={close}/>
        </>}
      </ScrollView>
    </View>
  </Modal>;
}
