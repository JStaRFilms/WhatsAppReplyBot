const test=require('node:test');
const assert=require('node:assert/strict');
const {load,nodes,label}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {core,scope,snapshot,apiFixture}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const copy=tree=>nodes(tree).filter(n=>n.type==='text').flatMap(n=>n.props.children).join(' ');
const button=(tree,name)=>{const result=nodes(tree).find(n=>n.props?.label===name);assert.ok(result,'Missing '+name);return result;};
function fixture(native=true) {
  const h=lifecycleHooks(),calls=[],api=apiFixture(()=>assert.fail('No network'));let reads=0;
  const app={palette:{},client:{request:async path=>path.endsWith('owner-instructions')?{text:'Saved instructions',revision:3}:{enabled:true,revision:1,lastPhoneSyncAt:null,lastPhoneImportRequestId:null}},
    acceptedScope:scope(),snapshot:snapshot(scope()),discovery:{capabilities:{ownerInstructions:true,contactBookNames:true}},status:'online',
    mutate:async(path,schema,payload)=>{calls.push({path,payload});return path.endsWith('owner-instructions')?{text:payload.text,revision:4}:{settings:{enabled:true,revision:2,lastPhoneSyncAt:10,lastPhoneImportRequestId:payload.requestId}};}};
  const component=load('components/release-settings.tsx',{react:h.react,'react-native':{View:'view',Text:'text',TextInput:'input',AppState:{addEventListener:()=>({remove(){}})}},
    '@replybot/core/api':core,'../lib/app-state':{useApp:()=>app},'../lib/api':api,'../lib/foreground':{isForeground:()=>true},
    '../lib/phone-contacts':{canReadPhoneContacts:native,readMatchedNames:async()=>{reads++;return[];}},'../lib/uuid':{randomUUID:()=> 'ui58-explicit-action'},'../lib/theme':{fonts:{}},'./ui':{Button:'button'}});
  return{h,app,calls,reads:()=>reads,render:()=>h.commit(component.ReleaseSettings),async ready(){this.render();await settle();return this.render();}};
}
test('ui58 instructions remove routine work commentary, retain storage/export consequences and reject byte overflow unchanged',async()=>{
  const f=fixture(),tree=await f.ready(),text=copy(tree);
  assert.doesNotMatch(text,/Loaded saved|existing consent|approval authority|UTF-8 bytes|bounded foreground pages/);
  for(const fact of ['Saved on your PC for this profile','Used for AI replies when enabled','Do not paste secrets','2,000 characters','4,000-byte limit','Saving empty text clears it','pending AI drafts outdated','cancel unsent AI replies','cannot be recalled'])assert.ok(text.includes(fact),'Missing '+fact);
  assert.equal(f.calls.length,0);assert.equal(f.reads(),0);
  label(f.render(),'About me and reply instructions').props.onChangeText('界'.repeat(1400));button(f.render(),'Save instructions').props.onPress();await settle();
  assert.equal(f.calls.length,0);assert.match(copy(f.render()),/4,000 UTF-8 bytes/);
  label(f.render(),'About me and reply instructions').props.onChangeText('');button(f.render(),'Save instructions').props.onPress();await settle();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.text,'');assert.equal(f.calls[0].payload.expectedRevision,3);assert.match(copy(f.render()),/Instructions saved/);f.h.unmount();
});
test('ui58 Android consent keeps book-wide breadth and exact exported categories without automatic contact or AI actions',async()=>{
  const f=fixture(),text=copy(await f.ready());
  for(const fact of ['access to all contacts','Names and phone numbers','foreground','Only matched chat IDs and names','Unmatched contacts and raw numbers are not uploaded or saved','Android permission stays unchanged'])assert.ok(text.includes(fact),'Missing '+fact);
  assert.equal(f.reads(),0);assert.equal(f.calls.length,0);button(f.render(),'Sync matched names').props.onPress();await settle();
  assert.equal(f.reads(),1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/v1/contact-names/import');assert.equal(f.calls[0].payload.entries.length,0);f.h.unmount();
  const browser=fixture(false),tree=await browser.ready();assert.match(copy(tree),/Browser uses names synchronized to the PC/);assert.equal(nodes(tree).some(n=>n.props?.label==='Sync matched names'),false);assert.equal(browser.reads(),0);browser.h.unmount();
});
