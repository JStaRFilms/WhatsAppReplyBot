const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,nodes,label,deferred}=require('./render-harness.cjs');
const {z}=require('zod');
const {core,apiFixture}=require('./profile-fixture.cjs');
const {sameScope,ApiError,ReadError}=apiFixture(()=>assert.fail('No network'));
const Conversation=z.object({id:z.string(),accountId:z.string(),workflowVersion:z.number(),control:z.string(),kind:z.string(),mode:z.string()});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const conversation=(workflowVersion,control='manual',accountId='account')=>({id:'chat',accountId,workflowVersion,control,kind:'direct',mode:'auto_reply'});
const profileScope=c=>({profileId:c.accountId,accountId:c.accountId,revision:0});
const snapshot=c=>({profileScope:profileScope(c),accountId:c.accountId,serverTime:1,conversations:[c]});
function providerFixture() {
  const h=hooks();const calls=[];let handle,discovered;
  class ApiClient {
    constructor(baseUrl,token,scope){this.baseUrl=baseUrl;this.token=token;this.scope=scope;}
    revoke(){}
    abortReads(){}
    session(){return Promise.resolve(discovered);}
    request(path,schema,payload){calls.push({client:this,path,payload});return Promise.resolve(handle(this,path,payload)).then(data=>schema.parse ? schema.parse(data) : data);}
  }
  const component=load('lib/app-state.tsx',{'react':h.react,'react-native':{useColorScheme:()=> 'light',AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},'expo-constants':{},'zod':require('zod'),
    '@replybot/core/contracts':{Conversation},'@replybot/core/api':{...core,ClientSnapshot:{}},'./api':{ApiClient,ApiError,ReadError,sameScope},'./history-cache':{HistoryCache:class{}},'./audio-lane':{stopPlayback(){}},
    './client-clock':{ClientClock:class{calibrate(){}}},'./storage':{readSetting:async()=>null,saveSetting:async()=>{},getClientId:async()=> 'synthetic'},'./theme':{palettes:{dark:{},light:{}}}}, {URL,Map,AbortController,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){}});
  const render=()=>h.render(()=>component.AppProvider({children:null})).props.value;
  return{calls,render,respond:fn=>{handle=fn;},connect:async(c,url='http://synthetic.local')=>{
    discovered={protocol:2,scope:profileScope(c),label:'Synthetic',transition:null};
    handle=async()=>snapshot(c);await render().connect(url,'synthetic-token');await render().continueProfile();return render();
  }};
}
test('Resume shows busy immediately, applies only server acknowledgment and does not wait for a delayed snapshot',async()=>{
  const f=providerFixture();let app=await f.connect(conversation(1));const ack=deferred(),delayed=deferred();
  f.respond((_client,path)=>path.endsWith('/control')?ack.promise:delayed.promise);
  const h=hooks();const component=load('components/pause-controls.tsx',{'react':h.react,'react-native':{View:'view',Text:'text',Modal:'modal',Pressable:'pressable'},'lucide-react-native':{MoreHorizontal:'more'},
    '../lib/app-state':{useApp:()=>app},'../lib/theme':{fonts:{}},'./ui':{Button:'button'}});
  const render=()=>h.render(()=>component.PauseControls({conversation:app.snapshot.conversations[0]}));
  label(render(),'Resume now').props.onPress();let button=label(render(),'Resume now');assert.equal(button.props.accessibilityState.busy,true);assert.equal(button.props.children.props.children,'Applying…');
  assert.equal(f.render().snapshot.conversations[0].control,'manual');assert.equal(f.calls.filter(c=>c.path==='/v1/snapshot').length,1);
  ack.resolve(conversation(2,'assistant_allowed'));await settle();app=f.render();assert.equal(app.snapshot.conversations[0].control,'assistant_allowed');
  assert.equal(nodes(render()).some(n=>n.props?.accessibilityLabel==='Resume now'),false);
  assert.equal(f.calls.filter(c=>c.path==='/v1/snapshot').length,2);
  delayed.resolve(snapshot(conversation(1)));await settle();assert.equal(f.render().snapshot.conversations[0].workflowVersion,2);assert.equal(f.render().snapshot.conversations[0].control,'assistant_allowed');
});
test('older control acknowledgments cannot overwrite a newer workflow; failed Resume remains manual',async()=>{
  const f=providerFixture();await f.connect(conversation(1));const old=deferred(),fresh=deferred(),delayed=deferred();
  f.respond((_client,path,payload)=>path==='/v1/snapshot'?delayed.promise:payload.action==='resume'?old.promise:fresh.promise);
  const a=f.render().control('chat','resume'),b=f.render().control('chat','indefinite');
  fresh.resolve(conversation(3));await b;old.resolve(conversation(2,'assistant_allowed'));await a;
  assert.equal(f.render().snapshot.conversations[0].workflowVersion,3);assert.equal(f.render().snapshot.conversations[0].control,'manual');
  f.respond(async()=>{throw new Error('Resume rejected');});assert.equal(await f.render().control('chat','resume'),undefined);
  assert.equal(f.render().snapshot.conversations[0].control,'manual');assert.equal(f.render().error,'Resume rejected');
});
test('session changes discard stale control results and errors without modifying the new connection',async()=>{
  for(const fail of [false,true]){
    const f=providerFixture();await f.connect(conversation(1));const old=deferred();f.respond(()=>old.promise);
    const pending=f.render().control('chat','resume');await f.connect(conversation(1,'manual','new-account'),'http://new.local');
    if(fail)old.reject(new Error('Old connection failed'));else old.resolve(conversation(9,'assistant_allowed'));
    assert.equal(await pending,undefined);const app=f.render();assert.equal(app.snapshot.accountId,'new-account');assert.equal(app.snapshot.conversations[0].control,'manual');assert.equal(app.error,null);
    assert.equal(f.calls.filter(c=>c.path==='/v1/snapshot').length,2);
  }
});

test('composer rejects unacknowledged or stale holds rather than allowing permission and picker work',async()=>{
  const f=providerFixture();await f.connect(conversation(1));
  f.respond(async()=>({acknowledged:false,conversation:conversation(2)}));
  await assert.rejects(f.render().composer('chat',true));assert.equal(f.render().snapshot.conversations[0].workflowVersion,1);
  const old=deferred();f.respond(()=>old.promise);const hold=f.render().composer('chat',true);await settle();
  await f.connect(conversation(1,'manual','new-account'),'http://new.local');
  old.resolve({acknowledged:true,conversation:conversation(2)});
  await assert.rejects(hold,/Connection changed/);assert.equal(f.render().snapshot.accountId,'new-account');
});
