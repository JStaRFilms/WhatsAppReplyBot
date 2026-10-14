import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { Conversation } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import { Button } from './ui';
export function PauseControls({ conversation:c }: { conversation:Conversation }) {
  const { perform,palette,status }=useApp();const [menu,setMenu]=useState(false);const [busy,setBusy]=useState(false);
  const apply=async(action:'resume'|'extend'|'indefinite')=>{
    if(busy)return;setBusy(true);
    try{const result=await perform('/v1/conversations/'+encodeURIComponent(c.id)+'/control',Conversation,{action});if(result)setMenu(false);}
    finally{setBusy(false);}
  };
  if(c.kind!=='direct'||c.excluded||c.mode==='never_reply')return null;
  return <View style={{flexDirection:'row',alignItems:'center',gap:8,flexShrink:0}}>
    {c.control==='manual'&&<Pressable accessibilityRole="button" accessibilityLabel="Resume now" disabled={busy||status!=='online'||c.pause?.composing}
      onPress={()=>{void apply('resume');}} style={{justifyContent:'center',minHeight:28}}><Text numberOfLines={1} style={{fontFamily:fonts.medium,fontSize:12,lineHeight:18,color:palette.accent}}>{busy?'Applying…':'Resume now'}</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Pause options" onPress={()=>setMenu(true)} style={{padding:5,justifyContent:'center',height:28}}><MoreHorizontal size={18} color={palette.muted}/></Pressable>
    <Modal visible={menu} transparent animationType="fade" onRequestClose={()=>setMenu(false)}>
      <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'#00000088'}}>
        <Pressable style={{flex:1}} onPress={()=>setMenu(false)}/>
        <View style={{padding:22,gap:12,backgroundColor:palette.background,borderTopLeftRadius:16,borderTopRightRadius:16}}>
          <Button label="Extend pause · 5 min" disabled={busy} onPress={()=>{void apply('extend');}}/>
          <Button label="Pause indefinitely" secondary disabled={busy} onPress={()=>{void apply('indefinite');}}/>
          <Button label="Close" secondary disabled={busy} onPress={()=>setMenu(false)}/>
        </View>
      </View>
    </Modal>
  </View>;
}
