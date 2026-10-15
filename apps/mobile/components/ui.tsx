import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export function Page({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { palette } = useApp();
  const root = useRef<View>(null); const content = useRef<ScrollView>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (process.env.EXPO_OS === 'web' || !scroll) return;
    let frame: number | undefined;
    const listener = Keyboard.addListener('keyboardDidShow', () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = TextInput.State.currentlyFocusedInput();
        if (focused) content.current?.scrollResponderScrollNativeHandleToKeyboard(focused, 16, true);
      });
    });
    return () => { listener.remove(); if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [scroll]);
  return <View ref={root} onLayout={() => root.current?.measureInWindow((_x, y) => { if (root.current) setKeyboardOffset(y); })}
    style={{ flex: 1, backgroundColor: palette.background }}>
    <KeyboardAvoidingView enabled={process.env.EXPO_OS !== 'web'} keyboardVerticalOffset={keyboardOffset}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <ServiceStrip/><ErrorNotice/>
        {scroll ? <ScrollView ref={content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>{children}</ScrollView> : children}
      </View>
    </KeyboardAvoidingView>
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
