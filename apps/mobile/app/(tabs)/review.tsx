import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Page, EmptyConnection } from '../../components/ui';
import { DraftCard } from '../../components/draft-card';
import { useApp } from '../../lib/app-state';
import { fonts } from '../../lib/theme';
export default function Review() {
  const { snapshot, palette } = useApp(); const router = useRouter();
  if (!snapshot) return <Page><EmptyConnection/></Page>;
  const drafts = snapshot.drafts.filter(d => ['pending','needs_owner','stale'].includes(d.state));
  return <Page>
    {!drafts.length && <Text style={{ fontFamily: fonts.regular, color: palette.muted }}>No drafts need review.</Text>}
    {drafts.map(d => {
      const c = snapshot.conversations.find(c => c.id === d.conversationId); if (!c) return null;
      return <View key={d.id} style={{ gap: 10, paddingBottom: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: c.id } })}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>{c.name}</Text>
        </Pressable>
        <DraftCard draft={d}/>
      </View>;
    })}
  </Page>;
}
