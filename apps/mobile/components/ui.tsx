import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export function Page({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { palette } = useApp();
  return <View style={{ flex: 1, backgroundColor: palette.background }}>
    <View style={{ flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
      <ServiceStrip/><ErrorNotice/>
      {scroll ? <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>{children}</ScrollView> : children}
    </View>
  </View>;
}
export function ServiceStrip() {
  const { status, palette, snapshot } = useApp();
  return <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>
      {status === 'online' && snapshot && !snapshot.demo ? 'WhatsApp '+snapshot.connection+' · AI '+(snapshot.modelConsent ? 'enabled' : 'paused') : status === 'online' ? snapshot?.model === 'openai/gpt-6-luna' ? 'Preview · AI '+(snapshot.modelConsent ? 'enabled' : 'paused') : 'Preview · WhatsApp not linked' : status === 'connecting' ? 'Connecting…' : 'Service offline'}
    </Text>
  </View>;
}
export function ErrorNotice() {
  const { error, clearError, palette } = useApp();
  if (!error) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={clearError} style={{ padding: 14, borderBottomWidth: 1, borderColor: palette.border }}>
    <Text selectable style={{ fontFamily: fonts.regular, color: palette.danger, fontSize: 14 }}>{error}</Text>
  </Pressable>;
}
export function Button({ label, onPress, secondary = false, disabled = false, style }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  const { palette } = useApp();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[{ paddingHorizontal: 17, paddingVertical: 12, minHeight: 44, borderRadius: 22,
      backgroundColor: secondary ? palette.surface : palette.accent, opacity: disabled ? 0.45 : 1, alignItems: 'center' }, style]}>
    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: secondary ? palette.text : palette.accentText }}>{label}</Text>
  </Pressable>;
}
export function EmptyConnection() {
  const { connect, baseUrl, palette, status } = useApp();
  return <View style={{ paddingVertical: 28, gap: 16 }}>
    <Text style={{ color: palette.text, fontFamily: fonts.semibold, fontSize: 20 }}>Connect to your PC</Text>
    <Text selectable style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 }}>Enter your PC address and service token in Settings.</Text>
    <Button label={status === 'connecting' ? 'Connecting…' : 'Connect'} disabled={status === 'connecting'} onPress={() => { void connect(baseUrl); }}/>
  </View>;
}
