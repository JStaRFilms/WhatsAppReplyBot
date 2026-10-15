import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ClipboardList, MessageSquare, Settings, Sparkles } from 'lucide-react-native';
import { useApp } from '../lib/app-state';
import { useWideLayout } from '../lib/responsive';
import { fonts } from '../lib/theme';
import { ChatList } from './chat-list';

const destinations = [
  { label: 'Chats', href: '/(tabs)' as const, path: '/', Icon: MessageSquare },
  { label: 'Review', href: '/(tabs)/review' as const, path: '/review', Icon: ClipboardList },
  { label: 'Assistant', href: '/(tabs)/assistant' as const, path: '/assistant', Icon: Sparkles },
  { label: 'Settings', href: '/(tabs)/settings' as const, path: '/settings', Icon: Settings },
];

export function DesktopShell({ children }: { children: ReactNode }) {
  const wide = useWideLayout();
  const pathname = usePathname();
  const router = useRouter();
  const { palette } = useApp();
  const selectedId = pathname.startsWith('/conversation/') ? decodeURIComponent(pathname.slice('/conversation/'.length)) : undefined;
  return <View testID={wide ? 'desktop-shell' : undefined} style={{ flex: 1, flexDirection: 'row', backgroundColor: palette.background }}>
    {wide && <View accessibilityLabel="Main navigation" style={{ width: 64, paddingVertical: 12, gap: 12, borderRightWidth: 1, borderColor: palette.border }}>
      {destinations.map(({ label, href, path, Icon }) => {
        const selected = path === '/' ? pathname === '/' || !!selectedId : pathname === path;
        return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }}
          onPress={() => router.navigate(href)} style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <View style={{ width: 48, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: selected ? palette.accentSoft : palette.background }}>
            <Icon size={22} color={selected ? palette.accent : palette.muted} strokeWidth={1.8}/>
          </View>
          <Text style={{ maxWidth: '100%', paddingHorizontal: 2, textAlign: 'center', fontFamily: fonts.medium, fontSize: 10, color: selected ? palette.accent : palette.muted }}>{label}</Text>
        </Pressable>;
      })}
    </View>}
    {wide && <View testID="desktop-inbox" style={{ width: 340, borderRightWidth: 1, borderColor: palette.border }}>
      <ChatList active wide selectedId={selectedId}/>
    </View>}
    <View key="detail" testID="desktop-detail" style={{ flex: 1, minWidth: 0 }}>{children}</View>
  </View>;
}
