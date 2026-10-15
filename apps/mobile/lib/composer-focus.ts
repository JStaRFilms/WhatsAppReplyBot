import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Keyboard, type TextInput } from 'react-native';
import { isForeground } from './foreground';

// Only an unfinished, explicitly focused composer may reopen after backgrounding.
export function useComposerFocus(id:string,scope:object,active:boolean,foreground:boolean,unfinished:boolean) {
  const input=useRef<TextInput>(null);
  const intended=useRef(false);
  const previousForeground=useRef(foreground);
  const current=useRef({active,foreground,unfinished});current.current={active,foreground,unfinished};
  const clear=useCallback(()=>{intended.current=false;input.current?.blur();Keyboard.dismiss();},[]);
  useLayoutEffect(()=>{
    intended.current=false;
    return clear;
  },[id,scope,clear]);
  useEffect(()=>{
    const subscription=Keyboard.addListener('keyboardDidHide',()=>{
      if(isForeground() && current.current.foreground){
        intended.current=false;
        // Android can hide the keyboard without clearing TextInput focus. A later
        // explicit quote must be able to focus it again instead of becoming a no-op.
        input.current?.blur();
      }
    });
    return()=>subscription.remove();
  },[]);
  useLayoutEffect(()=>{
    const returning=!previousForeground.current && foreground;
    previousForeground.current=foreground;
    if(!foreground)input.current?.blur();
    if(!returning || !active || !unfinished || !intended.current)return;
    const frame=requestAnimationFrame(()=>{
      const value=current.current;
      if(value.active && value.foreground && value.unfinished && intended.current && isForeground())input.current?.focus();
    });
    return()=>cancelAnimationFrame(frame);
  },[active,foreground,unfinished]);
  const focus=()=>{
    if(!current.current.active || !isForeground())return;
    intended.current=true;input.current?.focus();
  };
  return {input,clear,focus,
    onFocus:()=>{intended.current=true;},
    onBlur:()=>{if(isForeground() && current.current.foreground)intended.current=false;},
  };
}
