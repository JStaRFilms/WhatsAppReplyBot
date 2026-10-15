const test = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes, label } = require('./render-harness.cjs');

const palette = { background: '#111418', text: '#f3f5f7', muted: '#a2aab4', border: '#30363e', accent: '#7aa9ff', accentSoft: '#1d2a3c' };

test('wide composition is browser-only and collapses at the effective 900px breakpoint', () => {
  for (const os of ['web', 'android', 'ios']) for (const width of [320, 360, 390, 899, 900, 1280]) {
    const { useWideLayout } = load('lib/responsive.ts', { 'react-native': { useWindowDimensions: () => ({ width }) } }, { process: { env: { EXPO_OS: os } } });
    assert.equal(useWideLayout(), os === 'web' && width >= 900);
  }
});

test('wide shell renders one inbox and the existing detail, with real grouped-route navigation', () => {
  let wide = true, pathname = '/conversation/chat-0';
  const navigations = [];
  const { DesktopShell } = load('components/desktop-shell.tsx', {
    'react-native': { Pressable: 'pressable', Text: 'text', View: 'view' },
    'expo-router': { usePathname: () => pathname, useRouter: () => ({ navigate: href => navigations.push(href) }) },
    'lucide-react-native': { ClipboardList: 'review', MessageSquare: 'chats', Settings: 'settings', Sparkles: 'assistant' },
    '../lib/app-state': { useApp: () => ({ palette }) }, '../lib/responsive': { useWideLayout: () => wide },
    '../lib/theme': { fonts: {} }, './chat-list': { ChatList: 'inbox' },
  });
  const detail = { type: 'routed-detail' };
  const render = () => DesktopShell({ children: detail });
  let tree = render();
  assert.equal(nodes(tree).filter(n => n.type === 'inbox').length, 1);
  assert.equal(nodes(tree).filter(n => n.type === 'routed-detail').length, 1);
  assert.equal(nodes(tree).find(n => n.type === 'inbox').props.selectedId, 'chat-0');
  assert.equal(label(tree, 'Chats').props.accessibilityState.selected, true);
  label(tree, 'Settings').props.onPress();
  assert.deepEqual(navigations, ['/(tabs)/settings']);
  pathname = '/settings'; tree = render();
  assert.equal(label(tree, 'Settings').props.accessibilityState.selected, true);
  assert.equal(nodes(tree).find(n => n.type === 'inbox').props.selectedId, undefined);
  const detailFrame = nodes(tree).find(n => n.props?.testID === 'desktop-detail');
  wide = false;
  const narrow = render();
  assert.equal(nodes(narrow).filter(n => n.type === 'inbox').length, 0);
  const narrowDetail = nodes(narrow).find(n => n.props?.testID === 'desktop-detail');
  assert.equal(narrowDetail.key, detailFrame.key);
  assert.equal(narrowDetail.props.children, detail);
});

test('Page puts status below its toolbar and owns only the requested bottom inset', () => {
  for (const bottomInset of [false, true]) {
    const h = hooks();
    const { Page } = load('components/ui.tsx', {
      react: h.react, 'react-native': { View: 'view', Text: 'text', KeyboardAvoidingView: 'keyboard', ScrollView: 'scroll' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
      '../lib/app-state': { useApp: () => ({ palette }) }, '../lib/theme': { fonts: {} },
    });
    const tree = h.render(() => Page({ children: 'history', title: 'Otherme', bottomInset }));
    assert.equal(tree.props.style.paddingBottom, bottomInset ? 24 : 0);
    const content = nodes(tree).find(n => n.props?.style?.width === '100%');
    assert.equal(content.props.style.maxWidth, undefined);
    assert.equal(content.props.children[0].props.children.props.accessibilityRole, 'header');
    assert.equal(content.props.children[1].type.name, 'ServiceStrip');
  }
});
