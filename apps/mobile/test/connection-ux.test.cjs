const test=require('node:test');
const assert=require('node:assert/strict');
const {z}=require('zod');
const {load,hooks,nodes,label,deferred}=require('./render-harness.cjs');
const {core,scope,descriptor,snapshot,json,apiFixture,providerFixture}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const button=(tree,value)=>{const found=nodes(tree).find(n=>n.props?.label===value);assert.ok(found,'Missing '+value);return found;};
const text=tree=>JSON.stringify(tree);

function whatsappFixture({platform='android',capabilities,display,initial}={}){
  const h=hooks(),calls=[],timers=[];
  const a=scope(),base={state:'qr',qr:'synthetic-qr',error:null,historyMessages:0};
  let handle=async()=>initial ?? {...base,state:'disconnected',qr:null};
  const app={snapshot:{...snapshot(a),demo:false},palette:{},status:'online',discovery:{...descriptor(a),capabilities},
    client:{request:(_path,_schema,_payload,signal)=>handle(signal)},
    perform:async(path,schema,payload)=>{calls.push({path,payload});return schema.parse({...base,...(display?{pcDisplay:{requestId:payload.requestId,state:display}}:{})});}};
  const component=load('components/whatsapp-connection.tsx',{'react':h.react,'react-native':{Text:'text',View:'view'},'expo-image':{Image:'image'},'zod':{z},'@replybot/core/api':core,
    '../lib/app-state':{useApp:()=>app},'../lib/uuid':{randomUUID:()=> 'synthetic-qr-request'},'../lib/theme':{fonts:{}},'./ui':{Button:'button'}},
    {AbortController,process:{env:{EXPO_OS:platform}},setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){}});
  return{app,h,calls,timers,render:()=>h.render(component.WhatsAppConnection),respond:fn=>{handle=fn;}};
}

test('session opts into capabilities, accepts a legacy response and preserves old-service upgrade errors',async()=>{
  const capabilities={pcQrDisplay:true,desktopBrowser:true},calls=[];
  const api=apiFixture(async url=>{
    calls.push(url);
    return json({...descriptor(scope()),...(new URL(url).searchParams.get('capabilities')==='1'?{capabilities}:{})});
  });
  const current=await new api.ApiClient('http://synthetic.local','synthetic-token').session();
  assert.deepEqual(current.capabilities,capabilities);assert.equal(current.protocol,2);
  assert.equal(new URL(calls[0]).pathname,'/v1/session');
  assert.equal(new URL(calls[0]).searchParams.get('capabilities'),'1');
  const legacy=apiFixture(async()=>json(descriptor(scope())));
  assert.equal((await new legacy.ApiClient('http://synthetic.local','synthetic-token').session()).capabilities,undefined);
  const outdated=apiFixture(async()=>json({error:'not_found'},404));
  await assert.rejects(new outdated.ApiClient('http://synthetic.local','synthetic-token').session(),error=>error.code==='client_upgrade_required');
});

test('PC QR intent requires advertised native capability, one mutation, and ready does not promise visible pixels',async()=>{
  for(const capabilities of [undefined,{pcQrDisplay:false},{pcQrDisplay:true}]){
    const f=whatsappFixture({capabilities,display:capabilities?.pcQrDisplay?'ready':undefined});
    f.render();f.h.flush();await settle();const tree=f.render();
    button(tree,'Link WhatsApp').props.onPress();button(tree,'Link WhatsApp').props.onPress();await settle();
    assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/v1/whatsapp/connect');
    assert.equal(f.calls[0].payload.displayOnPc,capabilities?.pcQrDisplay?true:undefined);
    assert.equal(f.calls[0].payload.confirm,true);assert.equal(f.calls[0].payload.requestId,'synthetic-qr-request');
    const result=f.render();assert.equal(button(result,'Link WhatsApp').props.disabled,true);
    if(capabilities?.pcQrDisplay){assert.match(text(result),/accepted the QR viewer launch/);assert.match(text(result),/If no QR appears/);assert.doesNotMatch(text(result),/QR is displayed/);}
    else assert.match(text(result),/press P in the Otherme launcher/);
  }
});

test('missing display result and each explicit display state have honest fallback copy',async()=>{
  for(const display of [undefined,'requested','unavailable','expired']){
    const f=whatsappFixture({capabilities:{pcQrDisplay:true},display});f.render();f.h.flush();await settle();
    button(f.render(),'Link WhatsApp').props.onPress();await settle();const tree=f.render();
    if(display==='requested')assert.match(text(tree),/Waiting for the launcher/);
    else assert.match(text(tree),/press P/i);
    assert.doesNotMatch(text(tree),/accepted the QR viewer launch/);
  }
});

test('browser renders QR locally without a second viewer request',async()=>{
  const f=whatsappFixture({platform:'web',capabilities:{pcQrDisplay:true}});f.render();f.h.flush();await settle();
  button(f.render(),'Link WhatsApp').props.onPress();await settle();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.displayOnPc,undefined);
  assert.ok(nodes(f.render()).some(n=>n.type==='image' && n.props.source.uri==='synthetic-qr'));
});

