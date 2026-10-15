const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hooks,deferred}=require('./render-harness.cjs');
const {scope}=require('./profile-fixture.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(storage){
  const h=hooks();let app={baseUrl:'http://synthetic.local',acceptedScope:scope(),reportError:assert.fail};const timers=[];
  const component=load('lib/local-drafts.tsx',{'react':h.react,'@react-native-async-storage/async-storage':storage,'zod':require('zod'),'./app-state':{useApp:()=>app}},
    {Set,Object,clearTimeout(){},setTimeout:fn=>{timers.push(fn);return timers.length;}});
  return {h,timers,remount:()=>{const next=hooks();Object.assign(h.react,next.react);h.render=next.render;h.flush=next.flush;},render:()=>h.render(()=>component.LocalDraftProvider({children:null})).props.value,account:id=>{app={...app,acceptedScope:{...scope(),accountId:id}};}};
}
test('late local draft load after disposal stays inert and cannot write into a returning same-account store',async()=>{
  const loaded=deferred(),writes=[];const f=fixture({getItem:()=>loaded.promise,setItem:async(key,json)=>writes.push({key,json})});
  const old=f.render();const cleanup=f.h.flush();cleanup.forEach(fn=>fn());
  loaded.resolve(JSON.stringify({'same-jid':'Old local draft'}));await settle();
  old.set('same-jid','Late picker callback');f.timers.forEach(fn=>fn());await settle();
  assert.equal(writes.length,0);assert.equal(old.ready,false);
});
test('disposed ready stores ignore old composer callbacks; drafts remain URL/account scoped with no migration',async()=>{
  const writes=[],reads=[];const a=scope().accountId,b=scope('second',1).accountId;
  const f=fixture({getItem:async key=>{reads.push(key);return JSON.stringify({'same-jid':key.endsWith(a)?'Original local draft':'Separate local draft'});},setItem:async(key,json)=>writes.push({key,json})});
  const first=f.render();const cleanup=f.h.flush();await settle();assert.equal(first.get('same-jid'),'Original local draft');
  first.set('same-jid','Preserved edit');cleanup.forEach(fn=>fn());await settle();
  const written=writes.length;first.set('same-jid','Late old composer');f.timers.forEach(fn=>fn());await settle();assert.equal(writes.length,written);
  f.account(b);const second=f.render();f.h.flush();await settle();assert.equal(second.get('same-jid'),'Separate local draft');
  assert.notEqual(reads[0],reads[1]);assert.ok(reads[0].endsWith(a));assert.ok(reads[1].endsWith(b));assert.ok(writes.every(row=>row.key.endsWith(a)));
});
test('a same-account remount waits for previous pending draft writes before loading',async()=>{
  const pending=deferred();let stored=JSON.stringify({'same-jid':'Saved before edit'}),reads=0;
  const storage={getItem:async()=>{reads++;return stored;},setItem:async(_key,json)=>{await pending.promise;stored=json;}};
  const first=fixture(storage),old=first.render(),cleanup=first.h.flush();await settle();old.set('same-jid','Final preserved edit');cleanup.forEach(fn=>fn());await settle();
  first.remount();const fresh=first.render();first.h.flush();await settle();
  assert.equal(fresh.ready,false);assert.equal(reads,1);
  pending.resolve();await settle();assert.equal(fresh.ready,true);assert.equal(fresh.get('same-jid'),'Final preserved edit');
});
