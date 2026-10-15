import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export function Page({ children, scroll = true, title, header, bottomInset = false }: {
  children: ReactNode; scroll?: boolean; title?: string; header?: ReactNode; bottomInset?: boolean;
}) {
  const { palette } = useApp();
  const insets = useSafeAreaInsets();
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
    style={{ flex: 1, minHeight: 0, backgroundColor: palette.background, paddingBottom: bottomInset ? insets.bottom : 0 }}>
    <KeyboardAvoidingView enabled={process.env.EXPO_OS !== 'web'} keyboardVerticalOffset={keyboardOffset}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={{ flex: 1, minHeight: 0, width: '100%' }}>
        {header ?? (title ? <View style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' }}>
          <Text accessibilityRole="header" style={{ color: palette.text, fontFamily: fonts.bold, fontSize: 26 }}>{title}</Text>
        </View> : null)}
        <ServiceStrip/><ErrorNotice/>
        {scroll ? <ScrollView ref={content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1 }} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 16 }}>{children}</ScrollView> : children}
      </View>
    </KeyboardAvoidingView>
  </View>;
}
export function ServiceStrip() {
  const { pcStatus, palette, snapshot, snapshotFresh, acceptedScope, profileBusy } = useApp();
  const cached=snapshot && !snapshotFresh?' · Cached data':'';
  const label=pcStatus==='connecting'?'Refreshing PC'+cached
    :pcStatus==='auth-required'?'PC authentication needed'+cached
    :pcStatus!=='authenticated'?'PC unavailable'+cached
    :!acceptedScope?'Connected to PC · '+(profileBusy?'Profile change pending':'Review profile to continue')
    :!snapshotFresh?'Connected to PC · Cached data'
    :snapshot?.demo?'Connected to PC · Preview · WhatsApp not linked · AI '+(snapshot.modelConsent?'enabled':'paused')
    :'Connected to PC · WhatsApp '+(snapshot?.connection ?? 'unknown')+' · AI '+(snapshot?.modelConsent?'enabled':'paused');
  return <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
    <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>
      {label}
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
    style={[{ paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, borderRadius: 24, justifyContent: 'center',
      backgroundColor: secondary ? palette.surface : palette.accent, opacity: disabled ? 0.45 : 1, alignItems: 'center' }, style]}>
    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center', color: secondary ? palette.text : palette.accentText }}>{label}</Text>
  </Pressable>;
}
export function EmptyConnection() {
  const { connect, baseUrl, palette, pcStatus, hasSavedCredential } = useApp();
  return <View style={{ paddingVertical: 28, gap: 16 }}>
    <Text style={{ color: palette.text, fontFamily: fonts.semibold, fontSize: 20 }}>Connect to your PC</Text>
    <Text selectable style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 }}>{hasSavedCredential?'Reconnect using the saved PC connection. WhatsApp linking is separate.':'Enter your PC address and service token in Settings.'}</Text>
    <Button label={pcStatus === 'connecting' ? 'Connecting to PC…' : pcStatus==='authenticated'?'Connected to PC':'Reconnect to PC'} disabled={pcStatus === 'connecting' || pcStatus==='authenticated'} onPress={() => { void connect(baseUrl); }}/>
  </View>;
}
