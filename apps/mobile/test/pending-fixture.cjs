const {load}=require('./render-harness.cjs');
const {core,contracts,scope}=require('./profile-fixture.cjs');
const lease=load('lib/media-lease.ts',{}, {WeakMap,URL});
function pendingModule(api,storage) {
  let serial=0;
  return load('lib/pending-intents.ts',{
    '@react-native-async-storage/async-storage':storage,
    zod:require('zod'),'@replybot/core/contracts':contracts,'@replybot/core/api':core,'./api':api,
    './uuid':{randomUUID:()=> 'intent-'+(++serial)},'./media-lease':lease,
  },{Map,Set});
}
function memoryStorage(){const values=new Map();return{values,getItem:async key=>values.get(key)??null,setItem:async(key,value)=>{values.set(key,value);}};}
function outbox(requestId,state='accepted',chat='chat',accountId='whatsapp-owner') {
  return {id:'outbox-'+requestId,requestId,state,accountId,conversationId:chat,workflowVersion:1,policyVersion:1,
    action:{kind:'text',text:'Synthetic reply',reason:'Owner reply'},origin:'owner_manual',
    components:[{id:'component-'+requestId,kind:'text',text:'Synthetic reply',reaction:null,state:state==='partial'?'unknown':state,transportId:'wa-'+requestId}],
    quotedMessageId:null,grantId:null,units:1,transportId:'wa-'+requestId,authoredAs:'owner_written',createdAt:1};
}
module.exports={pendingModule,memoryStorage,lease,outbox,scope};
