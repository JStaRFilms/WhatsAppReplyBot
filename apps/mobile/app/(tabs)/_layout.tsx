import { Tabs } from 'expo-router';
import { MessageSquare, ClipboardList, Sparkles, Settings } from 'lucide-react-native';
import { useApp } from '../../lib/app-state';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../../lib/theme';
export default function TabLayout() {
  const { palette } = useApp();
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.text,
    headerShadowVisible: false, headerTitleAlign: 'left',
    headerTitleStyle: { fontFamily: fonts.bold, fontSize: 27 },
    tabBarActiveTintColor: palette.accent, tabBarInactiveTintColor: palette.muted,
    tabBarStyle: { backgroundColor: palette.background, borderTopColor: palette.border, height: 80 + insets.bottom, paddingTop: 10, paddingBottom: 20 + insets.bottom },
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Otherme', tabBarLabel: 'Chats', tabBarIcon: ({ color }) => <MessageSquare color={color} size={23} strokeWidth={1.8}/> }}/>
    <Tabs.Screen name="review" options={{ title: 'Review', tabBarIcon: ({ color }) => <ClipboardList color={color} size={23} strokeWidth={1.8}/> }}/>
    <Tabs.Screen name="assistant" options={{ title: 'Assistant', tabBarIcon: ({ color }) => <Sparkles color={color} size={23} strokeWidth={1.8}/> }}/>
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Settings color={color} size={23} strokeWidth={1.8}/> }}/>
  </Tabs>;
}
