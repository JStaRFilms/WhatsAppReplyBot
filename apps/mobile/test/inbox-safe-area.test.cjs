const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes}=require('./render-harness.cjs');

const palette={background:'#fff',border:'#ddd',text:'#111',accent:'#06c',muted:'#777',surface:'#eee',outgoing:'#def',auto:'#0a0'};
const fonts={bold:'bold',medium:'medium',regular:'regular',semibold:'semibold'};

test('compact tab bar owns its bottom inset once',()=>{
  for(const bottom of [36,16,0]){
    const h=hooks();const Tabs=props=>props;Tabs.Screen='screen';
    const component=load('app/(tabs)/_layout.tsx',{'react':h.react,'react-native':{View:'view',Text:'text',useWindowDimensions:()=>({fontScale:1})},'../../lib/responsive':{useWideLayout:()=>false},'expo-router':{Tabs},'lucide-react-native':{MessageSquare:'message',ClipboardList:'clipboard',Sparkles:'sparkles',Settings:'settings'},
      '../../lib/app-state':{useApp:()=>({palette})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom})},'../../lib/theme':{fonts}});
    const tree=h.render(component.default);const style=tree.props.screenOptions.tabBarStyle;
    assert.equal(style.height,64+bottom);assert.equal(style.paddingBottom,4+bottom);assert.equal(style.paddingTop,4);
  }
});

test('tab labels grow for large native fonts and measured browser text without duplicating the inset',()=>{
  const h=hooks();const Tabs=props=>props;Tabs.Screen='screen';
  const component=load('app/(tabs)/_layout.tsx',{'react':h.react,'react-native':{View:'view',Text:'text',useWindowDimensions:()=>({fontScale:2})},
    '../../lib/responsive':{useWideLayout:()=>false},'expo-router':{Tabs},
    'lucide-react-native':{MessageSquare:'message',ClipboardList:'clipboard',Sparkles:'sparkles',Settings:'settings'},
    '../../lib/app-state':{useApp:()=>({palette})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:24})},'../../lib/theme':{fonts}});
  const render=()=>h.render(component.default);let tree=render();
  assert.equal(tree.props.screenOptions.tabBarStyle.height,100);
  const tab=tree.props.children[0];const text=tab.props.options.tabBarLabel({color:palette.text});
  text.props.onLayout({nativeEvent:{layout:{height:56}}});tree=render();
  assert.equal(tree.props.screenOptions.tabBarStyle.height,124);
  assert.equal(tree.props.screenOptions.tabBarStyle.paddingBottom,28);
});

function inboxFixture(snapshot,localDraftIds=[]){
  const h=hooks();h.react.useDeferredValue=value=>value;
  const component=load('components/chat-list.tsx',{'react':h.react,'react-native':{FlatList:'FlatList',ScrollView:'ScrollView',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',View:'View'},
    'lucide-react-native':{Search:'Search'},'expo-router':{useFocusEffect(){},useRouter:()=>({push(){}})},
    '@replybot/core/contracts':{},'./ui':{Page:'Page',EmptyConnection:'EmptyConnection'},
    './chat-row':{ChatRow:'ChatRow'},'../lib/app-state':{useApp:()=>({snapshot,palette,history:{load:async()=>{}}})},
    '../lib/local-drafts':{useLocalDraftIds:()=>localDraftIds},'../lib/theme':{fonts}});
  const render=()=>h.render(()=>component.ChatList({active:true}));
  return{render};
}
const conversation=(id,name)=>({id,name,lastHumanActivityAt:0});
const fixtureSnapshot={accountId:'a',conversations:[conversation('real','Real'),conversation('media','Media'),conversation('contact','Contact'),conversation('draft','Draft')],
  lastMessages:[{id:'m1',conversationId:'real',text:'hello',occurredAt:1,direction:'inbound',source:'live'},
    {id:'m2',conversationId:'media',text:'',media:{kind:'image'},occurredAt:2,direction:'inbound',source:'live'}],drafts:[],unreadCounts:{},latestTenIds:[]};

test('empty inbox search shows only real history and explicit local drafts; search discovers contacts',()=>{
  const app=inboxFixture(fixtureSnapshot,['draft']);
  let tree=app.render();let list=nodes(tree).find(node=>node.type==='FlatList');
  assert.deepEqual(Array.from(list.props.data,c=>c.id),['real','media','draft']);
  const input=nodes(tree).find(node=>node.type==='TextInput');input.props.onChangeText('contact');
  tree=app.render();list=nodes(tree).find(node=>node.type==='FlatList');
  assert.deepEqual(Array.from(list.props.data,c=>c.id),['contact']);
  const row=list.props.renderItem({item:list.props.data[0]});assert.equal(row.props.conversation.id,'contact');assert.equal(row.props.last,undefined);
});

function renderChatRow(conversation,last,localDraft=false){
  const component=load('components/chat-row.tsx',{'react':{memo:fn=>fn},'react-native':{Pressable:'Pressable',Text:'Text',View:'View'},
    '@replybot/core/contracts':{},'../lib/theme':{fonts},'./avatar':{Avatar:'Avatar'},'./chat-badge':{ChatBadge:'ChatBadge'}});
  return component.ChatRow({conversation,last,pending:false,unread:0,localDraft,palette,onOpen(){}});
}
test('contact-only rows are labeled to start a conversation',()=>{
  const row=renderChatRow(conversation('contact','Contact'),undefined);
  assert.ok(nodes(row).some(node=>node.type==='Text'&&node.props.children==='Start conversation'));
});
test('real history with empty text remains a chat row, not a no-message contact',()=>{
  const row=renderChatRow(conversation('media','Media'),fixtureSnapshot.lastMessages[1]);
  assert.ok(nodes(row).some(node=>node.type==='Text'&&node.props.children==='IMAGE'));
});
