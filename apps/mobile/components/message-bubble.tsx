import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Message } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import image from '../assets/demo-image.png';
import sticker from '../assets/demo-sticker.webp';
import gif from '../assets/demo-clock.gif';

const fixtures = { image, sticker, gif };
const time = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'});
export const MessageBubble = memo(function MessageBubble({ message, quoted, onSelect }: { message: Message; quoted?: Message; onSelect: (message: Message) => void }) {
  const { palette, snapshot } = useApp(); const owner = message.direction === 'outbound';
  const media = message.media;
  const available = media?.access === 'available' && !media.viewOnce && (media.expiresAt === null || media.expiresAt > Date.now());
  return <View style={{ alignItems: owner ? 'flex-end' : 'flex-start', paddingBottom: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Message: '+(message.text || media?.kind || 'attachment')} accessibilityHint="Hold to quote or react"
      onLongPress={() => onSelect(message)} style={{ maxWidth: '87%', padding: 11, borderRadius: 12,
        borderTopRightRadius: owner ? 0 : 12, borderTopLeftRadius: owner ? 12 : 0,
        backgroundColor: owner ? palette.outgoing : palette.surface }}>
      {quoted && <View style={{ padding: 9, borderLeftWidth: 3, borderColor: palette.accent, backgroundColor: palette.background, borderRadius: 5, marginBottom: 8 }}>
        <Text style={{ fontFamily: fonts.semibold, color: palette.accent, fontSize: 12 }}>{quoted.direction === 'outbound' ? 'You' : 'Quoted message'}</Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, color: palette.muted, fontSize: 13 }}>{quoted.text || quoted.media?.kind}</Text>
      </View>}
      {message.statusReply && <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 12, marginBottom: 8 }}>
        {message.statusContext ? 'Reply to your status: '+message.statusContext : 'Reply to your status · original unavailable'}
      </Text>}
      {media && (available && media.fixture ? <View style={{ gap: 4, marginBottom: 6 }}>
        <Image source={fixtures[media.fixture]} contentFit="contain" autoplay style={{ width: 220, height: media.kind === 'sticker' ? 140 : 130 }}/>
        <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 11 }}>{media.kind.toUpperCase()}</Text>
      </View> : <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 13, marginBottom: 6 }}>{media.viewOnce ? 'View-once media is not retained' : 'Media unavailable'}</Text>)}
      {!!message.text && <Text selectable style={{ fontFamily: fonts.regular, color: palette.text, fontSize: 15, lineHeight: 22 }}>{message.text}</Text>}
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, textAlign: 'right', color: palette.muted, marginTop: 4 }}>
        {owner ? message.authorship === 'assistant_written' ? snapshot?.demo ? 'AI · simulated ' : 'AI · ' : message.authorship === 'owner_edited_assistant' ? snapshot?.demo ? 'Edited by you · simulated ' : 'Edited by you · ' : 'You · ' : ''}
        {time.format(message.occurredAt)}
      </Text>
    </Pressable>
    {message.reaction && <View style={{ borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 14 }}>{message.reaction}</Text>
    </View>}
  </View>;
});
