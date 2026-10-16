const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {contracts,apiFixture}=require('./profile-fixture.cjs');
const {outbox}=require('./pending-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const copy=tree=>nodes(tree).filter(n=>n.type==='text').flatMap(n=>n.props.children).filter(v=>typeof v==='string'||typeof v==='number').join(' ');
const button=(tree,value)=>{const found=nodes(tree).find(n=>n.props?.label===value);assert.ok(found,'Missing '+value);return found;};
const palette={accent:'blue',muted:'neutral',danger:'red'};
function statusFixture(platform='android') {
  const dialogs=[];
  const component=load('components/outgoing-status.tsx',{
    'react-native':{View:'view',Text:'text',Pressable:'pressable',Platform:{OS:platform},Alert:{alert:(...args)=>dialogs.push(args)}},
    'lucide-react-native':{Check:'single-tick',CheckCheck:'double-tick',Clock:'clock',CircleHelp:'unknown',CircleAlert:'failed',Ban:'cancelled'},
    '../lib/app-state':{useApp:()=>({palette})},'../lib/theme':{fonts:{}}},{alert:message=>dialogs.push([message])});
  return{component,dialogs};
}
test('ui58 receipt slot is compact, stable, touch-accessible and uses only observed receipt levels',()=>{
  const {component,dialogs}=statusFixture();let dimensions;
  for(const [receipt,deliveryState,icon,color] of [
    [undefined,undefined,'clock','neutral'],[undefined,'pending','clock','neutral'],
    [{level:'sent'},undefined,'single-tick','neutral'],[{level:'delivered'},undefined,'double-tick','neutral'],
    [{level:'read'},undefined,'double-tick','blue'],[undefined,'unknown','unknown','red'],
    [undefined,'failed','failed','red'],[undefined,'cancelled','cancelled','neutral'],
  ]){
    const tree=component.OutgoingStatus({receipt,deliveryState});
    const glyph=nodes(tree).find(n=>n.type===icon);assert.ok(glyph,'Missing '+icon);assert.equal(glyph.props.color,color);
    assert.equal(copy(tree),'','Routine delivery text must not be permanently visible');
    assert.equal(tree.type,'pressable');assert.equal(tree.props.accessibilityRole,'button');assert.ok(tree.props.accessibilityLabel);
    const size=[tree.props.style.width,tree.props.style.height];assert.ok(size[0]>0&&size[1]>0);
    dimensions??=size;assert.deepEqual(size,dimensions);assert.ok(tree.props.hitSlop>=8);
    tree.props.onPress();assert.ok(dialogs.at(-1).join(' ').length>10);
  }
  const unknown=component.OutgoingStatus({deliveryState:'unknown'});unknown.props.onPress();assert.match(dialogs.at(-1).join(' '),/Do not resend/);
  const mixed=component.OutgoingStatus({receipt:{level:'read'},deliveryState:'unknown'});
  assert.ok(nodes(mixed).some(n=>n.type==='double-tick'));assert.match(mixed.props.accessibilityLabel,/unconfirmed/i);
  const simulated=component.OutgoingStatus({receipt:{level:'read'},simulated:true});assert.match(copy(simulated),/Simulated/);assert.match(simulated.props.accessibilityLabel,/Simulated/);
  simulated.props.onPress();assert.match(dialogs.at(-1).join(' '),/not sent to WhatsApp/i);
  const web=statusFixture('web');web.component.OutgoingStatus({deliveryState:'unknown'}).props.onPress();assert.match(web.dialogs[0][0],/Do not resend/);
});
test('ui58 shared outbox keeps exact actions, uncertainty and per-component states without raw transport prose',()=>{
  const {component}=statusFixture(),box=outbox('ui58','partial');
  box.components=['queued','dispatching','accepted','unknown','failed','cancelled'].map((state,i)=>({...box.components[0],id:String(i),text:'Part '+i,state}));
  const tree=component.OutboxStatus({outbox:box});
  assert.match(copy(tree),/Part 0.*Part 5/);assert.match(copy(tree),/Do not resend/);
  const statuses=nodes(tree).filter(n=>n.type===component.OutgoingStatus);
  assert.equal(statuses.length,6);assert.deepEqual(statuses.map(n=>n.props.deliveryState),['pending','pending',undefined,'unknown','failed','cancelled']);
  assert.doesNotMatch(copy(tree),/queued|dispatching|accepted|Awaiting WhatsApp/);
});
function bubbleFixture() {
  const h=hooks(),component=load('components/message-bubble.tsx',{react:h.react,
    'react-native':{View:'view',Text:'text',Pressable:'pressable',Platform:{OS:'web'},Animated:{Value:class{},View:'animated'},PanResponder:{create:()=>({panHandlers:{}})}},
    '../lib/app-state':{useApp:()=>({palette,snapshot:{demo:false}})},'../lib/theme':{fonts:{}},
    './audio-playback':{AudioPlayback:'audio'},'./media-attachment':{MediaAttachment:'media'},'./outgoing-status':{OutgoingStatus:'status'},
    '../lib/message-reactions':{groupMessageReactions:m=>m.reaction?[{emoji:m.reaction,actors:['You']}]:[]}});
  return m=>h.render(()=>component.MessageBubble({message:{id:'m',direction:'outbound',authorship:'owner_written',occurredAt:10,...m},onSelect(){},onQuote(){}}));
}
test('ui58 bubbles put status beside time, suppress only replaced generic placeholders and retain captions/emoji/reactions',()=>{
  const render=bubbleFixture();
  const tree=render({text:'[Unsupported attachment]',media:{kind:'video'}});
  assert.doesNotMatch(copy(tree),/Unsupported attachment/);assert.doesNotMatch(nodes(tree).find(n=>n.props?.accessibilityHint)?.props.accessibilityLabel ?? '',/Unsupported attachment/);
  const row=nodes(tree).find(n=>n.type==='view'&&nodes(n.props.children).some(c=>c.type==='status')&&n.props.style?.flexDirection==='row');assert.ok(row,'Time and receipt share a row');
  assert.match(copy(render({text:'Real caption',media:{kind:'video'}})),/Real caption/);
  assert.match(copy(render({text:'[Unsupported attachment]',media:{kind:'image'}})),/Unsupported attachment/,'Normalizer does not generate this fallback for image captions');
  assert.match(copy(render({text:'[Unsupported attachment]',media:{kind:'document'}})),/Unsupported attachment/);
  assert.match(copy(render({text:'[Unsupported attachment]'})),/Unsupported attachment/);
  const emoji=render({text:'🔥',reaction:'👍'});assert.match(copy(emoji),/🔥/);assert.match(copy(emoji),/👍/);
  assert.equal(nodes(render({direction:'inbound',text:'Hello'})).some(n=>n.type==='status'),false);
  assert.equal(nodes(tree).filter(n=>n.type==='pressable').some(n=>nodes(n.props.children).some(child=>child.type==='status')),false,'Status stays outside the long-press accessibility group');
});
test('ui58 draft source warning stays ordinary while editing/revision/approval gates and one outbox body remain intact',async()=>{
  const h=lifecycleHooks(),calls=[],response=deferred(),api=apiFixture(()=>assert.fail('No network'));
  const app={palette,status:'online',client:{},mutate:async(...args)=>{calls.push(args);return response.promise;}};
  const component=load('components/draft-card.tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input'},
    '@replybot/core/contracts':contracts,'../lib/app-state':{useApp:()=>app},'../lib/api':api,'../lib/theme':{fonts:{}},'./ui':{Button:'button'},'./outgoing-status':{OutboxStatus:'outbox'}});
  let ready=false,provided={id:'draft',revision:1,state:'pending',action:{kind:'text',text:'Exact proposed reply',reason:'Routine model rationale'}};
  const render=()=>h.commit(()=>component.DraftCard({draft:provided,sourceReady:ready}));
  assert.match(copy(render()),/Exact proposed reply/);assert.doesNotMatch(copy(render()),/cached|authority|context|Routine model/);
  assert.equal(button(render(),'Send reply').props.disabled,true);button(render(),'Send reply').props.onPress();assert.equal(calls.length,0);
  button(render(),'Edit').props.onPress();label(render(),'Edit draft').props.onChangeText('Unsaved owner text');
  assert.equal(label(render(),'Edit draft').props.value,'Unsaved owner text');assert.equal(button(render(),'Save draft').props.disabled,true);
  provided={...provided,revision:2};ready=true;assert.match(copy(render()),/changed on another client/);
  button(render(),'Save draft').props.onPress();assert.equal(calls[0][2].revision,1);
  response.resolve({outbox:{...outbox('ui58'),components:[{...outbox('ui58').components[0],text:'Exact proposed reply'}]}});await settle();
  assert.doesNotMatch(copy(render()),/Exact proposed reply/);assert.equal(nodes(render()).filter(n=>n.type==='outbox').length,1);
  assert.equal(nodes(render()).some(n=>n.props?.label==='Send reply'),false);h.unmount();
});
function settingsFixture(snapshot) {
  const h=lifecycleHooks(),calls=[],app={palette,themeChoice:'light',baseUrl:'http://synthetic.invalid',status:'online',pcStatus:'authenticated',hasSavedCredential:true,client:{},sessionKey:'ui58',snapshot,
    perform:async(path,schema,payload)=>{calls.push({path,payload});return{consent:payload.consent};}};
  const component=load('app/(tabs)/settings.tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input'},zod:require('zod'),
    '../../lib/app-state':{useApp:()=>app},'../../lib/theme':{fonts:{}},'../../components/ui':{Page:'page',Button:'button'},
    '../../components/profile-controls':{ProfileControls:'profiles'},'../../components/whatsapp-connection':{WhatsAppConnection:'whatsapp'},'../../components/release-settings':{ReleaseSettings:'release'}});
  return{h,app,calls,render:()=>h.commit(component.default)};
}
test('ui58 missing assistant data is not local preview; external AI facts remain at explicit consent',async()=>{
  const missing=settingsFixture(null);assert.doesNotMatch(copy(missing.render()),/Local preview/);missing.h.unmount();
  const demo=settingsFixture({model:'local-demo',demo:true});assert.match(copy(demo.render()),/Local preview/);assert.equal(demo.calls.length,0);demo.h.unmount();
  const live=settingsFixture({model:'openai/gpt-6-luna',modelConsent:false,demo:false});const tree=live.render(),text=copy(tree);
  for(const fact of ['GPT-6 Luna','OpenRouter','chat text','images','GIF frames','voice notes','instructions','name','charges'])assert.ok(text.includes(fact),'Missing consent fact '+fact);
  assert.doesNotMatch(text,/Whisper Large V3 Turbo|GPT-6 Luna drafts replies/);
  assert.equal(live.calls.length,0);button(tree,'Enable AI').props.onPress();await settle();assert.deepEqual(JSON.parse(JSON.stringify(live.calls)),[{path:'/v1/model-consent',payload:{consent:true}}]);button(live.render(),'Pause AI');live.h.unmount();
});
