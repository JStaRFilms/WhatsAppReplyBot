import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChatList } from '../../components/chat-list';
import { useWideLayout } from '../../lib/responsive';
import { useApp } from '../../lib/app-state';
import { fonts } from '../../lib/theme';

export default function Chats() {
  const wide = useWideLayout();
  const { palette } = useApp();
  const [active, setActive] = useState(false);
  useFocusEffect(useCallback(() => { setActive(true); return () => setActive(false); }, []));
  if (!wide) return <ChatList active={active}/>;
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8, backgroundColor: palette.background }}>
    <Text style={{ color: palette.text, fontFamily: fonts.semibold, fontSize: 20 }}>Your conversations</Text>
    <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 14 }}>Choose a chat to read and reply.</Text>
  </View>;
}
