import { View, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Settings from './(tabs)/settings';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { AppProvider, useApp } from '../lib/app-state';
import { LocalDraftProvider } from '../lib/local-drafts';
import { DesktopShell } from '../components/desktop-shell';
export const unstable_settings = { initialRouteName: '(tabs)' };

function Navigation() {
  const { palette, dark } = useApp();
  return <SafeAreaView edges={['top','left','right']} style={{ flex: 1, backgroundColor: palette.background }}>
    <StatusBar style={dark ? 'light' : 'dark'}/>
    <DesktopShell><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
      <Stack.Screen name="(tabs)"/><Stack.Screen name="conversation/[id]"/>
    </Stack></DesktopShell>
  </SafeAreaView>;
}
function SessionNavigation() {
  const { acceptedScope, sessionKey, dark, palette } = useApp();
  if (!acceptedScope) return <SafeAreaView key={sessionKey} style={{ flex: 1, backgroundColor: palette.background }}><StatusBar style={dark ? 'light' : 'dark'}/><Settings/></SafeAreaView>;
  return <LocalDraftProvider key={sessionKey}><Navigation key={sessionKey}/></LocalDraftProvider>;
}
export default function Root() {
  const { height } = useWindowDimensions();
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!loaded && !error) return null;
  return <AppProvider><View style={{ flex: 1, minHeight: 0, maxHeight: process.env.EXPO_OS === 'web' ? height : undefined }}><SessionNavigation/></View></AppProvider>;
}
