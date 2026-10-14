import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { z } from 'zod';
import { useApp } from '../lib/app-state';
import { Button } from './ui';
import { fonts } from '../lib/theme';
const Connection = z.object({ state: z.enum(['disconnected','connecting','qr','connected','error']), qr: z.string().nullable(), error: z.string().nullable(), historyMessages: z.number() });
const labels = { disconnected: 'Not linked', connecting: 'Connecting…', qr: 'Scan QR', connected: 'Connected', error: 'Connection failed' };
export function WhatsAppConnection() {
  const { snapshot, client, perform, palette, status, reportError } = useApp();
  const [connection, setConnection] = useState<z.infer<typeof Connection> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (status !== 'online' || snapshot?.demo !== false) return;
    let active = true;
    const load = async () => {
      try { const data = await client.request('/v1/whatsapp', Connection); if (active) setConnection(data); }
      catch (e) { if (active) reportError(e instanceof Error ? e.message : 'Could not load pairing status.'); }
    };
    void load(); const timer = setInterval(() => { void load(); }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [client, status, snapshot?.demo]);
  if (!snapshot || snapshot.demo) return null;
  return <View style={{ gap: 12 }}>
    <Text style={{ color: palette.text, fontFamily: fonts.semibold, fontSize: 16 }}>WhatsApp</Text>
    <Text style={{ color: palette.muted, fontFamily: fonts.regular }}>{connection ? labels[connection.state] : 'Loading…'}</Text>
    {!!connection?.error && <Text style={{ color: palette.danger, fontFamily: fonts.regular }}>{connection.error}</Text>}
    {connection?.qr && <>
      <Image alt="WhatsApp pairing QR" source={{ uri: connection.qr }} contentFit="contain" style={{ width: 280, height: 280, alignSelf: 'center', backgroundColor: '#ffffff' }}/>
      <Text style={{ color: palette.muted, fontFamily: fonts.regular, lineHeight: 20 }}>WhatsApp → Linked devices → Link a device. Scan this QR.</Text>
    </>}
    <Button label={connection?.state === 'connected' ? 'Disconnect WhatsApp' : 'Connect WhatsApp'} disabled={busy || connection?.state === 'connecting'}
      secondary={connection?.state === 'connected'} onPress={() => {
        setBusy(true);
        const connected = connection?.state === 'connected';
        const request = connected ? perform('/v1/whatsapp/disconnect', z.object({ disconnected: z.boolean() }), {})
          : perform('/v1/whatsapp/connect', Connection, { confirm: true });
        void request.finally(() => { setBusy(false); });
      }}/>
  </View>;
}
