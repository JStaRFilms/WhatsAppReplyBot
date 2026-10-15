import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Text, TextInput, View } from 'react-native';
import { Page, Button } from '../../components/ui';
import { useApp } from '../../lib/app-state';
import { WhatsAppConnection } from '../../components/whatsapp-connection';
import { ProfileControls } from '../../components/profile-controls';
import { fonts } from '../../lib/theme';
export default function Settings() {
  const { palette, themeChoice, setTheme, baseUrl, connect, status, pcStatus, hasSavedCredential, snapshot, perform } = useApp();
  const [modelBusy, setModelBusy] = useState(false); const modelLock = useRef(false);
  const changeModelConsent = async () => {
    if (modelLock.current || !snapshot) return; modelLock.current = true; setModelBusy(true);
    try { await perform('/v1/model-consent', z.object({ consent: z.boolean() }), { consent: !snapshot.modelConsent }); }
    finally { modelLock.current = false; setModelBusy(false); }
  };
  const [url, setUrl] = useState(baseUrl); const [token, setToken] = useState('');
  useEffect(()=>setUrl(baseUrl),[baseUrl]);
  const sameAddress=url.trim().replace(/\/$/,'')===baseUrl;
  const connected=pcStatus==='authenticated' && sameAddress && !token.trim();
  const input = { color: palette.text, fontFamily: fonts.regular, fontSize: 15, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14 };
  const section = { gap: 12, paddingBottom: 20, borderBottomWidth: 1, borderColor: palette.border };
  return <Page title="Settings">
    <View style={section}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>PC service</Text>
    <Text style={{fontFamily:fonts.regular,fontSize:13,lineHeight:20,color:palette.muted}}>Windows keeps working while this app is closed. Returning refreshes its current status.</Text>
    <TextInput accessibilityLabel="Service address" autoCapitalize="none" autoCorrect={false} value={url} onChangeText={setUrl} style={input}/>
    <TextInput accessibilityLabel="Service token" autoCapitalize="none" autoCorrect={false} secureTextEntry value={token} onChangeText={setToken}
      placeholder={hasSavedCredential && sameAddress?'Saved service token, leave blank to reuse':'Service token'} placeholderTextColor={palette.muted} style={input}/>
    <Button label={pcStatus==='connecting'?'Connecting to PC…':connected?'Connected to PC':pcStatus==='auth-required'?'Update PC connection':hasSavedCredential && sameAddress?'Reconnect to PC':'Connect to PC'}
      disabled={pcStatus==='connecting' || connected} onPress={() => { void connect(url, token || undefined).finally(()=>setToken('')); }}/>
    <Text selectable style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: palette.muted }}>{pcStatus==='auth-required'?'The saved service token was not accepted. Check the service address and token on your PC.':hasSavedCredential?'The saved service token is reused. Linking WhatsApp does not need it again.':'Enter the service token from your PC once. Use trusted Wi-Fi.'}</Text>
    </View>
    <View style={section}><ProfileControls/></View>
    <View style={section}><WhatsAppConnection/></View>
    <View style={section}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>Assistant and data</Text>
    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: palette.muted }}>
      {snapshot?.model === 'openai/gpt-6-luna' ? 'GPT-6 Luna' : 'Local preview'}
    </Text>
    {snapshot?.model === 'openai/gpt-6-luna' && <>
      <Text style={{ fontFamily: fonts.regular, color: palette.muted, fontSize: 13, lineHeight: 20 }}>Selected chat text, supported images and eligible incoming voice notes go to OpenRouter. Gemini transcribes audio; GPT-6 Luna drafts text. GIFs use sampled frames. API charges apply.</Text>
      <Button label={modelBusy ? 'Applying…' : snapshot.modelConsent ? 'Pause AI' : 'Enable AI'} secondary={snapshot.modelConsent} disabled={modelBusy || status !== 'online'} onPress={() => { void changeModelConsent(); }}/>
    </>}
    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: palette.muted }}>Images, stickers, GIFs and voice notes are supported. View-once, deleted and expired media stay private.</Text>
    </View>
    <View style={section}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>Appearance</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['system','light','dark'] as const).map(choice =>
      <Button key={choice} label={choice.charAt(0).toUpperCase()+choice.slice(1)} secondary={themeChoice !== choice} onPress={() => setTheme(choice)}/>)}</View></View>
    <View style={{ gap: 6, paddingVertical: 8 }}>
      <Text style={{ color: palette.text, fontFamily: fonts.semibold, fontSize: 16 }}>Otherme</Text>
      <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 13 }}>By JStar Studios</Text>
      <Text selectable style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 13 }}>jstarstudios.com</Text>
    </View>
  </Page>;
}
