import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Page, EmptyConnection } from '../../components/ui';
import { ChatBadge } from '../../components/chat-badge';
import { Avatar } from '../../components/avatar';
import { useApp } from '../../lib/app-state';
import { fonts } from '../../lib/theme';

export default function Chats() {
  const { snapshot, palette } = useApp(); const router = useRouter();
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState<'all'|'drafts'|'needs'>('all');
  const chats = useMemo(() => (snapshot?.conversations ?? []).filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(c => filter === 'all' || (filter === 'needs' ? c.control === 'manual' : snapshot?.drafts.some(d => d.conversationId === c.id && d.state === 'pending')))
    .sort((a,b) => b.lastHumanActivityAt-a.lastHumanActivityAt), [snapshot, search, filter]);
  if (!snapshot) return <Page><EmptyConnection/></Page>;
  const pendingCount = snapshot.drafts.filter(d => d.state === 'pending').length;
  return <Page scroll={false}>
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 26, paddingHorizontal: 16, paddingVertical: 13 }}>
        <Search size={20} color={palette.muted}/><TextInput accessibilityLabel="Search conversations" placeholder="Search conversations" placeholderTextColor={palette.muted} value={search} onChangeText={setSearch}
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: palette.text, padding: 0 }}/>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all','drafts','needs'] as const).map(value => <Pressable key={value} accessibilityRole="button" onPress={() => setFilter(value)}
          style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, backgroundColor: filter === value ? palette.outgoing : palette.background, borderWidth: 1, borderColor: filter === value ? palette.outgoing : palette.border }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: filter === value ? palette.accent : palette.muted }}>
            {value === 'all' ? 'All' : value === 'drafts' ? 'Drafts '+pendingCount : 'Needs me'}
          </Text>
        </Pressable>)}
      </View>
      <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 12 }}>Latest {snapshot.latestTenIds.length} eligible chats · drafts only</Text>
    </View>
    <FlatList data={chats} keyExtractor={c => c.id} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      ListEmptyComponent={<Text style={{ color: palette.muted, fontFamily: fonts.regular }}>No matching conversations.</Text>}
      renderItem={({ item: c }) => {
        const last = snapshot.lastMessages.find(m => m.conversationId === c.id);
        const pending = snapshot.drafts.find(d => d.conversationId === c.id && d.state === 'pending');
        return <Pressable accessibilityRole="button" accessibilityLabel={'Open '+c.name} onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: c.id } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 }}>
          <Avatar name={c.name}/><View style={{ flex: 1, gap: 7 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 17, color: palette.text }}>{c.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 14, color: pending ? palette.accent : palette.muted }}>
              {last?.text || (last?.media ? last.media.kind.toUpperCase() : 'No messages')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 7 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.muted, textAlign: 'right' }}>
              {last ? new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(last.occurredAt) : ''}
            </Text>
            <ChatBadge conversation={c} pending={!!pending}/>
          </View>
        </Pressable>;
      }}/>
  </Page>;
}
