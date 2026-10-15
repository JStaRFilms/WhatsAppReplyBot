const test=require('node:test');
const assert=require('node:assert/strict');
const {load,deferred}=require('./render-harness.cjs');
const {apiFixture,scope,core,json}=require('./profile-fixture.cjs');
const {z}=require('zod');
const api=apiFixture(()=>assert.fail('No real network'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const ns='00000000-0000-4000-8000-000000000001';
const reference=(id='photo')=>({id,conversationId:'physical',accountId:scope().accountId,transportId:'transport-'+id});
function storageFixture(){const records=new Map(),bodies=new Map(),events=[];let broken=false,unlink=false;
  const storage={persistent:true,list:async()=>[...records.values()],read:async record=>{if(broken || !bodies.has(JSON.stringify(record.key)))return null;const uri='blob:synthetic-'+events.length;events.push(['url',uri]);return{uri,release:()=>events.push(['release',uri])};},
    write:async(record,bytes)=>{events.push(['write',record.key]);if(broken)throw new Error('Partial write');records.set(JSON.stringify(record.key),{...record});bodies.set(JSON.stringify(record.key),new Uint8Array(bytes));},
    touch:async record=>{records.set(JSON.stringify(record.key),{...record});},remove:async record=>{events.push(['unlink',record.key]);if(unlink)throw new Error('Synthetic unlink failure');records.delete(JSON.stringify(record.key));bodies.delete(JSON.stringify(record.key));},
    sweep:async keys=>{events.push(['sweep']);for(const key of bodies.keys())if(!keys.some(value=>JSON.stringify(value)===key))bodies.delete(key);}};
  return {storage,records,bodies,events,corrupt:value=>{broken=value;},unlink:value=>{unlink=value;}};
}
function fixture(saved=storageFixture(),module){
  let now=100000,mono=0,version='a'.repeat(64),namespace=ns,state='available',offline=false,revoked=false,held=null;const calls=[],timers=[];
  const {MediaCache}=module ?? load('lib/media-cache.ts',{'zod':{z},'./api':api,'./media-cache-storage':{createMediaStorage:()=>saved.storage}},
    {URL,Uint8Array,AbortController,performance:{now:()=>mono},setTimeout:(fn,ms)=>ms===0?setTimeout(fn,0):{synthetic:true},clearTimeout:timer=>{if(!timer?.synthetic)clearTimeout(timer);},setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){}});
  const client={baseUrl:'http://SYNTHETIC.local:80/service/',scope:scope(),assertActive(){if(revoked)throw new Error('Revoked client');},
    async mediaSource(chat,id,variant){calls.push(['metadata',id,variant]);if(offline)throw new Error('Offline');return{cacheNamespace:namespace,conversationId:chat,messageId:id,sourceVersion:version,variant,state,mime:state==='available'?variant==='image'?'image/jpeg':variant==='video'?'video/mp4':'image/png':null,maxBytes:variant==='video'?10*1024*1024:4*1024*1024,expiresAt:null,validatedAt:now,validUntil:now+30000};},
    async mediaContent(source,signal){calls.push(['binary',source.messageId,source.variant]);if(held)await held.promise;client.assertActive();if(signal.aborted)throw new Error('Aborted');return{mime:source.mime,bytes:new Uint8Array([1,2,3])};}};
  const cache=new MediaCache(client,{now:()=>now},saved.storage,()=>mono);
  return {cache,client,calls,timers,saved,MediaCache,
    tick:async ms=>{now+=ms;mono+=ms;for(const tick of timers)tick();await settle();},offline:value=>{offline=value;},state:value=>{state=value;},version:value=>{version=value;},namespace:value=>{namespace=value;},
    hold:()=>held=deferred(),release:()=>{held?.resolve();held=null;},revoke:()=>{revoked=true;cache.dispose();},close:()=>cache.dispose(false)};
}
test('the unconfigured pre-discovery binding needs no URL or storage access and cannot display media',async()=>{
  const f=fixture(),client={baseUrl:'',scope:undefined,assertActive(){}};const cache=new f.MediaCache(client,{now:()=>100},{persistent:true,list:()=>assert.fail('Unaccepted binding must not inspect media storage')});
  await assert.rejects(cache.acquire(reference(),'preview','thumbnail'),/inactive/);cache.dispose();f.close();
});

test('leave/reopen, foreground and process-style index reopen revalidate metadata but download each variant once',async()=>{
  const f=fixture();let handle=await f.cache.acquire(reference(),'preview','thumbnail');assert.equal(handle.getSnapshot(),true);handle.release();
  const before=f.calls.length;handle=await f.cache.acquire(reference(),'preview','thumbnail');assert.ok(f.calls.length>before);assert.equal(f.calls.filter(call=>call[0]==='binary').length,1);
  f.cache.setForeground(false);assert.equal(handle.getSnapshot(),false);handle.release();f.cache.setForeground(true);await settle();
  handle=await f.cache.acquire(reference(),'preview','thumbnail');handle.release();assert.equal(f.calls.filter(call=>call[0]==='binary').length,1);
  f.close();const reopened=fixture(f.saved);handle=await reopened.cache.acquire(reference(),'preview','thumbnail');assert.equal(reopened.calls.filter(call=>call[0]==='binary').length,0);handle.release();
  const photo=await reopened.cache.acquire(reference(),'image','viewer');assert.equal(reopened.calls.filter(call=>call[0]==='binary').length,1);photo.release();reopened.close();
});
test('foreground metadata starts a current read; old completion cannot delete its coalescing entry or refetch cached bytes',async()=>{
  const f=fixture();const initial=await f.cache.acquire(reference(),'preview','thumbnail');initial.release();
  const source=f.client.mediaSource.bind(f.client),gates=[];
  f.client.mediaSource=async(...args)=>{const value=await source(...args),gate=deferred();gates.push(gate);await gate.promise;return value;};
  const old=f.cache.acquire(reference(),'preview','thumbnail').catch(error=>error);await settle();
  f.cache.setForeground(false);f.cache.setForeground(true);
  const current=f.cache.acquire(reference(),'preview','thumbnail');await settle();
  assert.equal(gates.length,2,'Current foreground must not join old activity metadata');
  gates[0].resolve();assert.ok(await old instanceof Error);
  const joined=f.cache.acquire(reference(),'preview','thumbnail');await settle();
  assert.equal(gates.length,2,'Old finally must not delete the current pending metadata');
  gates[1].resolve();const handles=await Promise.all([current,joined]);assert.ok(handles.every(handle=>handle.getSnapshot()));
  assert.equal(f.calls.filter(call=>call[0]==='binary').length,1);handles.forEach(handle=>handle.release());f.close();
});

test('a canceled old metadata denial cannot revoke a current foreground handle',async()=>{
  const f=fixture(),source=f.client.mediaSource.bind(f.client),oldGate=deferred();let count=0;
  const initial=await f.cache.acquire(reference(),'preview','thumbnail');initial.release();
  f.client.mediaSource=async(...args)=>{if(++count===1)await oldGate.promise;return source(...args);};
  const old=f.cache.acquire(reference(),'preview','thumbnail').catch(error=>error);await settle();
  f.cache.setForeground(false);f.cache.setForeground(true);
  const current=await f.cache.acquire(reference(),'preview','thumbnail');
  oldGate.reject(new api.ApiError('media_unavailable'));await old;await settle();assert.equal(current.getSnapshot(),true);
  assert.equal(f.calls.filter(call=>call[0]==='binary').length,1);current.release();f.close();
});

test('a canceled last download waiter cannot poison or delete a new current shared download',async()=>{
  const f=fixture(),gates=[],content=f.client.mediaContent.bind(f.client);
  f.client.mediaContent=async(...args)=>{const gate=deferred();gates.push(gate);await gate.promise;return content(...args);};
  const abort=new AbortController(),old=f.cache.acquire(reference(),'preview','thumbnail',abort.signal).catch(error=>error);await settle();abort.abort();
  const current=f.cache.acquire(reference(),'preview','thumbnail');await settle();
  assert.equal(gates.length,2,'A new visible consumer must not join an aborted download');
  gates[0].resolve();assert.ok(await old instanceof Error);
  const joined=f.cache.acquire(reference(),'preview','thumbnail');await settle();assert.equal(gates.length,2);
  gates[1].resolve();const handles=await Promise.all([current,joined]);assert.ok(handles.every(handle=>handle.getSnapshot()));handles.forEach(handle=>handle.release());f.close();
});

test('same source requests coalesce metadata/content; cancellation of one consumer does not revoke another lease',async()=>{
  const f=fixture(),held=f.hold(),abort=new AbortController();const a=f.cache.acquire(reference(),'preview','thumbnail',abort.signal),b=f.cache.acquire(reference(),'preview','thumbnail');
  await settle();abort.abort();held.resolve();await assert.rejects(a);const handle=await b;
  assert.equal(f.calls.filter(call=>call[0]==='binary').length,1);assert.equal(handle.getSnapshot(),true);handle.release();f.close();
});
test('no first validation offline, current leases expire, and foreground never treats retained bytes as authority',async()=>{
  const f=fixture();let handle=await f.cache.acquire(reference(),'preview','thumbnail');handle.release();f.offline(true);await assert.rejects(f.cache.acquire(reference(),'preview','thumbnail'),/Offline/);
  f.offline(false);handle=await f.cache.acquire(reference(),'preview','thumbnail');f.offline(true);assert.equal(await handle.revalidate(),false);assert.equal(handle.getSnapshot(),true);await f.tick(30001);assert.equal(handle.getSnapshot(),false);handle.release();
  assert.equal(f.saved.records.size,1);f.cache.setForeground(false);f.cache.setForeground(true);await assert.rejects(f.cache.acquire(reference(),'preview','thumbnail'),/Offline/);f.close();
});
test('known denial invalidates the decoded renderer before purge; failed unlink remains inaccessible and retries on sweep',async()=>{
  const f=fixture();const handle=await f.cache.acquire(reference(),'preview','thumbnail');let observed;
  handle.subscribe(()=>{observed={valid:handle.getSnapshot(),unlinks:f.saved.events.filter(event=>event[0]==='unlink').length};});f.saved.unlink(true);f.state('view_once');await f.cache.revalidate();
  assert.deepEqual(observed,{valid:false,unlinks:0});await settle();assert.equal(f.saved.events.filter(event=>event[0]==='unlink').length,0,'Renderer still owns its invalid lease');
  handle.release();await settle();assert.ok([...f.saved.records.values()].some(record=>record.pendingPurge));await assert.rejects(f.cache.acquire(reference(),'preview','thumbnail'));
  f.saved.unlink(false);await f.cache.sweep();assert.equal(f.saved.records.size,0);f.close();
});
test('source update or same-URL service namespace change never renders an old URI',async()=>{
  for(const change of ['version','namespace']){const f=fixture();const old=await f.cache.acquire(reference(),'preview','thumbnail');
    if(change==='version')f.version('b'.repeat(64));else f.namespace('00000000-0000-4000-8000-000000000002');
    await f.cache.revalidate();assert.equal(old.getSnapshot(),false);old.release();await settle();const current=await f.cache.acquire(reference(),'preview','thumbnail');
    assert.notEqual(current.uri,old.uri);assert.equal(f.calls.filter(call=>call[0]==='binary').length,2);current.release();f.close();}
});
test('source update, deletion, background and profile revocation during binary read cannot commit or publish',async()=>{
  for(const change of ['version','deleted','background','profile']){const f=fixture(),held=f.hold();const work=f.cache.acquire(reference(),'image','viewer');await settle();
    if(change==='version')f.version('b'.repeat(64));else if(change==='deleted')f.state('deleted');else if(change==='background')f.cache.setForeground(false);else f.revoke();
    held.resolve();await assert.rejects(work);await settle();assert.equal(f.saved.records.size,0);f.close();}
});
test('known invalidation during an asynchronous storage commit cannot publish a stale URI',async()=>{
  const f=fixture(),held=deferred(),write=f.saved.storage.write;let writing=false;
  f.saved.storage.write=async(...args)=>{writing=true;await held.promise;return write(...args);};
  const work=f.cache.acquire(reference(),'image','viewer');await settle();assert.equal(writing,true);f.cache.invalidate(reference());held.resolve();await assert.rejects(work,/changed/);
  await settle();await f.cache.sweep();assert.equal(f.saved.records.size,0);f.close();
});

test('private URL/viewer limits include resources retained by a replaced binding',async()=>{
  const f=fixture(),handles=await Promise.all([0,1,2,3].map(id=>f.cache.acquire(reference('old-'+id),'preview','thumbnail')));f.cache.dispose(false);
  const replacement=fixture(f.saved,{MediaCache:f.MediaCache});await assert.rejects(replacement.cache.acquire(reference('new'),'preview','thumbnail'),/Close other media/);
  handles.forEach(handle=>handle.release());const current=await replacement.cache.acquire(reference('new'),'preview','thumbnail');assert.equal(current.getSnapshot(),true);current.release();replacement.close();
});

test('partial/corrupt/OS-evicted content is a miss, and orphan bytes are swept before writes',async()=>{
  const f=fixture();let handle=await f.cache.acquire(reference(),'preview','thumbnail');handle.release();f.saved.bodies.clear();f.saved.bodies.set('orphan',new Uint8Array([1]));
  handle=await f.cache.acquire(reference(),'preview','thumbnail');handle.release();assert.equal(f.calls.filter(call=>call[0]==='binary').length,2);assert.equal(f.saved.bodies.has('orphan'),false);
  f.saved.corrupt(true);await assert.rejects(f.cache.acquire(reference('partial'),'preview','thumbnail'),/Partial write/);assert.ok(![...f.saved.records.values()].some(record=>record.key[5]==='partial'));f.close();
});
test('four live slots, one viewer and visible coverage include pending work; source variants and accounts do not collide',async()=>{
  const f=fixture();const handles=await Promise.all([0,1,2,3].map(id=>f.cache.acquire(reference('photo'+id),'preview','thumbnail')));
  await assert.rejects(f.cache.acquire(reference('fifth'),'preview','thumbnail'),/Close other media/);
  f.cache.setViewerOpen(true);assert.ok(handles.every(handle=>!handle.getSnapshot()));handles.forEach(handle=>handle.release());
  const held=f.hold(),first=f.cache.acquire(reference(),'image','viewer');await assert.rejects(f.cache.acquire(reference('second'),'image','viewer'),/Close other media/);held.resolve();const viewer=await first;viewer.release();f.cache.setViewerOpen(false);
  await assert.rejects(f.cache.acquire({...reference(),accountId:'other'},'preview','thumbnail'),/another account/);f.close();
});
test('global disk entry/byte budgets evict only unleased LRU and retain seven-day cleanup metadata',async()=>{
  const f=fixture();const pinned=await f.cache.acquire(reference('pinned'),'preview','thumbnail');
  for(let n=0;n<199;n++){const key=['http://other-service.local',ns,'other','other','chat','old-'+n,'transport','a'.repeat(64),'preview'];
    const record={key,size:600000,mime:'image/png',usedAt:100000+n,expiresAt:null,pendingPurge:false};f.saved.records.set(JSON.stringify(key),record);f.saved.bodies.set(JSON.stringify(key),new Uint8Array([1]));}
  const handle=await f.cache.acquire(reference('new'),'preview','thumbnail');assert.ok(f.saved.records.size<=200);assert.ok([...f.saved.records.values()].reduce((n,row)=>n+row.size,0)<=100*1024*1024);
  assert.ok([...f.saved.records.values()].some(record=>record.key[5]==='pinned'));handle.release();pinned.release();await f.tick(7*24*60*60*1000+1000);await f.cache.sweep();assert.equal(f.saved.records.size,0);f.close();
});
test('authenticated content checks profile/MIME/version/size and uses 45 seconds, while metadata stays at 10 seconds',async()=>{
  for(const bad of ['version','profile','mime','size',null]){const timeouts=[],source={cacheNamespace:ns,conversationId:'physical',messageId:'photo',sourceVersion:'a'.repeat(64),variant:'image',state:'available',mime:'image/jpeg',maxBytes:4,expiresAt:null,validatedAt:1,validUntil:30001};
    const {ApiClient}=apiFixture(async url=>url.includes('/source?')?json(source):new Response(new Uint8Array(bad==='size'?5:3),{headers:{'Content-Type':bad==='mime'?'image/png':'image/jpeg','X-Otherme-Media-Version':bad==='version'?'b'.repeat(64):source.sourceVersion,'X-Otherme-Profile':bad==='profile'?'other':scope().profileId,'X-Otherme-Revision':'0'}}),
      {setTimeout:(_fn,ms)=>{timeouts.push(ms);return 1;},clearTimeout(){}});
    const client=new ApiClient('http://synthetic.local','synthetic-token',scope());await client.mediaSource('physical','photo','image');
    if(bad)await assert.rejects(client.mediaContent(source,new AbortController().signal));else assert.equal((await client.mediaContent(source,new AbortController().signal)).bytes.length,3);
    assert.deepEqual(timeouts,[10000,45000]);
  }
});
test('native storage awaits byte/index moves, hashes child names, detects corruption and sweeps only its own subtree',async()=>{
  const crypto=require('node:crypto'),files=new Map(),moves=[],deletes=[];let gate=null;
  const uri=parts=>parts.map(part=>typeof part==='string'?part:part.uri).join('/');
  class File{constructor(...parts){this.uri=uri(parts);}get name(){return this.uri.split('/').at(-1);}get exists(){return files.has(this.uri);}get size(){return files.get(this.uri)?.length ?? 0;}
    create(){files.set(this.uri,new Uint8Array());}write(value){files.set(this.uri,typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value));}
    async bytes(){return new Uint8Array(files.get(this.uri));}async text(){return new TextDecoder().decode(files.get(this.uri));}
    delete(){deletes.push(this.uri);files.delete(this.uri);}async move(destination,options){moves.push({from:this.uri,to:destination.uri,options});if(gate)await gate.promise;
      files.set(destination.uri,files.get(this.uri));files.delete(this.uri);this.uri=destination.uri;}}
  class Directory{constructor(...parts){this.uri=uri(parts);}create(){}list(){return [...files.keys()].filter(key=>key.startsWith(this.uri+'/') && !key.slice(this.uri.length+1).includes('/')).map(key=>new File(key));}}
  const {createMediaStorage}=load('lib/media-cache-storage.ts',{'expo-file-system':{File,Directory,Paths:{cache:new Directory('file:///cache')}},
    'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_type,text)=>crypto.createHash('sha256').update(text).digest('hex'),digest:async(_type,bytes)=>Uint8Array.from(crypto.createHash('sha256').update(bytes).digest()).buffer},
    './uuid':{randomUUID:()=> 'synthetic-temp'}},{Uint8Array,TextDecoder,ArrayBuffer});
  const storage=createMediaStorage(),record={key:['http://synthetic.local',ns,'profile','account','chat','message','transport','a'.repeat(64),'preview'],size:3,mime:'image/png',usedAt:1,expiresAt:null,pendingPurge:false};
  gate=deferred();const writing=storage.write(record,new Uint8Array([1,2,3]));await settle();assert.equal((await storage.list()).length,0);gate.resolve();gate=null;await writing;
  assert.equal(moves.length,2);assert.ok(moves.every(move=>move.options.overwrite===true));assert.ok(moves.every(move=>/\/[a-f0-9]{64}\.(bin|json)$/.test(move.to)));
  let stored=await storage.read(record);assert.match(stored.uri,/file:\/\/\/cache\/otherme-media-v1\/[a-f0-9]{64}\.bin$/);assert.equal(files.size,2,'Successful move is not deleted through the mutated temporary File object');
  files.set(stored.uri,new Uint8Array([3,2,1]));assert.equal(await storage.read(record),null);
  files.set('file:///cache/otherme-media-v1/orphan.partial',new Uint8Array([1]));files.set('file:///outside-private-store',new Uint8Array([9]));await storage.sweep([record.key]);
  assert.equal(files.has('file:///cache/otherme-media-v1/orphan.partial'),false);assert.equal(files.has('file:///outside-private-store'),true);assert.ok(deletes.every(path=>path.startsWith('file:///cache/otherme-media-v1/')));
});
function fakeIndexedDB(){const rows=new Map(),transactions=[];let fail=false;
  const database={transaction(name,mode){assert.equal(name,'media');transactions.push(mode);const tx={},staged=new Map(rows);let invalid=false;
    const request=work=>{const result={};queueMicrotask(()=>{try{result.result=work();result.onsuccess?.();}catch{invalid=true;result.onerror?.();}});return result;};
    const store={get:key=>request(()=>staged.get(JSON.stringify(key))),getAll:(_key,max)=>request(()=>[...staged.values()].slice(0,max)),
      put:value=>request(()=>{if(fail)throw new Error('Synthetic quota');staged.set(JSON.stringify(value.key),value);}),delete:key=>request(()=>staged.delete(JSON.stringify(key))),
      openCursor(){const result={},entries=[...staged.entries()];let index=0;const next=()=>queueMicrotask(()=>{const value=entries[index++];result.result=value?{key:JSON.parse(value[0]),delete:()=>staged.delete(value[0]),continue:next}:null;result.onsuccess?.();});next();return result;}};
    tx.objectStore=()=>store;setImmediate(()=>{if(invalid){tx.onabort?.();return;}if(mode==='readwrite'){rows.clear();for(const [key,value] of staged)rows.set(key,value);}tx.oncomplete?.();});return tx;}};
  return{rows,transactions,fail:value=>{fail=value;},indexedDB:{open(name,version){assert.equal(name,'otherme-media-v1');assert.equal(version,1);const request={result:database};queueMicrotask(()=>request.onsuccess?.());return request;}}};
}
test('web IndexedDB publishes Blob/index in one transaction without Web Crypto; failed transactions and corrupt blobs cannot display',async()=>{
  const disk=fakeIndexedDB(),urls=[];const {MediaRecordSchema}=load('lib/media-cache.ts',{'zod':{z},'./api':api,'./media-cache-storage':{createMediaStorage:()=>({})}},{URL});
  const {createMediaStorage}=load('lib/media-cache-storage.web.ts',{'./media-cache':{MediaRecordSchema}},{Blob,Uint8Array,indexedDB:disk.indexedDB,URL:{createObjectURL:blob=>{urls.push(blob);return 'blob:synthetic';},revokeObjectURL:uri=>urls.push(uri)}});
  const storage=createMediaStorage(),record={key:['http://lan-synthetic.local',ns,'p','a','c','m','t','a'.repeat(64),'preview'],size:3,mime:'image/png',usedAt:1,expiresAt:null,pendingPurge:false};
  await storage.write(record,new Uint8Array([1,2,3]));assert.equal(disk.transactions.filter(mode=>mode==='readwrite').length,1);assert.equal((await storage.list()).length,1);
  const stored=await storage.read(record);assert.equal(stored.uri,'blob:synthetic');stored.release();assert.equal(urls.at(-1),'blob:synthetic');
  await storage.touch({...record,usedAt:2});assert.equal((await storage.list())[0].usedAt,2);
  disk.fail(true);await assert.rejects(storage.write({...record,key:[...record.key.slice(0,5),'other',...record.key.slice(6)]},new Uint8Array([1,2,3])));assert.equal(disk.rows.size,1);
  disk.fail(false);[...disk.rows.values()][0].checksum++;assert.equal(await storage.read(record),null);await storage.sweep([]);assert.equal(disk.rows.size,0);
});
test('web private-storage unavailability uses a bounded session Blob fallback and reports nonpersistent retention',async()=>{
  const {MediaRecordSchema}=load('lib/media-cache.ts',{'zod':{z},'./api':api,'./media-cache-storage':{createMediaStorage:()=>({})}},{URL});
  const {createMediaStorage}=load('lib/media-cache-storage.web.ts',{'./media-cache':{MediaRecordSchema}},{Blob,Uint8Array,URL:{createObjectURL:()=> 'blob:session',revokeObjectURL(){}}});
  const storage=createMediaStorage();await storage.list();assert.equal(storage.persistent,false);
});