test('superseded WhatsApp polling cannot overwrite acknowledged link response or expose another profile QR',async()=>{
  const f=whatsappFixture({display:'requested',capabilities:{pcQrDisplay:true}}),late=deferred();
  f.respond(()=>late.promise);f.render();const cleanup=f.h.flush();
  button(f.render(),'Link WhatsApp').props.onPress();await settle();
  late.resolve({state:'connected',qr:null,error:null,historyMessages:0});await settle();
  assert.match(text(f.render()),/Waiting for QR scan/);assert.doesNotMatch(text(f.render()),/Disconnect WhatsApp/);
  f.app.status='offline';assert.match(text(f.render()),/Cached WhatsApp status/);assert.ok(!nodes(f.render()).some(n=>n.type==='image'));
  f.app.client={request:async()=>({state:'disconnected',qr:null,error:null,historyMessages:0})};
  assert.doesNotMatch(text(f.render()),/synthetic-qr/);
  cleanup.forEach(fn=>fn());
});

test('WhatsApp read error clears on recovery and polling alone never launches a viewer',async()=>{
  const f=whatsappFixture();f.respond(async()=>{throw new Error('Synthetic read failure');});f.render();f.h.flush();await settle();
  assert.match(text(f.render()),/not current/);f.respond(async()=>({state:'qr',qr:'synthetic-qr',error:null,historyMessages:0}));
  f.timers.at(-1)();await settle();assert.doesNotMatch(text(f.render()),/Synthetic read failure/);assert.equal(f.calls.length,0);
});

test('authenticated PC button stays connected before Continue and while WhatsApp is not linked',async()=>{
  const h=hooks(),calls=[],app={palette:{},themeChoice:'system',baseUrl:'http://synthetic.local',status:'offline',pcStatus:'authenticated',hasSavedCredential:true,snapshot:null,
    connect:async(...args)=>calls.push(args)};
  const component=load('app/(tabs)/settings.tsx',{'react':h.react,'react-native':{Text:'text',TextInput:'input',View:'view'},'zod':{z},
    '../../components/ui':{Page:'page',Button:'button'},'../../lib/app-state':{useApp:()=>app},'../../components/whatsapp-connection':{WhatsAppConnection:'whatsapp'},
    '../../components/release-settings':{ReleaseSettings:'release-settings'},'../../components/profile-controls':{ProfileControls:'profiles'},'../../lib/theme':{fonts:{}}});
  const render=()=>h.render(component.default);
  let tree=render();assert.equal(button(tree,'Connected to PC').props.disabled,true);
  assert.equal(label(tree,'Service token').props.value,'');assert.equal(label(tree,'Service token').props.secureTextEntry,true);
  assert.match(text(tree),/saved service token is reused/);
  app.pcStatus='offline';tree=render();button(tree,'Reconnect to PC').props.onPress();await settle();assert.deepEqual(calls,[['http://synthetic.local',undefined]]);
  app.pcStatus='auth-required';assert.match(text(render()),/saved service token was not accepted/);button(render(),'Update PC connection');
  app.pcStatus='connecting';assert.equal(button(render(),'Connecting to PC…').props.disabled,true);
});

test('service strip separates PC auth, profile acceptance, stale cache, WhatsApp link and AI permission',()=>{
  const app={palette:{},pcStatus:'authenticated',acceptedScope:null,profileBusy:false,snapshot:null,snapshotFresh:false};
  const component=load('components/ui.tsx',{'react':hooks().react,'react-native':{},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'../lib/app-state':{useApp:()=>app},'../lib/theme':{fonts:{}}});
  assert.match(text(component.ServiceStrip()),/Connected to PC · Review profile/);
  app.acceptedScope=scope();app.snapshot={...snapshot(scope()),demo:false};app.snapshotFresh=true;
  assert.match(text(component.ServiceStrip()),/WhatsApp disconnected · AI paused/);
  app.pcStatus='offline';app.snapshotFresh=false;assert.match(text(component.ServiceStrip()),/PC unavailable · Cached data/);
  app.pcStatus='auth-required';assert.match(text(component.ServiceStrip()),/PC authentication needed · Cached data/);
});

test('desktop public build flag uses browser origin; Metro and native keep their separate defaults',()=>{
  const location={origin:'http://127.0.0.1:43219',hostname:'127.0.0.1'};
  const base=env=>providerFixture({appGlobals:{location,process:{env}}}).render().baseUrl;
  assert.equal(base({EXPO_OS:'web',EXPO_PUBLIC_DESKTOP:'1',EXPO_PUBLIC_BACKEND_URL:'http://old-wifi.synthetic:3210'}),location.origin);
  assert.equal(base({EXPO_OS:'web'}),'http://127.0.0.1:3210');
  assert.equal(base({EXPO_OS:'android',EXPO_PUBLIC_DESKTOP:'1',EXPO_PUBLIC_BACKEND_URL:'http://phone.synthetic:43218'}),'http://phone.synthetic:43218');
});
