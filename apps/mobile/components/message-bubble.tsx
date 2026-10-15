import { memo, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import type { Message } from '@replybot/core/contracts';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
import { AudioPlayback } from './audio-playback';
import { MediaAttachment } from './media-attachment';
import { groupMessageReactions } from '../lib/message-reactions';
import { OutgoingStatus } from './outgoing-status';
const webSwipeStyle: { touchAction?: 'pan-y' } = Platform.OS === 'web' ? { touchAction: 'pan-y' } : {};
const time = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'});
export const MessageBubble = memo(function MessageBubble({ message, quoted, onSelect, onQuote, onQuoteSource, onOpenMedia, visible=false, active=true }: { message: Message; active?:boolean; visible?:boolean; onOpenMedia?:(message:Message)=>void; onQuoteSource?:(id:string)=>void; quoted?: Message; onSelect: (message: Message) => void; onQuote: (message: Message) => void }) {
  const { palette, snapshot } = useApp(); const owner = message.direction === 'outbound';
  const media = message.media;
  const reactions=groupMessageReactions(message);
  const translation = useRef(new Animated.Value(0)).current;
  const swipe = useMemo(() => {
    const reset = () => Animated.spring(translation, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (event, gesture) => {
        // Mouse drags must remain text selection. Touch swipes claim only a clear horizontal intent.
        if (Platform.OS === 'web' && 'type' in event.nativeEvent
          && typeof event.nativeEvent.type === 'string' && event.nativeEvent.type.startsWith('mouse')) return false;
        return gesture.numberActiveTouches === 1 && gesture.dx > 18 && gesture.dx > Math.abs(gesture.dy) * 1.8;
      },
      onPanResponderMove: (_, gesture) => translation.setValue(Math.max(0, Math.min(gesture.dx, 82))),
      onPanResponderRelease: (_, gesture) => { if (gesture.dx >= 60 && Math.abs(gesture.dy) < 45) onQuote(message); reset(); },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => true,
    });
  }, [message, onQuote, translation]);
  return <View style={{ alignItems: owner ? 'flex-end' : 'flex-start', paddingBottom: 6 }}>
    <Animated.View {...swipe.panHandlers} style={{ ...webSwipeStyle, maxWidth: '86%', transform: [{ translateX: translation }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Message: '+(message.text || media?.kind || 'attachment')} accessibilityHint="Swipe right to quote. Hold to quote or react."
      onLongPress={() => onSelect(message)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
        borderTopRightRadius: owner ? 4 : 16, borderTopLeftRadius: owner ? 16 : 4,
        backgroundColor: owner ? palette.outgoing : palette.surface }}>
      {message.quotedMessageId && <Pressable accessibilityRole="button" accessibilityLabel="View original quoted message" onPress={()=>{if(message.quotedMessageId)onQuoteSource?.(message.quotedMessageId);}} style={{ padding: 9, borderLeftWidth: 3, borderColor: palette.accent, backgroundColor: palette.background, borderRadius: 8, marginBottom: 8 }}>
        <Text style={{ fontFamily: fonts.semibold, color: palette.accent, fontSize: 12 }}>{quoted?.direction === 'outbound' ? 'You' : 'Quoted message'}</Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, color: palette.muted, fontSize: 13 }}>{quoted?.text || quoted?.media?.kind || 'Original source not loaded. Tap to locate it.'}</Text>
      </Pressable>}
      {message.statusReply && <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 12, marginBottom: 8 }}>
        {message.statusContext ? 'Reply to your status: '+message.statusContext : 'Reply to your status · original unavailable'}
      </Text>}
      {media?.kind==='audio' ? <AudioPlayback message={message} active={active}/> : media && <MediaAttachment message={message} visible={active && visible} onOpen={onOpenMedia}/>}
      {!!message.text && <Text selectable style={{ fontFamily: fonts.regular, color: palette.text, fontSize: 16, lineHeight: 24 }}>{message.text}</Text>}
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, textAlign: 'right', color: owner ? palette.outgoingMuted : palette.muted, marginTop: 4 }}>
        {owner ? message.authorship === 'assistant_written' ? snapshot?.demo ? 'AI · simulated ' : 'AI · ' : message.authorship === 'owner_edited_assistant' ? snapshot?.demo ? 'Edited by you · simulated ' : 'Edited by you · ' : 'You · ' : ''}
        {time.format(message.occurredAt)}
      </Text>
      {owner && <OutgoingStatus receipt={message.outgoingReceipt} simulated={snapshot?.demo}/>}
    </Pressable>
    </Animated.View>
    {reactions.length>0 && <View style={{flexDirection:'row',flexWrap:'wrap',gap:4}}>
      {reactions.map(({emoji,actors})=><View key={emoji} accessibilityLabel={emoji+' · '+actors.join(', ')} style={{borderRadius:16,backgroundColor:palette.surface,borderWidth:1,borderColor:palette.border,paddingHorizontal:8,paddingVertical:3}}>
        <Text style={{fontSize:14,color:palette.text}}>{emoji}{actors.length>1 ? ' '+actors.length : ''}</Text>
      </View>)}
    </View>}
  </View>;
});
