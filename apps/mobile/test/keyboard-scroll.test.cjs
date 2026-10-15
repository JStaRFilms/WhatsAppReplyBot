const test = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes } = require('./render-harness.cjs');

function scrollFixture(history = {}, id = 'chat') {
  const h = hooks(), frames = new Map(), moves = [], editors = [];
  let serial = 0, cancelledViews = 0, dismissed = 0, loaded = true;
  const module = load('lib/conversation-scroll.ts', { react: h.react, 'react-native': { Keyboard: { dismiss() { dismissed++; } } } }, {
    requestAnimationFrame: fn => { frames.set(++serial, fn); return serial; }, cancelAnimationFrame: key => frames.delete(key),
  });
  const cancelViewed = () => { cancelledViews++; };
  const render = () => h.render(() => module.useConversationScroll(history, id, loaded, cancelViewed));
  let value = render(); const cleanup = h.flush();
  value.scroll.current = { scrollTo: args => moves.push(args.y), scrollResponderScrollNativeHandleToKeyboard: target => editors.push(target) };
  const frame = () => { const next = [...frames.values()]; frames.clear(); next.forEach(fn => fn()); };
  const scrolled = (offset, height = 400, contentHeight = 1000) => render().onScroll({ nativeEvent: {
    contentOffset: { y: offset }, layoutMeasurement: { height }, contentSize: { height: contentHeight },
  } });
  const layout = (height = 400, contentHeight = 1000) => {
    value = render(); value.onLayout({ nativeEvent: { layout: { height } } }); value.onContentSizeChange(320, contentHeight); frame();
  };
  return { render, layout, scrolled, frame, moves, editors, cleanup, h,
    scope: (nextHistory, nextId = id) => { history = nextHistory; id = nextId; },
    loaded: value => { loaded = value; }, counts: () => ({ cancelledViews, dismissed }) };
}

test('initial/latest scrolls require actual viewport acknowledgment; content growth and keyboard resize retain follow intent', () => {
  const f = scrollFixture(); f.layout();
  assert.equal(f.moves.at(-1), 600); assert.equal(f.render().positioned, false); assert.equal(f.render().atBottom, false);
  f.scrolled(600); assert.equal(f.render().positioned, true); assert.equal(f.render().atBottom, true);
  // Native scroll can report the new content size before the size-change callback.
  f.scrolled(600, 400, 1200); f.render().onContentSizeChange(320, 1200); f.frame();
  assert.equal(f.moves.at(-1), 800); assert.equal(f.render().atBottom, false);
  f.scrolled(800, 400, 1200); assert.equal(f.render().atBottom, true);
  f.render().onLayout({ nativeEvent: { layout: { height: 200 } } });
  f.scrolled(800, 200, 1200); f.frame(); assert.equal(f.moves.at(-1), 1000);
  assert.equal(f.render().atBottom, false); f.scrolled(1000, 200, 1200); assert.equal(f.render().atBottom, true);
});

test('history browsing is not pulled by incoming/media layout changes; Latest restores following', () => {
  const f = scrollFixture(); f.layout(); f.scrolled(600);
  f.render().onScrollBeginDrag(); f.scrolled(100);
  assert.equal(f.render().showLatest, true); const before = f.moves.length;
  f.render().onContentSizeChange(320, 1300); f.scrolled(100, 400, 1300); f.frame();
  assert.equal(f.moves.length, before); assert.equal(f.render().position.offset, 100);
  f.render().latest(); f.frame(); assert.equal(f.moves.at(-1), 900);
  assert.equal(f.render().atBottom, false); f.scrolled(900, 400, 1300);
  assert.equal(f.render().showLatest, false); assert.equal(f.render().atBottom, true);
  f.render().onContentSizeChange(320, 1400); f.frame(); assert.equal(f.moves.at(-1), 1000);
});

test('near-bottom gestures resume following, but dragging cancels a pending programmatic jump', () => {
  const f = scrollFixture(); f.layout(); f.scrolled(600); f.render().onScrollBeginDrag(); f.scrolled(100);
  f.scrolled(540); f.render().onScrollEndDrag(); assert.equal(f.render().showLatest, false);
  f.render().onContentSizeChange(320, 1200); f.render().onScrollBeginDrag(); f.scrolled(200, 400, 1200);
  const before = f.moves.length; f.frame(); assert.equal(f.moves.length, before);
  assert.equal(f.render().showLatest, true);
});

