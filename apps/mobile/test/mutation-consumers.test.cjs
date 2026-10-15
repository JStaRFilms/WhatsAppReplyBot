const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {core,contracts,scope,snapshot,apiFixture}=require('./profile-fixture.cjs');
const {outbox}=require('./pending-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const button=(tree,value)=>{const result=nodes(tree).find(node=>node.props?.label===value);assert.ok(result,'Missing '+value);return result;};
test('draft decision renders returned draft/outbox immediately, without assuming a refreshed snapshot or allowing a second accepted approval',async()=>{
  const h=lifecycleHooks(),response=deferred(),calls=[],client={};
  const api=apiFixture(()=>assert.fail('No network'));
  const component=load('components/draft-card.tsx',{react:h.react,'react-native':{Text:'text',TextInput:'input',View:'view'},'@replybot/core/contracts':contracts,
    '../lib/app-state':{useApp:()=>({palette:{},status:'online',client,mutate:async(_path,schema,payload)=>{calls.push(payload);return schema.parse(await response.promise);}})},
    '../lib/api':api,'../lib/theme':{fonts:{}},'./ui':{Button:'button'},'./outgoing-status':{OutboxStatus:'outbox'}});
  const provided={id:'draft',revision:1,state:'pending',action:{kind:'text',text:'Reviewed bytes',reason:'Synthetic'}};
  const render=()=>h.commit(()=>component.DraftCard({draft:provided}));
  button(render(),'Send reply').props.onPress();assert.equal(button(render(),'Send reply').props.disabled,true);
  response.resolve({outbox:outbox('decision-request'),simulated:false});await settle();const tree=render();
  assert.equal(nodes(tree).some(node=>node.props?.label==='Send reply'),false);assert.ok(nodes(tree).some(node=>node.type==='outbox'));assert.equal(calls.length,1);
  h.unmount();
});
test('unacknowledged draft approval is not labeled Not sent and cannot be retried by a repeated gesture',async()=>{
  const h=lifecycleHooks(),response=deferred(),api=apiFixture(()=>assert.fail('No network'));let calls=0;
  const app={palette:{},status:'online',client:{},mutate:async()=>{calls++;return response.promise;}};
  const component=load('components/draft-card.tsx',{react:h.react,'react-native':{Text:'text',TextInput:'input',View:'view'},'@replybot/core/contracts':contracts,
    '../lib/app-state':{useApp:()=>app},'../lib/api':api,'../lib/theme':{fonts:{}},'./ui':{Button:'button'},'./outgoing-status':{OutboxStatus:'outbox'}});
  const provided={id:'draft',revision:1,state:'pending',action:{kind:'text',text:'Reviewed bytes',reason:'Synthetic'}};
  const render=()=>h.commit(()=>component.DraftCard({draft:provided}));const send=button(render(),'Send reply');
  send.props.onPress();send.props.onPress();assert.equal(calls,1);response.reject(new api.UnconfirmedMutationError());await settle();
  const tree=render();assert.equal(button(tree,'Send reply').props.disabled,true);
  assert.equal(nodes(tree).some(node=>node.type==='text' && node.props.children==='Not sent'),false);
  assert.match(nodes(tree).find(node=>node.props?.accessibilityRole==='alert').props.children,/outcome unconfirmed/);
  button(tree,'Send reply').props.onPress();assert.equal(calls,1);h.unmount();
});
test('Settings uses the typed consent response before snapshot refresh and keys extension editors by accepted binding',async()=>{
  const h=lifecycleHooks(),response=deferred(),calls=[],app={palette:{},themeChoice:'light',baseUrl:'http://synthetic.local',status:'online',pcStatus:'authenticated',hasSavedCredential:true,
    client:{},sessionKey:'accepted-binding-a',snapshot:{...snapshot(scope()),model:'openai/gpt-6-luna'},perform:async(_path,_schema,payload)=>{calls.push(payload);return response.promise;}};
  const component=load('app/(tabs)/settings.tsx',{react:h.react,'react-native':{Text:'text',TextInput:'input',View:'view'},zod:require('zod'),
    '../../lib/app-state':{useApp:()=>app},'../../components/ui':{Page:'page',Button:'button'},'../../components/whatsapp-connection':{WhatsAppConnection:'whatsapp'},
    '../../components/profile-controls':{ProfileControls:'profiles'},'../../components/release-settings':{ReleaseSettings:'extension'},'../../lib/theme':{fonts:{}}});
  const render=()=>h.commit(component.default);
  assert.equal(nodes(render()).find(node=>node.type==='extension').key,'accepted-binding-a');button(render(),'Enable AI').props.onPress();response.resolve({consent:true});await settle();
  button(render(),'Pause AI');assert.equal(app.snapshot.modelConsent,false);assert.equal(calls.length,1);
  app.snapshot={...app.snapshot,modelConsent:true};render();app.snapshot={...app.snapshot,modelConsent:false};button(render(),'Enable AI');
  app.client={};app.sessionKey='accepted-binding-b';assert.equal(nodes(render()).find(node=>node.type==='extension').key,'accepted-binding-b');h.unmount();
});
