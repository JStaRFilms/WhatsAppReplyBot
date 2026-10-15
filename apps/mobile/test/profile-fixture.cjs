const {createRequire}=require('node:module');
const path=require('node:path');
const {load,hooks}=require('./render-harness.cjs');
const coreRequire=createRequire(path.resolve(__dirname,'../../../packages/core/package.json'));
const contracts=load('../../packages/core/src/contracts.ts',{'zod':require('zod'),'emoji-regex':coreRequire('emoji-regex')});
const core=load('../../packages/core/src/api.ts',{'zod':require('zod'),'./contracts.ts':contracts});
const scope=(profileId='original',revision=0)=>({profileId,accountId:profileId==='original'?'whatsapp-owner':'whatsapp-'+profileId,revision});
const descriptor=(value,transition=null)=>({protocol:2,scope:value,label:value.profileId,transition});
function snapshot(value,version=1){return {profileScope:value,accountId:value.accountId,serverTime:1,demo:true,connection:'disconnected',model:'local-demo',modelConsent:false,
  conversations:[{id:'same-jid',accountId:value.accountId,contactId:'contact',name:'Synthetic',kind:'direct',mode:'draft_only',excluded:false,control:'manual',workflowVersion:version,policyVersion:1,lastHumanActivityAt:0,hours:null}],
  drafts:[],grants:[],outbox:[],lastMessages:[],latestTenIds:[]};}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});}
function apiFixture(fetch,globals={}){return load('lib/api.ts',{'zod':require('zod'),'./uuid':{randomUUID:()=> 'synthetic-request'},'@replybot/core/contracts':contracts,'@replybot/core/api':core},
  {fetch,AbortController,Uint8Array,ArrayBuffer,atob,btoa,Set,Map,setTimeout,clearTimeout,...globals});}
function providerFixture({saved=null,save=async()=>{},apiGlobals={},appGlobals={}}={}){
  const h=hooks(),calls=[],timers=[],listeners=new Set();let handle,playbackStops=0;
  const appState={currentState:'active',addEventListener:(_event,fn)=>{listeners.add(fn);return{remove:()=>listeners.delete(fn)};}};
  const api=apiFixture((url,init)=>{const call={url,path:new URL(url).pathname,...init};calls.push(call);return handle(call);},apiGlobals);
  const {pendingModule,memoryStorage}=require('./pending-fixture.cjs');
  const pending=pendingModule(api,memoryStorage());
  const cache=load('lib/history-cache.ts',{'./api':api,'@replybot/core/api':core},{Map,Set});
  const component=load('lib/app-state.tsx',{'react':h.react,'react-native':{useColorScheme:()=> 'light',AppState:appState},'expo-constants':{},'zod':require('zod'),
    '@replybot/core/contracts':contracts,'@replybot/core/api':core,'./api':api,'./history-cache':cache,'./media-cache':{MediaCache:class{dispose(){}setForeground(){}}},'./pending-intents':pending,
    './client-clock':{ClientClock:class{calibrate(){}}},'./audio-lane':{stopPlayback:()=>playbackStops++},
    './storage':{readSetting:async key=>key==='replybot-session'?saved:null,saveSetting:save,getClientId:async()=> 'synthetic'},'./theme':{palettes:{dark:{},light:{}}}},
    {URL,Map,AbortController,setTimeout,clearTimeout,setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){},...appGlobals});
  const render=()=>h.render(()=>component.AppProvider({children:null})).props.value;
  return {h,calls,timers,api,render,appState,foreground:state=>{appState.currentState=state;for(const fn of listeners)fn(state);},respond:fn=>{handle=fn;},stops:()=>playbackStops,
    async connect(value=scope()){
      handle=async call=>json(call.path==='/v1/session'?descriptor(value):snapshot(value));
      await render().connect('http://synthetic.local','synthetic-token');await render().continueProfile();return render();
    }};
}
module.exports={core,contracts,scope,descriptor,snapshot,json,apiFixture,providerFixture};
