import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Ban, Check, CheckCheck, CircleAlert, CircleHelp, Clock } from 'lucide-react-native';
import type { OutgoingReceipt, Outbox } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';

type DeliveryState = 'pending' | 'failed' | 'unknown' | 'cancelled';
export function OutgoingStatus({ receipt, simulated = false, deliveryState }: { receipt?: OutgoingReceipt; simulated?: boolean; deliveryState?: DeliveryState }) {
  const { palette } = useApp();
  const exception = deliveryState && deliveryState !== 'pending' ? deliveryState : undefined;
  const stateLabel = exception ? { failed: 'Not sent', unknown: 'Send unconfirmed', cancelled: 'Cancelled' }[exception] : undefined;
  const receiptLabel = receipt ? { sent: 'Sent', delivered: 'Delivered', read: 'Read' }[receipt.level] : undefined;
  const label = (simulated ? 'Simulated · ' : '') + [receiptLabel, stateLabel].filter(Boolean).join(' · ')
    + (!receiptLabel && !stateLabel ? 'Pending' : '');
  const details = exception === 'unknown' ? 'Send outcome is uncertain. Do not resend. Later messages are waiting.'
    : exception === 'failed' ? 'This message was not sent.'
    : exception === 'cancelled' ? 'This send was cancelled.'
    : receipt ? { sent: 'WhatsApp acknowledged this message. Delivery is not confirmed.', delivered: 'WhatsApp reported delivery to the recipient.', read: 'WhatsApp reported that the recipient read this message.' }[receipt.level]
    : 'No WhatsApp acknowledgment yet. This is not confirmation that the message was sent.';
  const Icon = receipt ? receipt.level === 'sent' ? Check : CheckCheck
    : exception === 'unknown' ? CircleHelp : exception === 'failed' ? CircleAlert : exception === 'cancelled' ? Ban : Clock;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Show message status"
    hitSlop={8} onPress={() => {
      const text = simulated ? 'Preview only, not sent to WhatsApp.' : details;
      if (Platform.OS === 'web') globalThis.alert(label + '\n\n' + text);
      else Alert.alert(label, text);
    }} style={{ width: simulated ? 102 : 32, height: 32, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
    {simulated && <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 11 }}>Simulated</Text>}
    <Icon size={16} color={receipt?.level === 'read' ? palette.accent : exception === 'unknown' || exception === 'failed' ? palette.danger : palette.muted} accessibilityElementsHidden/>
    {receipt && exception && <CircleAlert size={8} color={palette.danger} accessibilityElementsHidden style={{ position: 'absolute', right: 0, top: 4 }}/>}
  </Pressable>;
}
export function OutboxStatus({ outbox, simulated = false }: { outbox: Outbox; simulated?: boolean }) {
  const { palette } = useApp();
  return <View style={{ gap: 4 }}>
    {['unknown', 'partial'].includes(outbox.state) && <Text accessibilityRole="alert" style={{ color: palette.danger, fontSize: 12, fontFamily: fonts.regular }}>Unresolved send outcome. Do not resend. Later messages are waiting.</Text>}
    {outbox.components.map((component, index) => <View key={component.id} accessibilityLabel={'Outgoing component ' + (index + 1)} style={{ gap: 2 }}>
      <Text selectable style={{ color: palette.text, fontSize: 14, fontFamily: fonts.regular }}>{component.text || (component.reaction ? 'React ' + component.reaction.emoji : component.kind === 'image' ? 'Photo' : component.kind === 'audio' ? 'Voice message' : component.kind)}</Text>
      <OutgoingStatus receipt={component.outgoingReceipt} simulated={simulated}
        deliveryState={component.state === 'queued' || component.state === 'dispatching' ? 'pending' : component.state === 'accepted' ? undefined : component.state}/>
    </View>)}
  </View>;
}
