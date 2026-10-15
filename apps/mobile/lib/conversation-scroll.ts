import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import type { HistoryCache } from './history-cache';

const savedPositions = new WeakMap<HistoryCache, Map<string, { offset: number; atBottom: boolean }>>();
type Position = {
  offset: number; initialOffset: number; following: boolean; atBottom: boolean;
  height: number; contentHeight: number; measured: boolean; positioned: boolean; dragging: boolean;
  target: number | null; editor: number | null;
};
const nearBottom = 80;
const visibleBottom = 24;

export function useConversationScroll(history: HistoryCache, id: string, loaded: boolean, cancelViewed: () => void) {
  const scroll = useRef<ScrollView>(null);
  const position = useMemo<Position>(() => {
    const saved = savedPositions.get(history)?.get(id);
    return { offset: saved?.offset ?? 0, initialOffset: saved?.offset ?? 0, following: saved?.atBottom ?? true,
      atBottom: false, height: 0, contentHeight: 0, measured: false, positioned: false, dragging: false,
      target: null, editor: null };
  }, [history, id]);
  const current = useRef<typeof position | null>(position); current.current = position;
  const frames = useRef<number[]>([]);
  const [positioned, setPositioned] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [showLatest, setShowLatest] = useState(false);
  const cancelFrames = useCallback(() => { frames.current.forEach(cancelAnimationFrame); frames.current = []; }, []);
  const update = () => {
    position.atBottom = position.contentHeight - position.height - position.offset <= visibleBottom;
    setPositioned(position.positioned); setAtBottom(position.atBottom);
    setShowLatest(position.positioned && !position.following && !position.atBottom);
    if (!position.atBottom) cancelViewed();
    if (position.positioned) {
      let saved = savedPositions.get(history);
      if (!saved) { saved = new Map(); savedPositions.set(history, saved); }
      saved.set(id, { offset: position.offset, atBottom: position.contentHeight - position.height - position.offset <= nearBottom });
    }
  };
  const follow = () => {
    if (current.current !== position || !loaded || !position.measured || position.height <= 0 || position.dragging) return;
    if (position.editor !== null) {
      const editor = position.editor;
      cancelFrames();
      frames.current.push(requestAnimationFrame(() => {
        if (current.current === position && position.editor === editor)
          scroll.current?.scrollResponderScrollNativeHandleToKeyboard(editor, 16, true);
      }));
      return;
    }
    if (position.positioned && !position.following) return;
    const bottom = Math.max(0, position.contentHeight - position.height);
    position.target = !position.positioned && !position.following ? Math.min(position.initialOffset, bottom) : bottom;
    cancelFrames();
    frames.current.push(requestAnimationFrame(() => {
      if (current.current !== position || position.target === null) return;
      const target = position.target;
      scroll.current?.scrollTo({ y: target, animated: false });
      // A request is not proof that the newest message was actually displayed.
      if (Math.abs(position.offset - target) <= 2) {
        position.target = null; position.positioned = true; update();
      }
    }));
  };
  useLayoutEffect(() => {
    current.current = position;
    setPositioned(false); setAtBottom(false); setShowLatest(false);
    return () => { if (current.current === position) current.current = null; cancelFrames(); };
  }, [position, cancelFrames]);
  const latest = () => {
    if (current.current !== position) return;
    position.editor = null;
    position.dragging = false; position.following = true; setShowLatest(false); cancelViewed(); follow();
  };
  const editorFocus = useCallback((target: number | null) => {
    if (current.current !== position) return;
    const previous = position.editor; position.editor = target;
    if (target !== null) {
      position.following = false; position.target = null; cancelViewed();
    } else if (previous !== null && position.target === null) {
      position.following = position.contentHeight - position.height - position.offset <= nearBottom;
    }
    follow(); update();
  }, [position, loaded, cancelViewed, cancelFrames]);
  const beginDrag = () => { cancelFrames(); position.target = null; position.dragging = true; position.following = false; cancelViewed(); update(); };
  const endDrag = () => {
    position.dragging = false;
    position.following = position.editor === null && position.contentHeight - position.height - position.offset <= nearBottom;
    update();
  };
  return { scroll, position, positioned, atBottom, showLatest, latest, editorFocus,
    locate: (offset: number) => {
      if(current.current!==position)return;
      cancelFrames();cancelViewed();position.editor=null;position.dragging=false;position.following=false;
      position.target=offset;scroll.current?.scrollTo({y:offset,animated:false});
    },
    onLayout: (event: LayoutChangeEvent) => { position.height = event.nativeEvent.layout.height; follow(); },
    onContentSizeChange: (_width: number, height: number) => {
      cancelViewed(); position.atBottom = false; setAtBottom(false);
      position.contentHeight = height; position.measured = true; follow();
    },
    onScrollBeginDrag: beginDrag, onScrollEndDrag: endDrag, onMomentumScrollBegin: beginDrag, onMomentumScrollEnd: endDrag,
    onScroll: ({ nativeEvent: event }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const resized = position.height !== event.layoutMeasurement.height || position.contentHeight !== event.contentSize.height;
      const requested = position.target !== null;
      position.offset = event.contentOffset.y; position.height = event.layoutMeasurement.height; position.contentHeight = event.contentSize.height;
      if (position.target !== null && Math.abs(position.offset - position.target) <= 2) {
        position.target = null; position.positioned = true;
      }
      // Content/keyboard layout events must not erase the owner's follow intent.
      if (position.positioned && !resized && !requested && !position.dragging && position.editor === null)
        position.following = position.contentHeight - position.height - position.offset <= nearBottom;
      update();
      if (resized) follow();
    },
  };
}
