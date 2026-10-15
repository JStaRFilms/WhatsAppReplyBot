const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load,nodes,label,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {core,contracts,scope,snapshot,apiFixture}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const matching=load('lib/contact-matching.ts',{'@replybot/core/api':core},{Map});
const chat=(number='15550001001',extra={})=>({...snapshot(scope()).conversations[0],id:'chat-'+number,contactId:number+'@s.whatsapp.net',nameSource:'wa_notify',...extra});
const names=(extra={})=>({enabled:true,revision:1,lastPhoneSyncAt:null,lastPhoneImportRequestId:null,...extra});
const button=(tree,value)=>{const result=nodes(tree).find(node=>node.props?.label===value);assert.ok(result,'Missing '+value);return result;};
const copy=tree=>nodes(tree).filter(node=>node.type==='text').map(node=>node.props.children).flat().join(' ');
function fixture({native=false,enabled=true,capabilities=true,readNames}={}) {
  const h=lifecycleHooks(),calls=[],events=new Set();let serverInstructions={text:'Original saved instructions',revision:1},serverNames=names({enabled}),mutateHandler,foreground=true,contactReads=0;
  const api=apiFixture(()=>assert.fail('No network'));
  const app={palette:{},acceptedScope:scope(),discovery:{capabilities:capabilities?{ownerInstructions:true,contactBookNames:true}:{}},snapshot:{...snapshot(scope()),conversations:[chat()]},status:'online',
    client:{request:async(route,schema)=>{calls.push({route,read:true});return schema.parse(route==='/v1/owner-instructions'?serverInstructions:serverNames);}},
    mutate:async(route,schema,payload)=>{calls.push({route,payload});return schema.parse(await mutateHandler(route,payload));}};
  mutateHandler=async(route,payload)=>route==='/v1/owner-instructions'?{text:payload.text,revision:payload.expectedRevision+1}:route.endsWith('/import')?{settings:names({revision:payload.expectedRevision+1,lastPhoneSyncAt:10,lastPhoneImportRequestId:payload.requestId})}:names({enabled:payload.enabled,revision:payload.expectedRevision+1});
  const component=load('components/release-settings.tsx',{react:h.react,'react-native':{Text:'text',TextInput:'input',View:'view',AppState:{addEventListener:(_name,fn)=>{events.add(fn);return{remove:()=>events.delete(fn)};}}},
    '@replybot/core/api':core,'../lib/app-state':{useApp:()=>app},'../lib/api':api,'../lib/foreground':{isForeground:()=>foreground},
    '../lib/phone-contacts':{canReadPhoneContacts:native,readMatchedNames:async(...args)=>{contactReads++;return readNames?readNames(...args):[{conversationId:chat().id,name:'Invented name'}];}},
    '../lib/uuid':{randomUUID:(()=>{let serial=0;return()=> 'settings-request-'+(++serial);})()},'../lib/theme':{fonts:{}},'./ui':{Button:'button'}},{});
  const render=()=>h.commit(component.ReleaseSettings);
  return{h,app,calls,api,render,async ready(){render();await settle();return render();},
    respond:fn=>{mutateHandler=fn;},serverInstructions:value=>{serverInstructions=value;},serverNames:value=>{serverNames=value;},
    reads:()=>contactReads,foreground:value=>{foreground=value;for(const fn of events)fn(value?'active':'background');},};
}
test('owner instructions use explicit revisioned save/reset; response alone proves saved and newer edits survive',async()=>{
  const f=fixture(),pending=deferred();let tree=await f.ready();assert.equal(f.calls.filter(c=>c.payload).length,0);
  const editor=()=>label(f.render(),'About me and reply instructions');editor().props.onChangeText('Owner punctuation \u2014 unchanged');
  f.respond(()=>pending.promise);button(f.render(),'Save instructions').props.onPress();tree=f.render();assert.match(copy(tree),/Saving instructions/);assert.doesNotMatch(copy(tree),/Instructions saved\./);
  editor().props.onChangeText('Newer unsaved owner text');pending.resolve({text:'Owner punctuation \u2014 unchanged',revision:2});await settle();
  assert.equal(editor().props.value,'Newer unsaved owner text');assert.match(copy(f.render()),/newer edits are not saved/);
  assert.equal(f.calls.find(c=>c.payload).payload.text,'Owner punctuation \u2014 unchanged');
  f.respond(async(_route,payload)=>({text:payload.text,revision:3}));editor().props.onChangeText('');button(f.render(),'Save instructions').props.onPress();await settle();
  assert.equal(f.calls.filter(c=>c.payload).at(-1).payload.expectedRevision,2);assert.equal(f.calls.filter(c=>c.payload).at(-1).payload.text,'');assert.match(copy(f.render()),/Instructions saved/);f.h.unmount();
});
test('instruction byte/code point/control bounds reject without silent truncation; CAS conflict keeps unsaved text and offers explicit reload',async()=>{
  const f=fixture();await f.ready();
  for(const text of ['a'.repeat(2001),'界'.repeat(1400),'bad\u0001control']){
    label(f.render(),'About me and reply instructions').props.onChangeText(text);button(f.render(),'Save instructions').props.onPress();await settle();
    assert.equal(f.calls.filter(c=>c.payload).length,0);assert.equal(label(f.render(),'About me and reply instructions').props.value,text);
  }
  label(f.render(),'About me and reply instructions').props.onChangeText('Keep my unsaved edits');
  f.respond(async()=>{throw new f.api.ApiError('owner_instructions_changed');});button(f.render(),'Save instructions').props.onPress();await settle();
  assert.match(copy(f.render()),/Your edits are kept/);assert.equal(label(f.render(),'About me and reply instructions').props.value,'Keep my unsaved edits');
  f.serverInstructions({text:'Other client saved text',revision:2});button(f.render(),'Reload saved instructions').props.onPress();await settle();assert.equal(label(f.render(),'About me and reply instructions').props.value,'Other client saved text');f.h.unmount();
});
test('missing capabilities disable extension controls; browser never reads native contacts; offline settings cannot claim synchronization',async()=>{
  const unsupported=fixture({capabilities:false});const tree=await unsupported.ready();assert.equal(unsupported.calls.length,0);assert.match(copy(tree),/unavailable/);assert.equal(nodes(tree).filter(n=>n.type==='input').length,0);unsupported.h.unmount();
  const f=fixture({enabled:false});await f.ready();button(f.render(),'Enable saved names').props.onPress();await settle();assert.equal(f.reads(),0);assert.match(copy(f.render()),/Browser uses names synchronized/);
  f.app.status='offline';assert.equal(button(f.render(),'Reload name settings').props.disabled,true);assert.equal(button(f.render(),'Turn saved names off').props.disabled,true);assert.doesNotMatch(copy(f.render()),/Matched names synchronized/);f.h.unmount();
});
test('native reads are explicit only, import is one bounded atomic request with matched entries only and exact acknowledgment',async()=>{
  const f=fixture({native:true});await f.ready();assert.equal(f.reads(),0);
  button(f.render(),'Sync matched names').props.onPress();await settle();const writes=f.calls.filter(c=>c.payload);assert.equal(f.reads(),1);assert.equal(writes.length,1);assert.equal(writes[0].route,'/v1/contact-names/import');
  assert.deepEqual(Object.keys(writes[0].payload).sort(),['entries','expectedRevision','requestId']);assert.equal(writes[0].payload.entries[0].name,'Invented name');assert.doesNotMatch(JSON.stringify(writes),/phoneNumbers|rawNumber|contactId/);
  assert.match(copy(f.render()),/Matched names synchronized/);assert.match(copy(f.render()),/Last committed phone sync/);f.h.unmount();
});
test('lost import acknowledgment reconciles only exact request ID, never a timestamp or automatic replay',async()=>{
  const f=fixture({native:true});await f.ready();f.respond(async()=>{throw new f.api.UnconfirmedMutationError();});
  button(f.render(),'Sync matched names').props.onPress();await settle();const request=f.calls.find(c=>c.payload).payload.requestId;
  assert.match(copy(f.render()),/Import unconfirmed/);assert.equal(button(f.render(),'Sync matched names').props.disabled,true);
  f.serverNames(names({lastPhoneSyncAt:10,lastPhoneImportRequestId:'another-request'}));button(f.render(),'Check sync status').props.onPress();await settle();assert.match(copy(f.render()),/still unconfirmed/);
  f.serverNames(names({lastPhoneSyncAt:10,lastPhoneImportRequestId:request}));button(f.render(),'Check sync status').props.onPress();await settle();assert.match(copy(f.render()),/Matched names synchronized/);assert.equal(f.calls.filter(c=>c.payload).length,1);f.h.unmount();
});
test('off/scope/background invalidate local import data; off explains Android permission stays separate',async()=>{
  for(const mode of ['off','scope','background']){
    const contacts=deferred(),f=fixture({native:true,readNames:()=>contacts.promise});await f.ready();button(f.render(),'Sync matched names').props.onPress();f.render();
    if(mode==='off'){button(f.render(),'Turn saved names off').props.onPress();await settle();assert.match(copy(f.render()),/Android Contacts permission is unchanged/);}
    if(mode==='scope')f.h.unmount();
    if(mode==='background'){f.foreground(false);f.foreground(true);}
    contacts.resolve([{conversationId:chat().id,name:'Late matched name'}]);await settle();
    assert.equal(f.calls.filter(c=>c.route.endsWith('/import')).length,0);if(mode==='background')assert.match(copy(f.render()),/sync stopped/);if(mode!=='scope')f.h.unmount();
  }
});
test('denied permission and revision conflict leave earlier sync visible without claiming a new commit or retrying',async()=>{
  const denied=fixture({native:true,readNames:async()=>{throw new Error('Contacts permission denied. Nothing imported.');}});await denied.ready();button(denied.render(),'Sync matched names').props.onPress();await settle();assert.match(copy(denied.render()),/permission denied/);assert.equal(denied.calls.filter(c=>c.payload).length,0);denied.h.unmount();
  const f=fixture({native:true});await f.ready();f.respond(async()=>{throw new f.api.ApiError('contact_names_changed');});button(f.render(),'Sync matched names').props.onPress();await settle();assert.match(copy(f.render()),/Reload and choose Sync matched names again explicitly/);assert.equal(f.calls.filter(c=>c.payload).length,1);f.h.unmount();
});
test('profile unmount drops unsaved instructions and ignores late save, with no cross-profile editor storage',async()=>{
  const f=fixture(),ack=deferred();await f.ready();label(f.render(),'About me and reply instructions').props.onChangeText('Profile A unsaved private preferences');
  f.respond(()=>ack.promise);button(f.render(),'Save instructions').props.onPress();f.h.unmount();
  const next=fixture();next.serverInstructions({text:'Profile B instructions',revision:0});await next.ready();ack.resolve({text:'Profile A unsaved private preferences',revision:2});await settle();
  assert.equal(label(next.render(),'About me and reply instructions').props.value,'Profile B instructions');next.h.unmount();
});
test('international matching is exact, ignores saved WhatsApp/group/LID/other-account chats and rejects conflicting names',async()=>{
  const targets=[chat(),chat('15550001002'),chat('15550001003',{nameSource:'wa_saved'}),chat('15550001004',{kind:'group'}),chat('15550001005',{contactId:'15550001005@lid'}),chat('15550001006',{accountId:'another'})];
  const input=[{name:'Matched',phoneNumbers:[{number:'+1 (555) 000-1001'}]},{name:'Conflict A',phoneNumbers:[{number:'+15550001002'}]},{name:'Conflict B',phoneNumbers:[{number:'+15550001002'}]},
    {name:'No explicit country',phoneNumbers:[{number:'5550001001'},{number:'0015550001001'}]},...targets.slice(2).map(c=>({name:'Ineligible',phoneNumbers:[{number:'+'+c.id.slice(5)}]}))];
  const entries=await matching.collectMatchedNames(targets,scope().accountId,async()=>({data:input,hasNextPage:false}),()=>true);
  assert.equal(entries.length,1);assert.equal(entries[0].conversationId,chat().id);assert.equal(entries[0].name,'Matched');
});
test('paging discards unmatched data, rejects more than 500 matches without truncation, and empty success remains an atomic clear',async()=>{
  const targets=Array.from({length:501},(_,i)=>chat(String(15550002000+i)));let pages=0;
  const read=async offset=>{pages++;return{data:targets.slice(offset,offset+100).map(c=>({name:'Invented '+c.id,phoneNumbers:[{number:'+'+c.contactId.split('@')[0]}]})),hasNextPage:offset+100<targets.length};};
  await assert.rejects(matching.collectMatchedNames(targets,scope().accountId,read,()=>true),/More than 500/);assert.equal(pages,6);
  const empty=await matching.collectMatchedNames([chat()],scope().accountId,async()=>({data:[{name:'Unmatched private book data',phoneNumbers:[{number:'+15559999999'}]}],hasNextPage:false}),()=>true);assert.equal(empty.length,0);
  assert.equal(core.ContactNamesImportInput.safeParse({requestId:'empty',expectedRevision:1,entries:empty}).success,true);
});
test('native public legacy API checks existing permission, selects only name/phone paged fields, and handles denial/revocation without repeated prompt',async()=>{
  for(const mode of ['granted','denied','restricted','revoked','background']){
    let checks=0,requests=0,queries=0,valid=true;
    const permission={granted:mode==='granted'||mode==='revoked'||mode==='background',canAskAgain:mode!=='restricted'};
    const native=load('lib/phone-contacts.ts',{'react-native':{Platform:{OS:'android'}},'expo-contacts/legacy':{
      Fields:{Name:'name',PhoneNumbers:'phoneNumbers'},getPermissionsAsync:async()=>{checks++;if(mode==='background')valid=false;return mode==='revoked' && checks>1?{granted:false,canAskAgain:true}:permission;},
      requestPermissionsAsync:async()=>{requests++;return{granted:false};},getContactsAsync:async query=>{queries++;assert.deepEqual(Array.from(query.fields),['name','phoneNumbers']);assert.equal(query.pageSize,100);assert.equal(query.pageOffset,0);return{data:[{name:'Invented name',phoneNumbers:[{number:'+15550001001'}]}],hasNextPage:false};}},
      './contact-matching':matching});
    if(mode==='granted'){const entries=await native.readMatchedNames([chat()],scope().accountId,()=>valid);assert.equal(entries.length,1);assert.equal(queries,1);assert.equal(requests,0);}
    else{await assert.rejects(native.readMatchedNames([chat()],scope().accountId,()=>valid));assert.equal(queries,0);assert.equal(requests,mode==='denied'?1:0);}
  }
  const web=load('lib/phone-contacts.web.ts');assert.equal(web.canReadPhoneContacts,false);await assert.rejects(web.readMatchedNames([],scope().accountId,()=>true),/Browser cannot/);
});
test('Contacts dependency is exact; Android config explicitly blocks WRITE and plugin declares READ, with release manifest verification still required',()=>{
  const root=path.resolve(__dirname,'..'),config=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo;
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));assert.equal(pkg.dependencies['expo-contacts'],'57.0.7');
  assert.ok(config.android.blockedPermissions.includes('android.permission.WRITE_CONTACTS'));assert.ok(config.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-contacts'));
  const plugin=fs.readFileSync(path.join(root,'node_modules/expo-contacts/plugin/src/withContacts.ts'),'utf8');assert.match(plugin,/android.permission.READ_CONTACTS/);
  const source=fs.readFileSync(path.join(root,'lib/phone-contacts.ts'),'utf8');assert.doesNotMatch(source,/WRITE_CONTACTS|Contacts\.Fields\.(Emails|Image|Birthday|Note)/);
  const mobileRequire=require('node:module').createRequire(path.join(root,'package.json'));
  const {AndroidConfig}=mobileRequire('expo/config-plugins');
  const applyContacts=mobileRequire('expo-contacts/app.plugin.js').default;
  const generated=applyContacts(structuredClone(config),{contactsPermission:'Synthetic permission test'});
  const manifest=AndroidConfig.Permissions.setAndroidPermissions(generated,{manifest:{$:{},application:[]}});
  AndroidConfig.Permissions.addBlockedPermissions(manifest,config.android.blockedPermissions);
  const permissions=manifest.manifest['uses-permission'];
  assert.ok(permissions.some(p=>p.$['android:name']==='android.permission.READ_CONTACTS' && p.$['tools:node']!=='remove'));
  assert.ok(permissions.filter(p=>p.$['android:name']==='android.permission.WRITE_CONTACTS').every(p=>p.$['tools:node']==='remove'));
  assert.ok(permissions.some(p=>p.$['android:name']==='android.permission.WRITE_CONTACTS' && p.$['tools:node']==='remove'));
});
