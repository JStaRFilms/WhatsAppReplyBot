import { useState } from 'react';
import { Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import { useWideLayout } from '../../lib/responsive';
import { Tabs } from 'expo-router';
import { MessageSquare, ClipboardList, Sparkles, Settings } from 'lucide-react-native';
import { useApp } from '../../lib/app-state';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../../lib/theme';
export default function TabLayout() {
  const { palette } = useApp();
  const insets = useSafeAreaInsets();
  const wide = useWideLayout();
  const { fontScale } = useWindowDimensions();
  const [labelHeights, setLabelHeights] = useState<Record<string, number>>({});
  const barHeight = Math.max(64, 44 + Math.max(16 * fontScale, ...Object.values(labelHeights)));
  const tabLabel = (label: string, color: ColorValue) => <Text onLayout={event => {
    const height = event.nativeEvent.layout.height;
    setLabelHeights(previous => previous[label] === height ? previous : { ...previous, [label]: height });
  }} style={{ maxWidth: '100%', flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center', color }}>{label}</Text>;
  const tabIcon = (Icon: typeof MessageSquare, color: ColorValue, focused: boolean) => <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? palette.accentSoft : palette.background }}><Icon color={color} size={23} strokeWidth={1.8}/></View>;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: palette.accent, tabBarInactiveTintColor: palette.muted,
    tabBarStyle: { display: wide ? 'none' : 'flex', backgroundColor: palette.background, borderTopColor: palette.border, height: barHeight + insets.bottom, paddingTop: 4, paddingBottom: 4 + insets.bottom },
    tabBarItemStyle: { minHeight: barHeight - 8 },
    tabBarLabelPosition: 'below-icon',
    tabBarAllowFontScaling: true,
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Otherme', tabBarLabel: ({ color }) => tabLabel('Chats', color), tabBarIcon: ({ color, focused }) => tabIcon(MessageSquare, color, focused) }}/>
    <Tabs.Screen name="review" options={{ title: 'Review', tabBarLabel: ({ color }) => tabLabel('Review', color), tabBarIcon: ({ color, focused }) => tabIcon(ClipboardList, color, focused) }}/>
    <Tabs.Screen name="assistant" options={{ title: 'Assistant', tabBarLabel: ({ color }) => tabLabel('Assistant', color), tabBarIcon: ({ color, focused }) => tabIcon(Sparkles, color, focused) }}/>
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: ({ color }) => tabLabel('Settings', color), tabBarIcon: ({ color, focused }) => tabIcon(Settings, color, focused) }}/>
  </Tabs>;
}
