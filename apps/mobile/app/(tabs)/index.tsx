import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, type ListRenderItem } from 'react-native';
import { Search } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Conversation } from '@replybot/core/contracts';
import { Page, EmptyConnection } from '../../components/ui';
import { ChatRow } from '../../components/chat-row';
import { useApp } from '../../lib/app-state';
import { fonts } from '../../lib/theme';
type Filter = 'all' | 'drafts' | 'needs';
const keyExtractor = (c: Conversation) => c.id;
export default function Chats() {
  const { snapshot, palette } = useApp(); const router = useRouter();
  const [search, setSearch] = useState(''); const query = useDeferredValue(search.toLowerCase());
  const [filter, setFilter] = useState<Filter>('all');
  const seen = useRef<Record<Filter,Set<string>>>({ all: new Set(), drafts: new Set(), needs: new Set() });
  const focused = useRef(false);
  const account = useRef<string | undefined>(undefined);
  const data = useMemo(() => {
    const last = new Map(snapshot?.lastMessages.map(m => [m.conversationId,m]));
    const pending = new Set(snapshot?.drafts.filter(d => d.state === 'pending').map(d => d.conversationId));
    const needs = new Set(snapshot?.drafts.filter(d => d.state === 'needs_owner').map(d => d.conversationId));
    const activity: Record<Filter,string[]> = {
      all: snapshot?.lastMessages.filter(m => m.direction === 'inbound' && m.source === 'live').map(m => m.id) ?? [],
      drafts: snapshot?.drafts.filter(d => d.state === 'pending').map(d => d.id+':'+d.revision) ?? [],
      needs: snapshot?.drafts.filter(d => d.state === 'needs_owner').map(d => d.id) ?? [],
    };
    const sorted = [...(snapshot?.conversations ?? [])].sort((a,b) => b.lastHumanActivityAt-a.lastHumanActivityAt);
    return { last, pending, needs, activity, sorted, pendingCount: activity.drafts.length };
  },[snapshot]);
  useEffect(() => {
    if (account.current !== snapshot?.accountId) {
      account.current = snapshot?.accountId;
      seen.current = { all: new Set(), drafts: new Set(), needs: new Set() };
    }
    if (focused.current) for (const key of data.activity[filter]) seen.current[filter].add(key);
  },[data,filter,snapshot?.accountId]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    for (const key of data.activity[filter]) seen.current[filter].add(key);
    return () => { focused.current = false; };
  },[data,filter]));
  const chats = useMemo(() => data.sorted.filter(c => c.name.toLowerCase().includes(query))
    .filter(c => filter === 'all' || (filter === 'needs' ? data.needs.has(c.id) : data.pending.has(c.id))),[data,query,filter]);
  const open = useCallback((id: string) => router.push({pathname:'/conversation/[id]',params:{id}}),[router]);
  const renderItem = useCallback<ListRenderItem<Conversation>>(({ item }) => <ChatRow conversation={item} last={data.last.get(item.id)}
    pending={data.pending.has(item.id)} palette={palette} onOpen={open}/>,[data,palette,open]);
  if (!snapshot) return <Page><EmptyConnection/></Page>;
  return <Page scroll={false}>
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 26, paddingHorizontal: 16, paddingVertical: 13 }}>
        <Search size={20} color={palette.muted}/><TextInput accessibilityLabel="Search conversations" placeholder="Search conversations" placeholderTextColor={palette.muted} value={search} onChangeText={setSearch}
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: palette.text, padding: 0 }}/>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all','drafts','needs'] as const).map(value => {
          const fresh = value !== filter && data.activity[value].some(key => !seen.current[value].has(key));
          const label = value === 'all' ? 'All' : value === 'drafts' ? 'Drafts '+data.pendingCount : 'Needs me';
          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={label} onPress={() => setFilter(value)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, backgroundColor: filter === value ? palette.outgoing : palette.background, borderWidth: 1, borderColor: filter === value ? palette.outgoing : palette.border }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: filter === value ? palette.accent : palette.muted }}>{label}</Text>
            {fresh && <View accessibilityLabel={'New activity in '+label} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.auto }}/>}
          </Pressable>;
        })}
      </View>
      <Text style={{ color: palette.muted, fontFamily: fonts.regular, fontSize: 12 }}>Latest {snapshot.latestTenIds.length} eligible chats · drafts only</Text>
    </View>
    <FlatList data={chats} renderItem={renderItem} keyExtractor={keyExtractor} contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      ListEmptyComponent={<Text style={{ color: palette.muted, fontFamily: fonts.regular }}>No matching conversations.</Text>}/>
  </Page>;
}
