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
import { fonts } from '../lib/theme';
export const unstable_settings = { initialRouteName: '(tabs)' };

function Navigation() {
  const { palette, dark } = useApp();
  return <><StatusBar style={dark ? 'light' : 'dark'}/><Stack screenOptions={{
    headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.text,
    headerTitleStyle: { fontFamily: fonts.semibold }, headerShadowVisible: false,
    contentStyle: { backgroundColor: palette.background }, headerBackTitle: 'Chats',
  }}><Stack.Screen name="(tabs)" options={{ headerShown: false }}/><Stack.Screen name="conversation/[id]" options={{ title: 'Conversation' }}/></Stack></>;
}
function SessionNavigation() {
  const { acceptedScope, sessionKey, dark } = useApp();
  if (!acceptedScope) return <SafeAreaView key={sessionKey} style={{ flex: 1 }}><StatusBar style={dark ? 'light' : 'dark'}/><Settings/></SafeAreaView>;
  return <LocalDraftProvider key={sessionKey}><Navigation key={sessionKey}/></LocalDraftProvider>;
}
export default function Root() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!loaded && !error) return null;
  return <AppProvider><SessionNavigation/></AppProvider>;
}
