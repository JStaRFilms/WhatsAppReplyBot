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
test('request IDs are valid unique UUIDv4 values without crypto.randomUUID',()=>{
  let calls=0;
  const crypto={getRandomValues:bytes=>{calls++;return webcrypto.getRandomValues(bytes);}};
  const ids=load('uuid.ts',{'expo-crypto':crypto},{Uint8Array,DataView});
  const values=Array.from({length:100},()=>ids.randomUUID());assert.equal(calls,100);
  assert.ok(values.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  assert.equal(new Set(values).size,100);
});
