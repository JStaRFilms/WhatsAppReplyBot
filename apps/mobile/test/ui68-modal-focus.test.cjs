const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');

function fixture(os='web'){
  const h=lifecycleHooks();let focuses=0;
  const message={id:'source',conversationId:'chat',direction:'inbound',text:'Synthetic quoted source'};
  const cached={messages:[message],revision:1};
  const history={subscribe(){},get:()=>cached,load:async()=>cached,pin(){}};
  const app={client:{},history,palette:{},status:'online',snapshot:{accountId:'synthetic',outbox:[],drafts:[],lastMessages:[],historyVersions:{chat:1},conversations:[{id:'chat',kind:'direct',control:'manual',mode:'draft_only'}]},
    intents:{subscribe(){},get:()=>[]},composer:async()=>{},mediaCache:{setViewerOpen(){},revalidate:async()=>{}},reportError:error=>assert.fail(error)};
  const component=load('app/conversation/[id].tsx',{
    react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input',Pressable:'pressable',ScrollView:'scroll',Modal:'modal'},
    'expo-router':{useLocalSearchParams:()=>({id:'chat'}),useRouter:()=>({}),useFocusEffect:fn=>h.react.useEffect(fn,[fn])},'lucide-react-native':{},
    '@replybot/core/contracts':{},'expo-image':{Image:'image'},'../../lib/uuid':{randomUUID:()=> 'synthetic'},'../../lib/app-state':{useApp:()=>app},
    '../../lib/api':{},'../../lib/pending-intents':{intentVisible:()=>true},'../../lib/media-lease':{},'../../lib/theme':{fonts:{}},
    '../../lib/local-drafts':{useLocalDraftIds:()=>[],useLocalDraft:()=>{const [text,setText]=h.react.useState('');return {text,setText,ready:true};}},
    '../../lib/foreground':{isForeground:()=>true,useForeground:()=>true},
    '../../lib/conversation-scroll':{useConversationScroll:()=>({scroll:{current:null},position:{following:false,offset:0,height:400,contentHeight:1000},positioned:true,settled:false,visibleIds:[],retainRows(){}})},
    '../../lib/composer-focus':{useComposerFocus:()=>h.react.useMemo(()=>({input:{current:null},clear(){},focus(){focuses++;}}),[])},
    ...Object.fromEntries(['voice-composer','attachment-picker','avatar','ui','chat-badge','message-bubble','draft-card','pause-controls','permission-sheet','outgoing-status','media-viewer'].map(name=>['../../components/'+name,{
      VoiceComposer:'voice',AttachmentPicker:'attachment',Avatar:'avatar',Page:'page',Button:'button',ChatBadge:'badge',MessageBubble:'bubble',DraftCard:'draft',PauseControls:'pause',PermissionSheet:'permissions',OutgoingStatus:'status',MediaViewer:'viewer'}])),
  },{process:{env:{EXPO_OS:os}},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
  const render=()=>h.commit(component.default),modal=()=>nodes(render()).find(n=>n.type==='modal');
  render();render();
  const select=()=>{nodes(render()).find(n=>n.type==='bubble').props.onSelect(message);return modal();};
  const quote=()=>{nodes(render()).find(n=>n.props?.label==='Quote this message').props.onPress();};
  return {h,app,render,modal,select,quote,focuses:()=>focuses};
}

test('ui68 web closes without an exit fade and focuses Quote once only after public dismissal',()=>{
  const f=fixture();try{
    assert.equal(f.select().props.animationType,'none');f.quote();
    assert.equal(f.focuses(),0,'the still-mounted focus trap must finish first');
    const modal=f.modal();assert.equal(modal.props.visible,false);assert.ok(label(f.render(),'Remove quote'));
    modal.props.onDismiss();assert.equal(f.focuses(),1);
    modal.props.onDismiss();assert.equal(f.focuses(),1,'dismissal is not repeated focus restoration');
  }finally{f.h.unmount();}
});

test('ui68 newer composer edits or scope changes invalidate pending Quote focus',()=>{
  for(const intent of ['text','quote','scope']){
    const f=fixture();try{
      f.select();f.quote();const dismiss=f.modal().props.onDismiss;
      if(intent==='text')label(f.render(),'Message').props.onChangeText('Newer input');
      if(intent==='quote')label(f.render(),'Remove quote').props.onPress();
      if(intent==='scope'){f.app.client={};f.render();}
      dismiss();assert.equal(f.focuses(),0,intent+' must win over dismissal');
      if(intent==='text')assert.equal(label(f.render(),'Message').props.value,'Newer input');
    }finally{f.h.unmount();}
  }
});

test('ui68 Cancel and request-close leave opener return to Modal instead of focusing the composer',()=>{
  for(const close of ['cancel','request']){
    const f=fixture();try{
      const modal=f.select();
      if(close==='request')modal.props.onRequestClose();else nodes(f.render()).find(n=>n.props?.label==='Cancel').props.onPress();
      const closed=f.modal();assert.equal(closed.props.visible,false);closed.props.onDismiss();assert.equal(f.focuses(),0);
    }finally{f.h.unmount();}
  }
});

test('ui68 native retains fade, immediate Quote focus and hardware-back request-close',()=>{
  for(const os of ['android','ios']){
    const f=fixture(os);try{
      const modal=f.select();assert.equal(modal.props.animationType,'fade');assert.equal(modal.props.onDismiss,undefined);
      f.quote();assert.equal(f.focuses(),1);assert.equal(f.modal().props.visible,false);
      f.select().props.onRequestClose();assert.equal(f.modal().props.visible,false);assert.equal(f.focuses(),1);
    }finally{f.h.unmount();}
  }
});
