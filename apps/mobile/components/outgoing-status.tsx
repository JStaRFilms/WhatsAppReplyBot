import { Text, View } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import type { OutgoingReceipt, Outbox } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';

export function OutgoingStatus({ receipt, simulated = false }: { receipt?: OutgoingReceipt; simulated?: boolean }) {
  const { palette } = useApp();
  const label = (simulated ? 'Simulated · ' : '') + (receipt ? { sent: 'Sent', delivered: 'Delivered', read: 'Read' }[receipt.level] : 'Awaiting WhatsApp acknowledgment');
  const Tick = receipt?.level === 'sent' ? Check : CheckCheck;
  return <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
    {receipt && <Tick size={16} color={receipt.level === 'read' ? palette.accent : palette.muted} accessibilityElementsHidden/>}
    <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 11 }}>{label}</Text>
  </View>;
}
export function OutboxStatus({ outbox, simulated = false }: { outbox: Outbox; simulated?: boolean }) {
  const { palette } = useApp();
  return <View style={{ gap: 4 }}>
    {['unknown', 'partial'].includes(outbox.state) && <Text accessibilityRole="alert" style={{ color: palette.danger, fontSize: 12, fontFamily: fonts.regular }}>Unresolved send outcome. Do not resend. Later messages are waiting.</Text>}
    {outbox.components.map((component, index) => <View key={component.id} accessibilityLabel={'Outgoing component ' + (index + 1)} style={{ gap: 2 }}>
      <Text selectable style={{ color: palette.text, fontSize: 14, fontFamily: fonts.regular }}>{component.text || component.reaction?.emoji || component.kind}</Text>
      {component.outgoingReceipt || component.state === 'accepted'
        ? <OutgoingStatus receipt={component.outgoingReceipt} simulated={simulated}/>
        : <Text style={{ color: palette.muted, fontSize: 12, fontFamily: fonts.regular }}>{simulated ? 'Simulated · ' : ''}{component.state === 'unknown' ? 'Unconfirmed' : component.state}</Text>}
    </View>)}
  </View>;
}
