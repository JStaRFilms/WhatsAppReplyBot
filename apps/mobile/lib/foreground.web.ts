import { useEffect, useState } from 'react';

export function isForeground() {
  return typeof document==='undefined' || document.visibilityState==='visible' && document.hasFocus();
}
export function useForeground() {
  const [visible,setVisible]=useState(isForeground);
  useEffect(()=>{
    const update=()=>setVisible(isForeground());
    document.addEventListener('visibilitychange',update);
    window.addEventListener('focus',update);window.addEventListener('blur',update);
    update();
    return()=>{
      document.removeEventListener('visibilitychange',update);
      window.removeEventListener('focus',update);window.removeEventListener('blur',update);
    };
  },[]);
  return visible;
}
