const assert=require('node:assert/strict');

// Unlike the older render fixture, commits run dependency cleanups before setups.
// Layout teardown always precedes passive teardown, including native release.
function lifecycleHooks() {
  const slots=[];let cursor=0,dirty=false;let layouts=[],effects=[];
  const changed=(previous,deps)=>!previous || !deps || deps.length!==previous.length || deps.some((value,index)=>!Object.is(value,previous[index]));
  function effect(kind,fn,deps) {
    const index=cursor++;const slot=slots[index] ??= {kind};
    if(changed(slot.deps,deps)){slot.deps=deps;(kind==='layout'?layouts:effects).push({slot,fn});}
  }
  const react={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;
      return[slots[index],value=>{const next=typeof value==='function'?value(slots[index]):value;if(!Object.is(next,slots[index])){slots[index]=next;dirty=true;}}];},
    useRef(initial){const index=cursor++;return slots[index] ??= {current:initial};},
    useMemo(fn,deps){const index=cursor++;if(changed(slots[index]?.deps,deps))slots[index]={value:fn(),deps};return slots[index].value;},
    useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
    useEffect:(fn,deps)=>effect('passive',fn,deps),useLayoutEffect:(fn,deps)=>effect('layout',fn,deps),
    useImperativeHandle(ref,fn,deps){react.useLayoutEffect(()=>{if(ref)ref.current=fn();return()=>{if(ref)ref.current=null;};},deps);},
    useSyncExternalStore(_subscribe,get){return get();},memo:fn=>fn,
  };
  const run=pending=>{for(const {slot} of pending)slot.cleanup?.();for(const {slot,fn} of pending)slot.cleanup=fn();};
  const flush=()=>{const layout=layouts,passive=effects;layouts=[];effects=[];run(layout);run(passive);};
  return {react,render(fn){cursor=0;return fn();},flush,
    commit(fn){let tree;for(let pass=0;pass<30;pass++){dirty=false;tree=this.render(fn);flush();if(!dirty)return tree;}assert.fail('Render did not settle');},
    unmount(){for(const kind of ['layout','passive'])for(const slot of slots)if(slot?.kind===kind){slot.cleanup?.();slot.cleanup=undefined;}},
  };
}
module.exports={lifecycleHooks};
