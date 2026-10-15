import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View, type ListRenderItem } from 'react-native';
import { Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { Conversation } from '@replybot/core/contracts';
import { Page, EmptyConnection } from './ui';
import { ChatRow } from './chat-row';
import { useApp } from '../lib/app-state';
import { useLocalDraftIds } from '../lib/local-drafts';
import { fonts } from '../lib/theme';
type Filter = 'all' | 'drafts' | 'needs';
const keyExtractor = (c: Conversation) => c.id;
export function ChatList({ active, wide = false, selectedId }: { active: boolean; wide?: boolean; selectedId?: string }) {
  const { snapshot, palette, history } = useApp(); const router = useRouter();
  const localDraftIds=useLocalDraftIds();
  const localIds=useMemo(()=>new Set(localDraftIds),[localDraftIds]);
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
  useEffect(() => {
    focused.current = active;
    if (active) for (const key of data.activity[filter]) seen.current[filter].add(key);
    return () => { focused.current = false; };
  },[active,data,filter]);
  const chats = useMemo(() => data.sorted.filter(c => c.name.toLowerCase().includes(query))
    .filter(c => filter === 'all' || (filter === 'needs' ? data.needs.has(c.id) : data.pending.has(c.id)||localIds.has(c.id)))
    .filter(c => query.length > 0 || filter !== 'all' || data.last.has(c.id) || localIds.has(c.id)),[data,query,filter,localIds]);
  const open = useCallback((id: string) => { void history.load(id).catch(() => {}); const route = {pathname:'/conversation/[id]' as const,params:{id}};
    if (wide) router.replace(route); else router.push(route);
  },[router,history,wide]);
  const renderItem = useCallback<ListRenderItem<Conversation>>(({ item }) => <ChatRow conversation={item} last={data.last.get(item.id)}
    pending={data.pending.has(item.id)} localDraft={localIds.has(item.id)} unread={snapshot?.unreadCounts[item.id] ?? 0} palette={palette} onOpen={open} selected={selectedId === item.id}/>,[data,palette,open,localIds,snapshot?.unreadCounts,selectedId]);
  if (!snapshot) return <Page title="Otherme"><EmptyConnection/></Page>;
  return <Page title="Otherme" scroll={false}>
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 24, paddingHorizontal: 16, minHeight: 48, paddingVertical: 8 }}>
        <Search size={20} color={palette.muted}/><TextInput accessibilityLabel="Search conversations" placeholder="Search conversations" placeholderTextColor={palette.muted} value={search} onChangeText={setSearch}
          style={{ flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 16, color: palette.text, padding: 0 }}/>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(['all','drafts','needs'] as const).map(value => {
          const fresh = value !== filter && data.activity[value].some(key => !seen.current[value].has(key));
          const label = value === 'all' ? 'All' : value === 'drafts' ? 'Drafts '+(data.pendingCount+localDraftIds.length) : 'Needs me';
          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 10, minHeight: 48, borderRadius: 24, backgroundColor: filter === value ? palette.outgoing : palette.background, borderWidth: 1, borderColor: filter === value ? palette.outgoing : palette.border }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: filter === value ? palette.accent : palette.muted }}>{label}</Text>
            {fresh && <View accessibilityLabel={'New activity in '+label} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.auto }}/>}
          </Pressable>;
        })}
      </ScrollView>
    </View>
    <FlatList data={chats} renderItem={renderItem} keyExtractor={keyExtractor} contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}
      ListEmptyComponent={<Text style={{ color: palette.muted, fontFamily: fonts.regular }}>No matching conversations.</Text>}/>
  </Page>;
}
