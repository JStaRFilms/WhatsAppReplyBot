const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {webcrypto}=require('node:crypto');
function load(file,modules,globals={}) {
  const source=fs.readFileSync(path.join(__dirname,'../lib',file),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const exports={};vm.runInNewContext(outputText,{exports,require:name=>{assert.ok(name in modules,'Unexpected module '+name);return modules[name];},...globals});return exports;
}
test('native foreground uses AppState even when window exists without DOM event methods',()=>{
  let effect,cleanup,listener,state,removed=false;
  const appState={currentState:'active',addEventListener:(event,callback)=>{assert.equal(event,'change');listener=callback;return{remove:()=>{removed=true;}};}};
  const react={useState:initial=>{state=initial();return[state,value=>{state=value;}];},useEffect:callback=>{effect=callback;}};
  const hook=load('foreground.ts',{'react':react,'react-native':{AppState:appState}},{window:{}});
  assert.equal(hook.isForeground(),true);assert.equal(hook.useForeground(),true);cleanup=effect();
  appState.currentState='background';listener();assert.equal(state,false);
  appState.currentState='active';listener();assert.equal(state,true);cleanup();assert.equal(removed,true);
});
test('video plugin disables both PiP activities in memory, rejects background config and preserves release/Contacts constraints',async()=>{
  const {createRequire}=require('node:module');
  const mobileRequire=createRequire(path.resolve(__dirname,'../package.json'));
  const {expo}=mobileRequire('./app.json');
  const {AndroidConfig}=mobileRequire('expo/config-plugins');
  const withVideo=mobileRequire('expo-video/app.plugin.js').default;
  const withContacts=mobileRequire('expo-contacts/app.plugin.js').default;
  const withRelease=mobileRequire('./plugins/with-otherme-release.cjs');
  assert.equal(mobileRequire('expo-video/package.json').version,'57.0.5');
  assert.equal(mobileRequire('./package.json').dependencies['expo-video'],'57.0.5');
  const options=expo.plugins.find(plugin=>Array.isArray(plugin) && plugin[0]==='expo-video')[1];
  assert.deepEqual(options,{supportsBackgroundPlayback:false,supportsPictureInPicture:false});
  assert.equal(expo.version,'0.1.4');assert.equal(expo.android.versionCode,5);assert.equal(expo.android.package,'com.jstarstudios.otherme');
  for(const permission of ['WRITE_CONTACTS','SYSTEM_ALERT_WINDOW','READ_MEDIA_AUDIO','FOREGROUND_SERVICE','FOREGROUND_SERVICE_MEDIA_PLAYBACK'])assert.ok(expo.android.blockedPermissions.includes('android.permission.'+permission));
  function config(){
    let result=withRelease({...expo});result=withVideo(result,options);result=withContacts(result,{});
    return AndroidConfig.Permissions.withBlockedPermissions(result,expo.android.blockedPermissions);
  }
  const manifest=()=>({manifest:{$:{'xmlns:android':'http://schemas.android.com/apk/res/android'},application:[{$:{},activity:[{$:{'android:name':'.MainActivity','android:supportsPictureInPicture':'true','tools:replace':'android:theme'}}]}]}});
  const run=async value=>{const configured=config();return(await configured.mods.android.manifest({...configured,modResults:value,modRequest:{platform:'android',modName:'manifest',projectRoot:path.resolve(__dirname,'..'),introspect:true}})).modResults;};
  const result=await run(manifest()),app=result.manifest.application[0];
  for(const name of ['.MainActivity','expo.modules.video.FullscreenPlayerActivity']){
    const activity=app.activity.find(activity=>activity.$['android:name']===name);
    assert.equal(activity.$['android:supportsPictureInPicture'],'false');assert.ok(activity.$['tools:replace'].split(',').includes('android:supportsPictureInPicture'));
  }
  assert.ok(app.activity[0].$['tools:replace'].includes('android:theme'));assert.equal(result.manifest.$['xmlns:tools'],'http://schemas.android.com/tools');
  assert.equal(app.$['android:allowBackup'],'false');assert.equal(app.$['android:usesCleartextTraffic'],'true');
  assert.equal(app.service?.some(service=>service.$['android:name'].includes('ExpoVideoPlaybackService')) ?? false,false);
  const permissions=result.manifest['uses-permission'] ?? [];
  assert.ok(permissions.some(permission=>permission.$['android:name']==='android.permission.READ_CONTACTS' && permission.$['tools:node']!=='remove'));
  for(const name of ['WRITE_CONTACTS','FOREGROUND_SERVICE','FOREGROUND_SERVICE_MEDIA_PLAYBACK'])assert.ok(!permissions.some(permission=>permission.$['android:name']==='android.permission.'+name && permission.$['tools:node']!=='remove'));
  assert.deepEqual(await run(result),result,'manifest override is idempotent');
  const contaminated=manifest();contaminated.manifest.application[0].service=[{$:{'android:name':'expo.modules.video.playbackService.ExpoVideoPlaybackService'}}];
  await assert.rejects(run(contaminated),/background service/);
  const plist=await config().mods.ios.infoPlist({modResults:{UIBackgroundModes:['audio','unrelated']},modRequest:{platform:'ios',modName:'infoPlist',introspect:true}});
  assert.deepEqual(plist.modResults.UIBackgroundModes,['unrelated']);
});
test('request IDs are valid unique UUIDv4 values without crypto.randomUUID',()=>{
  let calls=0;
  const crypto={getRandomValues:bytes=>{calls++;return webcrypto.getRandomValues(bytes);}};
  const ids=load('uuid.ts',{'expo-crypto':crypto},{Uint8Array,DataView});
  const values=Array.from({length:100},()=>ids.randomUUID());assert.equal(calls,100);
  assert.ok(values.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  assert.equal(new Set(values).size,100);
});
