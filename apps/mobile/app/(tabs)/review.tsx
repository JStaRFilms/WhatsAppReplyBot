import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Page, EmptyConnection } from '../../components/ui';
import { DraftCard } from '../../components/draft-card';
import { useApp } from '../../lib/app-state';
import { useLocalDraftIds } from '../../lib/local-drafts';
import { fonts } from '../../lib/theme';
export default function Review() {
  const { snapshot, palette, history } = useApp(); const router = useRouter();
  const localDrafts=useLocalDraftIds();
  if (!snapshot) return <Page><EmptyConnection/></Page>;
  const drafts = snapshot.drafts.filter(d => ['pending','needs_owner','stale'].includes(d.state));
  return <Page>
    {!drafts.length && !localDrafts.length && <Text style={{ fontFamily: fonts.regular, color: palette.muted }}>No drafts need review.</Text>}
    {localDrafts.map(id=>{
      const c=snapshot.conversations.find(c=>c.id===id);if(!c)return null;
      return <Pressable key={'local-'+id} accessibilityRole="button" onPress={()=>{void history.load(id).catch(()=>{});router.push({pathname:'/conversation/[id]',params:{id}});}} style={{paddingVertical:12,gap:5}}>
        <Text style={{fontFamily:fonts.semibold,color:palette.text,fontSize:16}}>{c.name}</Text>
        <Text style={{fontFamily:fonts.medium,color:palette.accent,fontSize:13}}>Your draft</Text>
      </Pressable>;
    })}
    {drafts.map(d => {
      const c = snapshot.conversations.find(c => c.id === d.conversationId); if (!c) return null;
      return <View key={d.id} style={{ gap: 10, paddingBottom: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => { void history.load(c.id).catch(() => {}); router.push({ pathname: '/conversation/[id]', params: { id: c.id } }); }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.text }}>{c.name}</Text>
        </Pressable>
        <DraftCard draft={d}/>
      </View>;
    })}
  </Page>;
}
