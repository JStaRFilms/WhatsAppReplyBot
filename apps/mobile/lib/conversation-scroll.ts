import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, MeasureInWindowOnSuccessCallback, NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';
import type { HistoryCache } from './history-cache';

const savedPositions = new WeakMap<HistoryCache, Map<string, { offset: number; atBottom: boolean }>>();
type Position = {
  offset: number; initialOffset: number; following: boolean; atBottom: boolean;
  height: number; contentHeight: number; measured: boolean; positioned: boolean; dragging: boolean;
  target: number | null; editor: number | null;
};
type Row = { y: number; height: number };
type MeasuredTurn = Row & { sourceY: number; sourceHeight: number };
type RowNodes = {
  turn: View | null; source: View | null;
  refs: { turn: (node: View | null) => void; source: (node: View | null) => void };
};
type Measurement = {
  pending: boolean; revision: number; frame: number | null; timer: ReturnType<typeof setTimeout> | undefined;
  onMeasured?: (layouts: ReadonlyMap<string, MeasuredTurn>) => void;
};
const nearBottom = 80;
const visibleBottom = 24;

export function useConversationScroll(history: HistoryCache, id: string, loaded: boolean, cancelViewed: () => void, page?: ReturnType<HistoryCache['get']>, scope?: unknown) {
  const scroll = useRef<ScrollView>(null);
  const position = useMemo<Position>(() => {
    const saved = savedPositions.get(history)?.get(id);
    return { offset: saved?.offset ?? 0, initialOffset: saved?.offset ?? 0, following: saved?.atBottom ?? true,
      atBottom: false, height: 0, contentHeight: 0, measured: false, positioned: false, dragging: false,
      target: null, editor: null };
  }, [history, id, scope]);
  const current = useRef<typeof position | null>(position); current.current = position;
  const frames = useRef<number[]>([]);
  const rows = useMemo(()=>new Map<string,Row>(),[position]);
  const nodes = useMemo(()=>new Map<string,RowNodes>(),[position]);
  const permittedRows=useMemo<{ids:Set<string> | null; turns:Set<string>}>(()=>({ids:null,turns:new Set()}),[position]);
  const read=useMemo<Measurement>(()=>({pending:true,revision:0,frame:null,timer:undefined}),[position,page]);
  const currentRead=useRef<Measurement | null>(read);currentRead.current=read;
  const refreshRead=useRef<() => void>(()=>{});
  const isCurrent=()=>current.current===position && currentRead.current===read && (page===undefined || history.get?.(id)===page);
  const geometryPending=()=>read.pending && (page!==undefined || permittedRows.ids!==null);
  const restoring = useRef<{id:string;offset:number} | undefined>(undefined);
  const [visibleIds,setVisibleIds] = useState<string[]>([]);
  const [visibilityRevision,setVisibilityRevision] = useState(0);
  const intersections = () => [...rows].filter(([,row])=>row.height>0 && row.y+row.height>position.offset+1 && row.y<position.offset+position.height-1)
    .sort((a,b)=>a[1].y-b[1].y).map(([id])=>id);
  const saveAnchor = () => {
    const first=intersections()[0];if(!first)return;
    const row=rows.get(first);if(!row)return;
    const anchor={id:first,offset:row.y-position.offset};history.pin?.(id,anchor);return anchor;
  };
  const [positioned, setPositioned] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [showLatest, setShowLatest] = useState(false);
  const cancelFrames = useCallback(() => { frames.current.forEach(cancelAnimationFrame); frames.current = []; }, []);
  const stopRead = (value:Measurement) => {
    if(value.frame!==null)cancelAnimationFrame(value.frame);
    if(value.timer!==undefined)clearTimeout(value.timer);value.frame=null;value.timer=undefined;
  };
  const update = () => {
    if(!isCurrent())return;
    position.atBottom = position.contentHeight - position.height - position.offset <= visibleBottom;
    setPositioned(position.positioned); setAtBottom(position.atBottom);
    setShowLatest(position.positioned && !position.following && !position.atBottom);
    const visible=geometryPending()?[]:intersections();setVisibleIds(previous=>previous.join('\n')===visible.join('\n')?previous:visible);
    setVisibilityRevision(value=>value+1);
    if (!position.atBottom || geometryPending()) cancelViewed();
    if(!geometryPending() && position.positioned && position.target===null && !restoring.current)saveAnchor();
    if (position.positioned) {
      let saved = savedPositions.get(history);
      if (!saved) { saved = new Map(); savedPositions.set(history, saved); }
      saved.set(id, { offset: position.offset, atBottom: !history.get?.(id)?.hasNewer && position.contentHeight - position.height - position.offset <= nearBottom });
    }
  };
  const follow = () => {
    if (!isCurrent() || !loaded || !position.measured || position.height <= 0 || position.dragging) return;
    if (position.editor !== null) {
      const editor = position.editor;
      cancelFrames();
      frames.current.push(requestAnimationFrame(() => {
        if (isCurrent() && position.editor === editor)
          scroll.current?.scrollResponderScrollNativeHandleToKeyboard(editor, 16, true);
      }));
      return;
    }
    if (restoring.current || position.positioned && !position.following) return;
    const bottom = Math.max(0, position.contentHeight - position.height);
    position.target = !position.positioned && !position.following ? Math.min(position.initialOffset, bottom) : bottom;
    cancelFrames();
    frames.current.push(requestAnimationFrame(() => {
      if (!isCurrent() || position.target === null) return;
      const target = position.target;
      scroll.current?.scrollTo({ y: target, animated: false });
      // A request is not proof that the newest message was actually displayed.
      if (Math.abs(position.offset - target) <= 2) {
        position.target = null; position.positioned = true; update();
      }
    }));
  };
  const restoreAnchor = () => {
    if(!isCurrent() || geometryPending())return;
    const anchor=restoring.current;if(!anchor || position.dragging || position.editor!==null)return;
    const row=rows.get(anchor.id);if(!row)return;
    const revision=read.revision;
    cancelFrames();
    frames.current.push(requestAnimationFrame(()=>{
      if(!isCurrent() || geometryPending() || read.revision!==revision || restoring.current!==anchor)return;
      const target=Math.max(0,row.y-anchor.offset);position.target=target;position.following=false;
      scroll.current?.scrollTo({y:target,animated:false});
      if(Math.abs(position.offset-target)<=2){position.target=null;position.positioned=true;restoring.current=undefined;update();}
    }));
  };
  const measureRows = (attempt=0) => {
    read.frame=requestAnimationFrame(()=>{
      read.frame=null;
      if(!isCurrent() || !read.pending)return;
      const revision=read.revision,offset=position.offset,height=position.height,contentHeight=position.contentHeight;
      const viewport=scroll.current?.getNativeScrollRef?.();
      if(!viewport)return;
      const batch=[...permittedRows.turns].map(key=>({key,turn:nodes.get(key)?.turn,source:nodes.get(key)?.source}));
      const valid=()=>isCurrent() && read.pending && read.revision===revision && position.offset===offset
        && position.height===height && position.contentHeight===contentHeight && scroll.current?.getNativeScrollRef?.()===viewport;
      let finished=false,retried=false;
      const retry=(discard=true)=>{
        if(finished || !valid())return;
        if(discard)finished=true;
        if(retried)return;
        retried=true;clearTimeout(read.timer);read.timer=undefined;
        // Retry dropped native callbacks finitely, without rejecting a slow but
        // still-current batch. Ref, page, layout and scroll events restart reads.
        if(attempt<2)measureRows(attempt+1);
      };
      read.timer=setTimeout(()=>retry(false),100);
      if(height<=0 || batch.some(row=>!row.turn || !row.source))return;
      const layouts=new Map<string,MeasuredTurn>();
      const measure=(node:Pick<View,'measureInWindow'>,callback:MeasureInWindowOnSuccessCallback)=>{
        try{node.measureInWindow(callback);}catch{retry();}
      };
      measure(viewport,(_x,viewportY,_width,viewportHeight)=>{
        if(finished || !valid())return;
        if(!Number.isFinite(viewportY) || !Number.isFinite(viewportHeight) || viewportHeight<=0 || Math.abs(viewportHeight-height)>1){retry();return;}
        let remaining=batch.length*2;
        const complete=()=>{
          if(finished || !valid())return;
          measure(viewport,(_x,endY,_width,endHeight)=>{
            if(finished || !valid())return;
            if(endY!==viewportY || endHeight!==viewportHeight || batch.some(row=>nodes.get(row.key)?.turn!==row.turn || nodes.get(row.key)?.source!==row.source)){
              retry();return;
            }
            finished=true;clearTimeout(read.timer);read.timer=undefined;
            rows.clear();
            for(const [key,row] of layouts)if(permittedRows.ids?.has(key))rows.set(key,{y:row.y+row.sourceY,height:row.sourceHeight});
            read.pending=false;
            read.onMeasured?.(layouts);restoreAnchor();update();
          });
        };
        if(!remaining){complete();return;}
        for(const row of batch){
          const values:{turn?:Row;source?:Row}={};
          const received=(kind:'turn'|'source',y:number,rowHeight:number)=>{
            if(finished || !valid())return;
            if(!Number.isFinite(y) || !Number.isFinite(rowHeight) || rowHeight<0){retry();return;}
            values[kind]={y:y-viewportY+offset,height:rowHeight};
            if(values.turn && values.source)layouts.set(row.key,{...values.turn,sourceY:values.source.y-values.turn.y,sourceHeight:values.source.height});
            if(--remaining===0)complete();
          };
          if(row.turn)measure(row.turn,(_x,y,_width,rowHeight)=>received('turn',y,rowHeight));
          if(row.source)measure(row.source,(_x,y,_width,rowHeight)=>received('source',y,rowHeight));
        }
      });
    });
  };
  const invalidateRows = () => {
    if(!isCurrent() || permittedRows.ids===null)return;
    if(!read.pending && position.positioned && position.target===null && !position.following && !restoring.current)restoring.current=saveAnchor();
    stopRead(read);read.pending=true;read.revision++;
    cancelViewed();setVisibleIds([]);setVisibilityRevision(value=>value+1);measureRows();
  };
  refreshRead.current=invalidateRows;
  useLayoutEffect(() => {
    current.current = position;
    setPositioned(false); setAtBottom(false); setShowLatest(false);setVisibleIds([]);
    restoring.current=history.anchor?.(id);
    return () => { if (current.current === position) current.current = null; cancelFrames(); };
  }, [position, cancelFrames]);
  useLayoutEffect(()=>{
    currentRead.current=read;invalidateRows();
    return()=>{stopRead(read);if(currentRead.current===read)currentRead.current=null;cancelViewed();};
  },[read]);
  const latest = () => {
    if (!isCurrent()) return;
    position.editor = null;restoring.current=undefined;
    position.dragging = false; position.following = true; setShowLatest(false); cancelViewed(); follow();
  };
  const editorFocus = useCallback((target: number | null) => {
    if (!isCurrent()) return;
    const previous = position.editor; position.editor = target;
    if (target !== null) {
      position.following = false; position.target = null; cancelViewed();
    } else if (previous !== null && position.target === null) {
      position.following = position.contentHeight - position.height - position.offset <= nearBottom;
    }
    follow(); update();
  }, [position, read, loaded, cancelViewed, cancelFrames]);
  const beginDrag = () => {if(!isCurrent())return;cancelFrames();restoring.current=undefined;position.target = null; position.dragging = true; position.following = false; cancelViewed(); update(); };
  const endDrag = () => {
    if(!isCurrent())return;
    position.dragging = false;
    position.following = position.editor === null && position.contentHeight - position.height - position.offset <= nearBottom;
    update();
  };
  const visibilityRead=read.revision,visibilityOffset=position.offset;
  return { scroll, position, positioned, atBottom, showLatest, latest, editorFocus,
    visibleIds:geometryPending()?[]:visibleIds, visibilityRevision,
    refreshRows:invalidateRows,
    hasCurrentGeometry:()=>isCurrent() && !geometryPending(),
    isVisibilityCurrent:()=>isCurrent() && scroll.current!==null && read.revision===visibilityRead && position.offset===visibilityOffset && !geometryPending() && position.positioned && !position.dragging && position.target===null && !restoring.current,
    rowRefs: (key:string) => {
      const previous=nodes.get(key);if(previous)return previous.refs;
      const assign=(kind:'turn'|'source',node:View | null)=>{
        if(current.current!==position || nodes.get(key)!==entry || entry[kind]===node)return;
        entry[kind]=node;refreshRead.current();
      };
      const entry:RowNodes={turn:null,source:null,refs:{turn:node=>assign('turn',node),source:node=>assign('source',node)}};
      nodes.set(key,entry);return entry.refs;
    },
    preserve: () => {if(!isCurrent() || !position.positioned)return;if(!geometryPending())restoring.current=saveAnchor();position.following=false;cancelViewed();},
    restore: restoreAnchor,
    onRowLayout: (messageId:string,y:number,height:number) => {
      if(!isCurrent() || permittedRows.ids && !permittedRows.ids.has(messageId))return;
      if(permittedRows.ids!==null){invalidateRows();return;}
      if(position.positioned && position.target===null && !position.following && !restoring.current)restoring.current=saveAnchor();
      rows.set(messageId,{y,height});restoreAnchor();update();
    },
    retainRows: (ids:readonly string[],turnIds:readonly string[]=ids,onMeasured?:Measurement['onMeasured']) => {
      if(!isCurrent())return;
      permittedRows.ids=new Set(ids);permittedRows.turns=new Set(turnIds);read.onMeasured=onMeasured;
      for(const key of rows.keys())if(!permittedRows.ids.has(key))rows.delete(key);
      for(const key of nodes.keys())if(!permittedRows.turns.has(key))nodes.delete(key);
      if(restoring.current && !turnIds.includes(restoring.current.id)){const replacement=history.anchor?.(id);restoring.current=replacement && turnIds.includes(replacement.id)?replacement:undefined;}
      invalidateRows();
    },
    settled: positioned && !geometryPending() && !position.dragging && position.target===null && !restoring.current,
    locate: (offset: number,onLocated?:()=>void) => {
      if(!isCurrent())return;
      cancelFrames();cancelViewed();restoring.current=undefined;position.editor=null;position.dragging=false;position.following=false;
      position.target=offset;
      const revision=read.revision;
      frames.current.push(requestAnimationFrame(()=>{
        if(!isCurrent() || geometryPending() || read.revision!==revision || position.target!==offset || !position.measured || position.height<=0)return;
        const target=Math.max(0,Math.min(offset,position.contentHeight-position.height));position.target=target;
        if(!scroll.current)return;
        scroll.current.scrollTo({y:target,animated:false});onLocated?.();
        if(Math.abs(position.offset-target)<=2){position.target=null;position.positioned=true;update();}
      }));
    },
    onLayout: (event: LayoutChangeEvent) => {if(!isCurrent())return;cancelViewed();if(position.positioned && position.target===null && !position.following && !geometryPending())restoring.current ??= saveAnchor();invalidateRows();position.height = event.nativeEvent.layout.height;restoreAnchor();follow();update(); },
    onContentSizeChange: (_width: number, height: number) => {
      if(!isCurrent())return;
      invalidateRows();cancelViewed(); position.atBottom = false; setAtBottom(false);
      position.contentHeight = height; position.measured = true;restoreAnchor();follow();update();
    },
    onScrollBeginDrag: beginDrag, onScrollEndDrag: endDrag, onMomentumScrollBegin: beginDrag, onMomentumScrollEnd: endDrag,
    onScroll: ({ nativeEvent: event }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if(!isCurrent())return;
      const resized = position.height !== event.layoutMeasurement.height || position.contentHeight !== event.contentSize.height;
      const requested = position.target !== null;
      position.offset = event.contentOffset.y; position.height = event.layoutMeasurement.height; position.contentHeight = event.contentSize.height;
      if(resized || geometryPending())invalidateRows();
      if(position.target!==null)position.target=Math.max(0,Math.min(position.target,position.contentHeight-position.height));
      if (position.target !== null && Math.abs(position.offset - position.target) <= 2) {
        position.target = null; position.positioned = true;restoring.current=undefined;
      }
      // Content/keyboard layout events must not erase the owner's follow intent.
      if (position.positioned && !resized && !requested && !position.dragging && position.editor === null)
        position.following = position.contentHeight - position.height - position.offset <= nearBottom;
      update();
      if (resized) follow();
    },
  };
}
