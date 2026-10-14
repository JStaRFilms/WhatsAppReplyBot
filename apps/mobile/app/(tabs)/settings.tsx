import { useState } from 'react';
import { z } from 'zod';
import { Text, TextInput, View } from 'react-native';
import { Page, Button } from '../../components/ui';
import { useApp } from '../../lib/app-state';
import { fonts } from '../../lib/theme';
export default function Settings() {
  const { palette, themeChoice, setTheme, baseUrl, connect, status, snapshot, perform } = useApp();
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
      placeholder="Service token for phone connection" placeholderTextColor={palette.muted} style={input}/>
    <Button label={status === 'connecting' ? 'Connecting…' : token ? 'Connect service' : 'Connect local demo'} disabled={status === 'connecting'} onPress={() => { void connect(url, token || undefined); }}/>
    <Text selectable style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: palette.muted }}>The service token is in .runtime/owner-token.txt on your computer. It is not your OpenRouter key. Native-phone access needs a reachable service address.</Text>
    <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 5 }}/>
    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>Model and WhatsApp</Text>
    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: palette.muted }}>
      {snapshot?.model === 'openai/gpt-6-luna' ? 'GPT-6 Luna is configured. New text drafts can use OpenRouter after consent.' : 'Local demo model is active. To test GPT-6 Luna, configure the key on the Windows backend and start its explicit OpenRouter command.'}
    </Text>
    {snapshot?.model === 'openai/gpt-6-luna' && <>
      <Text style={{ fontFamily: fonts.regular, color: palette.muted, fontSize: 13, lineHeight: 20 }}>Enabling this sends selected text context to OpenRouter and incurs model charges. Keys stay on the backend.</Text>
      <Button label={snapshot.modelConsent ? 'Disable OpenRouter calls' : 'Allow OpenRouter text drafts'} secondary={snapshot.modelConsent} onPress={() => { void perform('/v1/model-consent', z.object({ consent: z.boolean() }), { consent: !snapshot.modelConsent }); }}/>
    </>}
    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: palette.muted }}>Real WhatsApp pairing, real sends and live media encoding are not enabled yet.</Text>
  </Page>;
}
