import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Conversation, Message } from '@replybot/core/contracts';
import type { Palette } from '../lib/theme';
import { fonts } from '../lib/theme';
import { Avatar } from './avatar';
import { ChatBadge } from './chat-badge';
const time = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'});
export const ChatRow = memo(function ChatRow({ conversation: c, last, pending, palette, onOpen, localDraft, unread, selected = false }: {
  conversation: Conversation; last: Message | undefined; pending: boolean; unread:number; localDraft: boolean; palette: Palette; onOpen: (id: string) => void; selected?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={'Open '+c.name} accessibilityState={{ selected }} onPress={() => onOpen(c.id)}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, minHeight: 76, backgroundColor: selected ? palette.accentSoft : palette.background }}>
    <Avatar name={c.name} unread={unread}/><View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 17, color: palette.text }}>{c.name}</Text>
      <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 14, color: pending ? palette.accent : palette.muted }}>
        {localDraft ? 'Your draft' : last ? (last.text || (last.media ? last.media.kind.toUpperCase() : 'Message')) : 'Start conversation'}
      </Text>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 6, maxWidth: '38%', flexShrink: 1 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.muted }}>{last ? time.format(last.occurredAt) : ''}</Text>
      <ChatBadge conversation={c} pending={pending}/>
    </View>
  </Pressable>;
});
