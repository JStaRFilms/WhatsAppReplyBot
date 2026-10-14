let current:(()=>void) | undefined;
export function stopPlayback():void {const previous=current;current=undefined;previous?.();}
export function claimPlayback(stop:()=>void):void {if(current!==stop){stopPlayback();current=stop;}}
export function releasePlayback(stop:()=>void):void {if(current===stop)current=undefined;}
