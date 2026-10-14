import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function isForeground() {
  return AppState.currentState === 'active' || AppState.currentState === null;
}
export function useForeground() {
  const [visible,setVisible]=useState(isForeground);
  useEffect(()=>{
    const update=()=>setVisible(isForeground());
    const subscription=AppState.addEventListener('change',update);
    update();return()=>subscription.remove();
  },[]);
  return visible;
}