test('content arriving after drag begins cannot restart following before the first drag scroll or during momentum', () => {
  const f = scrollFixture(); f.layout(); f.scrolled(600); const before = f.moves.length;
  f.render().onScrollBeginDrag(); f.render().onContentSizeChange(320, 1200); f.frame();
  assert.equal(f.moves.length, before);
  f.scrolled(580, 400, 1300); f.frame(); assert.equal(f.moves.length, before);
  f.render().onScrollEndDrag(); f.render().onMomentumScrollBegin();
  f.render().onContentSizeChange(320, 1400); f.scrolled(200, 400, 1400); f.frame();
  assert.equal(f.moves.length, before); f.render().onMomentumScrollEnd(); assert.equal(f.render().showLatest, true);
});

test('draft editor stays visible through keyboard and text layout changes without following new messages', () => {
  const f = scrollFixture(); f.layout(); f.scrolled(600);
  f.render().editorFocus(42); f.frame(); assert.deepEqual(f.editors, [42]);
  f.render().onLayout({ nativeEvent: { layout: { height: 200 } } });
  f.render().onContentSizeChange(320, 1400); const before = f.moves.length; f.frame();
  assert.equal(f.editors.at(-1), 42); assert.equal(f.moves.length, before);
  f.render().latest(); f.frame(); assert.equal(f.counts().dismissed, 1); assert.equal(f.moves.at(-1), 1200);
});

test('saved position is chat/history scoped, not shared across profile caches; old callbacks cannot scroll a new scope', () => {
  const history = {}, f = scrollFixture(history); f.layout(); f.scrolled(600); f.render().onScrollBeginDrag(); f.scrolled(123);
  const oldLatest = f.render().latest;
  f.scope(history, 'other-chat'); f.render(); f.h.flush(); f.layout(); assert.equal(f.moves.at(-1), 600);
  f.scope(history, 'chat'); f.render(); f.h.flush(); f.layout(); assert.equal(f.moves.at(-1), 123);
  f.scope({}); f.render(); f.h.flush(); f.layout(); assert.equal(f.moves.at(-1), 600);
  const count = f.moves.length; oldLatest(); f.frame(); assert.equal(f.moves.length, count);
});

test('Page avoids native keyboard using measured screen offset and reveals focused review inputs after keyboard show', () => {
  for (const os of ['android', 'ios', 'web']) {
    const h = hooks(), frames = new Map(), listeners = new Map(), reveals = []; let serial = 0;
    const focused = {};
    const native = { View: 'view', ScrollView: 'scroll', KeyboardAvoidingView: 'keyboard', Text: 'text', Pressable: 'pressable',
      TextInput: { State: { currentlyFocusedInput: () => focused } }, Keyboard: { addListener: (name, fn) => {
        listeners.set(name, fn); return { remove: () => listeners.delete(name) };
      } } };
    const module = load('components/ui.tsx', { react: h.react, 'react-native': native,
      '../lib/app-state': { useApp: () => ({ palette: {} }) }, '../lib/theme': { fonts: {} } }, {
      process: { env: { EXPO_OS: os } }, requestAnimationFrame: fn => { frames.set(++serial, fn); return serial; }, cancelAnimationFrame: key => frames.delete(key),
    });
    const render = () => h.render(() => module.Page({ children: 'editor' }));
    let tree = render(); const cleanup = h.flush();
    tree.props.ref.current = { measureInWindow: fn => fn(0, 92) }; tree.props.onLayout(); tree = render();
    const keyboard = nodes(tree).find(node => node.type === 'keyboard');
    assert.equal(keyboard.props.keyboardVerticalOffset, 92); assert.equal(keyboard.props.enabled, os !== 'web');
    assert.equal(keyboard.props.behavior, os === 'ios' ? 'padding' : 'height');
    const content = nodes(tree).find(node => node.type === 'scroll');
    assert.equal(content.props.keyboardShouldPersistTaps, 'handled');
    content.props.ref.current = { scrollResponderScrollNativeHandleToKeyboard: (...args) => reveals.push(args) };
    if (os === 'web') assert.equal(listeners.size, 0);
    else {
      listeners.get('keyboardDidShow')(); [...frames.values()].forEach(fn => fn()); frames.clear();
      assert.equal(reveals.length, 1); assert.equal(reveals[0][0], focused);
      listeners.get('keyboardDidShow')(); cleanup.forEach(fn => fn());
      assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
    }
  }
});
