import { Text, View } from 'react-native';
import type { Conversation } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export function ChatBadge({ conversation: c, pending = false }: { conversation: Conversation; pending?: boolean }) {
  const { palette, snapshot } = useApp();
  const grant = snapshot?.grants.find(g => g.conversationId === c.id && g.state === 'active' && g.expiresAt > Date.now());
  const remaining = grant ? grant.maxUnits-grant.successfulUnits-grant.reservedUnits : 0;
  const off = c.kind !== 'direct' || c.excluded || c.mode === 'never_reply';
  const manual = !off && c.control === 'manual';
  const auto = !off && !manual && c.mode === 'auto_reply';
  const label = off ? 'AI off' : manual ? 'Manual' : auto ? remaining > 0 ? 'Auto · '+remaining : 'Auto paused' : pending || c.mode === 'draft_only' ? 'Draft' : null;
  if (!label) return null;
  const color = off ? palette.muted : manual || auto && !remaining ? palette.manual : auto ? palette.auto : palette.accent;
  const backgroundColor = off ? palette.surface : manual || auto && !remaining ? palette.manualSoft : auto ? palette.autoSoft : palette.accentSoft;
  return <View accessibilityLabel={auto && remaining ? 'Auto reply, '+remaining+' actions remaining' : label}
    style={{ backgroundColor, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' }}>
    <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 10, color }}>{label}</Text>
  </View>;
}
