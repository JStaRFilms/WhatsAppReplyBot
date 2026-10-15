const test=require('node:test');
const assert=require('node:assert/strict');
const {z}=require('zod');
const {load,nodes,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {core,scope,descriptor,snapshot,json,providerFixture}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function assistantFixture(provider){
  const h=lifecycleHooks();
  const screen=load('app/(tabs)/assistant.tsx',{'react':h.react,'react-native':{Pressable:'pressable',ScrollView:'scroll',Text:'text',TextInput:'input',View:'view'},
    'lucide-react-native':{Send:'send'},'zod':{z},'expo-router':{useRouter:()=>({push(){}})},'@replybot/core/api':core,
    '@replybot/core/contracts':{Conversation:z.unknown()},'../../components/ui':{Page:'page',Button:'button',EmptyConnection:'empty'},
    '../../lib/app-state':{useApp:()=>provider.render()},'../../lib/theme':{fonts:{}}});
  return{h,render:()=>h.commit(screen.default)};
}

test('Assistant background read cancellation cannot persist after foreground recovery or replace action failures',async()=>{
  for(const actionError of [null,'Send outcome is unknown. Do not resend.','The confirmed action was rejected.']){
    const f=providerFixture(),a=scope(),late=deferred();await f.connect(a);f.render();f.h.flush();await settle();
    if(actionError)f.render().reportError(actionError);
    f.respond(call=>call.path==='/v1/assistant/turns'?late.promise:Promise.resolve(json(call.path==='/v1/session'?descriptor(a):snapshot(a))));
    const assistant=assistantFixture(f);assistant.render();await settle();
    assert.ok(f.calls.some(call=>call.path==='/v1/assistant/turns'));
    f.foreground('background');assistant.render();await settle();
    f.respond(async call=>json(call.path==='/v1/session'?descriptor(a):call.path==='/v1/assistant/turns'?[]:snapshot(a)));
    f.foreground('active');await settle();assistant.render();await settle();const tree=assistant.render();
    assert.equal(f.render().status,'online');assert.equal(f.render().snapshotFresh,true);
    assert.equal(f.render().error,actionError);
    assert.equal(nodes(tree).some(node=>node.props?.accessibilityRole==='alert'),false);
    late.resolve(json([]));await settle();assert.equal(f.render().error,actionError);assistant.h.unmount();
  }
});

test('Assistant history feedback is local and retry recovery does not clear an unrelated action failure',async()=>{
  const f=providerFixture(),a=scope();await f.connect(a);f.render().reportError('Send outcome is unknown. Do not resend.');
  let fail=true;
  f.respond(async call=>{
    if(call.path==='/v1/assistant/turns'){if(fail)throw new Error('Synthetic history unavailable');return json([]);}
    return json(call.path==='/v1/session'?descriptor(a):snapshot(a));
  });
  const assistant=assistantFixture(f);assistant.render();await settle();let tree=assistant.render();
  const feedback=nodes(tree).find(node=>node.props?.accessibilityRole==='alert');
  assert.match(feedback?.props.children ?? '',/Could not reach the Windows service to refresh/);
  assert.equal(f.render().error,'Send outcome is unknown. Do not resend.');
  const retry=nodes(tree).find(node=>node.props?.label==='Retry Assistant history');assert.ok(retry);assert.equal(retry.props.disabled,false);
  fail=false;retry.props.onPress();await settle();tree=assistant.render();
  assert.equal(nodes(tree).some(node=>node.props?.accessibilityRole==='alert'),false);
  assert.equal(f.render().error,'Send outcome is unknown. Do not resend.');assistant.h.unmount();
});
