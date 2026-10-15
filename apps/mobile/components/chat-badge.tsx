import { Text, View } from 'react-native';
import type { Conversation } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import { useClientNow } from '../lib/client-clock';
export function ChatBadge({ conversation: c, pending = false }: { conversation: Conversation; pending?: boolean }) {
  const { palette, snapshot, clock } = useApp();
  const now = useClientNow(clock, !!c.pause?.until || !!c.pause?.typingUntil || c.mode === 'auto_reply');
  const grant = snapshot?.grants.find(g => g.conversationId === c.id && g.state === 'active' && (g.expiresAt === null || g.expiresAt > now));
  const remaining = grant ? grant.maxUnits === null ? null : grant.maxUnits-grant.successfulUnits-grant.reservedUnits : 0;
  const hasAllowance = remaining === null || remaining > 0;
  const off = c.kind !== 'direct' || c.excluded || c.mode === 'never_reply';
  const manual = !off && c.control === 'manual';
  const auto = !off && !manual && c.mode === 'auto_reply';
  const label = off ? 'AI off' : manual ? c.pause?.composing ? 'Your draft' : c.pause?.indefinite ? 'Paused' : c.pause?.handover ? 'Needs you' : c.pause?.until && c.pause.until>now ? 'Cooldown · '+Math.ceil((c.pause.until-now)/60000)+' min' : c.pause?.typingUntil && c.pause.typingUntil>now ? 'Typing pause' : 'Manual' : auto ? hasAllowance ? remaining === null ? 'Auto · unlimited' : 'Auto · '+remaining : 'Auto paused' : pending || c.mode === 'draft_only' ? 'Draft' : null;
  if (!label) return null;
  const color = off ? palette.muted : manual || auto && !hasAllowance ? palette.manual : auto ? palette.auto : palette.accent;
  const backgroundColor = off ? palette.surface : manual || auto && !hasAllowance ? palette.manualSoft : auto ? palette.autoSoft : palette.accentSoft;
  return <View accessibilityLabel={auto && hasAllowance ? remaining === null ? 'Auto reply, unlimited actions' : 'Auto reply, '+remaining+' actions remaining' : label}
    style={{ backgroundColor, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'center', flexShrink: 1, minWidth: 0 }}>
    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color }}>{label}</Text>
  </View>;
}
