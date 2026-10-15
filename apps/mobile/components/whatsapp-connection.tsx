import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { z } from 'zod';
import { PcDisplay } from '@replybot/core/api';
import { useApp } from '../lib/app-state';
import { randomUUID } from '../lib/uuid';
import { Button } from './ui';
import { fonts } from '../lib/theme';
const Connection = z.object({ state: z.enum(['disconnected','connecting','qr','connected','error']), qr: z.string().nullable(), error: z.string().nullable(), historyMessages: z.number(), pcDisplay: PcDisplay.optional() });
const labels = { disconnected: 'Not linked', connecting: 'Linking…', qr: 'Waiting for QR scan', connected: 'Linked', error: 'Link failed' };
export function WhatsAppConnection() {
  const { snapshot, client, perform, palette, status, discovery } = useApp();
  const [observed, setObserved] = useState<{client:typeof client;data:z.infer<typeof Connection>} | null>(null);
  const [readError,setReadError]=useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollRevision,setPollRevision]=useState(0);
  const [disconnect,setDisconnect]=useState(false);
  const [displayRequest,setDisplayRequest]=useState<string | null>(null);
  const [showQr,setShowQr]=useState(false);
  const lock=useRef(false);
  const read=useRef<AbortController | null>(null);
  const connection=observed?.client===client?observed.data:null;
  useEffect(()=>{
    setObserved(null);setReadError(null);setDisplayRequest(null);setShowQr(false);setDisconnect(false);setBusy(false);lock.current=false;
  },[client]);
  useEffect(() => {
    if (status !== 'online' || snapshot?.demo !== false) return;
    const abort=new AbortController();let loading=false;
    read.current=abort;
    const load = async () => {
      if(loading || abort.signal.aborted)return;
      loading=true;
      try {
        const data = await client.request('/v1/whatsapp', Connection,undefined,abort.signal);
        if (!abort.signal.aborted){setObserved({client,data});setReadError(null);}
      } catch (reason) {
        if (!abort.signal.aborted)setReadError(reason instanceof Error ? reason.message : 'Could not refresh WhatsApp status.');
      } finally {loading=false;}
    };
    void load(); const timer = setInterval(() => { void load(); }, 2000);
    return () => { abort.abort();clearInterval(timer); };
  }, [client, status, snapshot?.demo,pollRevision]);
  if (!snapshot || snapshot.demo) return null;
  const online=status==='online';
  const display=connection?.pcDisplay?.requestId===displayRequest?connection.pcDisplay:null;
  const displayText=display?.state==='requested'?'PC QR display requested. Waiting for the launcher.'
    :display?.state==='ready'?'The PC accepted the QR viewer launch. Check its screen. If no QR appears, press P in the launcher.'
    :display?.state==='expired'?'The PC QR display request expired. Press P in the PC launcher if you still need a QR.'
    :display?.state==='unavailable'?'The PC QR viewer is unavailable. Press P in the PC launcher.'
    :process.env.EXPO_OS==='web'?'Scan the QR below with the WhatsApp account you want to link.'
    :'For a QR on your PC, press P in the Otherme launcher.';
  const link=async()=>{
    if(lock.current || !online)return;
    lock.current=true;setBusy(true);read.current?.abort();
    const requestId=randomUUID();
    const displayOnPc=process.env.EXPO_OS!=='web' && discovery?.capabilities?.pcQrDisplay===true;
    setDisplayRequest(displayOnPc?requestId:null);
    try {
      const result=await perform('/v1/whatsapp/connect',Connection,{confirm:true,requestId,...(displayOnPc?{displayOnPc:true}:{})});
      if(result){setObserved({client,data:result});setReadError(null);}
    } finally {lock.current=false;setBusy(false);setPollRevision(value=>value+1);}
  };
  return <View style={{ gap: 12 }}>
    <Text style={{ color: palette.text, fontFamily: fonts.semibold, fontSize: 16 }}>WhatsApp</Text>
    <Text style={{ color: palette.muted, fontFamily: fonts.regular }}>{!online?'Cached WhatsApp status: '+(connection?labels[connection.state]:'unavailable'):connection?labels[connection.state]:'Checking link status…'}</Text>
    {!!readError && <Text style={{color:palette.danger,fontFamily:fonts.regular}}>WhatsApp status is not current. {readError}</Text>}
    {!!connection?.error && <Text style={{ color: palette.danger, fontFamily: fonts.regular }}>{connection.error}</Text>}
    {connection?.state!=='connected' && <Text style={{ color: palette.muted, fontFamily: fonts.regular, lineHeight: 20 }}>{displayText}</Text>}
    {online && !readError && connection?.qr && display?.state!=='expired' && <>
      {process.env.EXPO_OS!=='web' && <Button label={showQr?'Hide QR on this device':'Show QR on this device'} secondary onPress={()=>setShowQr(!showQr)}/>}
      {(process.env.EXPO_OS==='web' || showQr) && <Image alt="WhatsApp pairing QR" source={{ uri: connection.qr }} contentFit="contain" style={{ width: 280, maxWidth:'100%', height: 280, alignSelf: 'center', backgroundColor: '#ffffff' }}/>}
      <Text style={{ color: palette.muted, fontFamily: fonts.regular, lineHeight: 20 }}>In the intended WhatsApp account, open Linked devices, then Link a device. If WhatsApp is on this phone, scan the PC screen.</Text>
    </>}
    <Button label={busy?'Applying…':connection?.state === 'connected' ? 'Disconnect WhatsApp' : 'Link WhatsApp'} disabled={!online || busy || connection?.state === 'connecting' || connection?.state==='qr'}
      secondary={connection?.state === 'connected'} onPress={() => {
        if(connection?.state==='connected')setDisconnect(true);else void link();
      }}/>
    {disconnect && <>
      <Text style={{color:palette.muted,fontFamily:fonts.regular}}>Disconnect WhatsApp for this profile? Its history stays. AI cannot send while disconnected.</Text>
      <Button label="Confirm disconnect" disabled={!online || busy} onPress={()=>{
        if(lock.current)return;lock.current=true;setBusy(true);read.current?.abort();
        void perform('/v1/whatsapp/disconnect',z.object({disconnected:z.boolean()}),{}).finally(()=>{lock.current=false;setBusy(false);setDisconnect(false);setPollRevision(value=>value+1);});
      }}/>
      <Button label="Cancel" secondary onPress={()=>setDisconnect(false)}/>
    </>}
  </View>;
}
