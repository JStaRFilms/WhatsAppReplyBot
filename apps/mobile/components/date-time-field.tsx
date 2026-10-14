import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from './ui';
export function DateTimeField({value,onChange}:{value:Date;onChange:(value:Date)=>void}) {
  const [mode,setMode]=useState<'date'|'time' | null>(null);
  return <View style={{gap:8}}>
    <View style={{flexDirection:'row',gap:8}}>
      <Button label={value.toLocaleDateString()} secondary onPress={()=>setMode('date')}/>
      <Button label={value.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} secondary onPress={()=>setMode('time')}/>
    </View>
    {mode && <DateTimePicker value={value} mode={mode} minimumDate={mode==='date' ? new Date() : undefined} onChange={(event,chosen)=>{
      if(Platform.OS==='android' || event.type==='dismissed')setMode(null);
      if(event.type==='set' && chosen){const next=new Date(value);
        if(mode==='date')next.setFullYear(chosen.getFullYear(),chosen.getMonth(),chosen.getDate());
        else next.setHours(chosen.getHours(),chosen.getMinutes(),0,0);
        onChange(next);}
    }}/>}
    {mode && Platform.OS!=='android' && <Button label="Done" secondary onPress={()=>setMode(null)}/>}
  </View>;
}
