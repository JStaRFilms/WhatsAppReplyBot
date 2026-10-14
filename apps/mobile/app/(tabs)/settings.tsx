import { useRef, useState } from 'react';
import { z } from 'zod';
import { Text, TextInput, View } from 'react-native';
import { Page, Button } from '../../components/ui';
import { useApp } from '../../lib/app-state';
import { WhatsAppConnection } from '../../components/whatsapp-connection';
import { fonts } from '../../lib/theme';
export default function Settings() {
  const { palette, themeChoice, setTheme, baseUrl, connect, status, snapshot, perform } = useApp();
  const [modelBusy, setModelBusy] = useState(false); const modelLock = useRef(false);
  const changeModelConsent = async () => {
    if (modelLock.current || !snapshot) return; modelLock.current = true; setModelBusy(true);
    try { await perform('/v1/model-consent', z.object({ consent: z.boolean() }), { consent: !snapshot.modelConsent }); }
    finally { modelLock.current = false; setModelBusy(false); }
  };
  const [url, setUrl] = useState(baseUrl); const [token, setToken] = useState('');
  const input = { color: palette.text, fontFamily: fonts.regular, fontSize: 15, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14 };
  return <Page>
    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>Appearance</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>{(['system','light','dark'] as const).map(choice =>
      <Button key={choice} label={choice.charAt(0).toUpperCase()+choice.slice(1)} secondary={themeChoice !== choice} onPress={() => setTheme(choice)}/>)}</View>
    <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 5 }}/>
    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>Windows service</Text>
    <TextInput accessibilityLabel="Service address" autoCapitalize="none" autoCorrect={false} value={url} onChangeText={setUrl} style={input}/>
    <TextInput accessibilityLabel="Service token" autoCapitalize="none" autoCorrect={false} secureTextEntry value={token} onChangeText={setToken}
      placeholder="Service token" placeholderTextColor={palette.muted} style={input}/>
    <Button label={status === 'connecting' ? 'Connecting…' : 'Connect'} disabled={status === 'connecting'} onPress={() => { void connect(url, token || undefined); }}/>
    <Text selectable style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: palette.muted }}>Phone token: .runtime/owner-token.txt on your PC. Use trusted Wi-Fi.</Text>
    <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 5 }}/>
    <WhatsAppConnection/>
    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>Model</Text>
    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: palette.muted }}>
      {snapshot?.model === 'openai/gpt-6-luna' ? 'GPT-6 Luna' : 'Local preview'}
    </Text>
    {snapshot?.model === 'openai/gpt-6-luna' && <>
      <Text style={{ fontFamily: fonts.regular, color: palette.muted, fontSize: 13, lineHeight: 20 }}>Selected chat text, supported images and eligible incoming voice notes go to OpenRouter. Gemini transcribes audio; GPT-6 Luna drafts text. GIFs use sampled frames. API charges apply.</Text>
      <Button label={modelBusy ? 'Applying…' : snapshot.modelConsent ? 'Pause AI' : 'Enable AI'} secondary={snapshot.modelConsent} disabled={modelBusy || status !== 'online'} onPress={() => { void changeModelConsent(); }}/>
    </>}
    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: palette.muted }}>Images, stickers, GIFs and voice notes are supported. View-once, deleted and expired media stay private.</Text>
  </Page>;
}
