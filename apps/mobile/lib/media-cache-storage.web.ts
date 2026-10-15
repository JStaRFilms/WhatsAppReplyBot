import { MediaRecordSchema, type MediaRecord, type MediaStorage, type StoredMedia } from './media-cache';

type Row={key:string[];record:MediaRecord;blob:Blob;checksum:number};
const memory=new Map<string,Row>();
let database:Promise<IDBDatabase | null> | undefined;
function open(){return database ??= new Promise<IDBDatabase | null>(resolve=>{
  if(typeof indexedDB==='undefined'){resolve(null);return;}
  try {const request=indexedDB.open('otherme-media-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('media',{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);
  }catch{resolve(null);}
});}
function requestResult<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Private media storage failed.'));});}
function complete(transaction:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(new Error('Private media storage failed.'));});}
function checksum(bytes:Uint8Array):number{let value=2166136261;for(const byte of bytes)value=Math.imul(value^byte,16777619);return value>>>0;}
function row(value:unknown):Row | null{
  if(typeof value!=='object' || value===null || !('blob' in value) || !(value.blob instanceof Blob) || !('record' in value)
    || !('key' in value) || !Array.isArray(value.key) || !value.key.every(part=>typeof part==='string') || !('checksum' in value) || typeof value.checksum!=='number')return null;
  const record=MediaRecordSchema.safeParse(value.record);if(!record.success || JSON.stringify(value.key)!==JSON.stringify(record.data.key))return null;
  return {key:value.key,blob:value.blob,record:record.data,checksum:value.checksum};
}
export function createMediaStorage():MediaStorage {
  const storage:MediaStorage={
    persistent:true,
    async list(){const db=await open();storage.persistent=!!db;if(!db)return [...memory.values()].map(value=>value.record);
      const values:unknown[]=await requestResult(db.transaction('media','readonly').objectStore('media').getAll(undefined,1001));
      if(values.length>1000)throw new Error('Media cache needs cleanup before new downloads.');return values.map(value=>row(value)?.record);
    },
    async read(record):Promise<StoredMedia | null>{const db=await open();storage.persistent=!!db;
      const value=row(db?await requestResult(db.transaction('media','readonly').objectStore('media').get(record.key)):memory.get(JSON.stringify(record.key)));
      if(!value || value.blob.size!==record.size || value.blob.type!==record.mime || value.blob.size>10*1024*1024)return null;
      const bytes=new Uint8Array(await value.blob.arrayBuffer());if(checksum(bytes)!==value.checksum)return null;
      const uri=URL.createObjectURL(value.blob);return{uri,release:()=>URL.revokeObjectURL(uri)};
    },
    async write(record,bytes){const db=await open();storage.persistent=!!db;
      const value:Row={key:record.key,record,blob:new Blob([bytes],{type:record.mime}),checksum:checksum(bytes)};
      if(!db){memory.set(JSON.stringify(record.key),value);return;}
      const transaction=db.transaction('media','readwrite'),done=complete(transaction);transaction.objectStore('media').put(value);await done;
    },
    async touch(record){const db=await open();if(!db){const value=memory.get(JSON.stringify(record.key));if(value)value.record=record;return;}
      const transaction=db.transaction('media','readwrite'),done=complete(transaction),store=transaction.objectStore('media'),request=store.get(record.key);
      request.onsuccess=()=>{const value=row(request.result);if(value)store.put({...value,record});};await done;
    },
    async remove(record){const db=await open();if(!db){memory.delete(JSON.stringify(record.key));return;}
      const transaction=db.transaction('media','readwrite'),done=complete(transaction);transaction.objectStore('media').delete(record.key);await done;
    },
    async sweep(keys){const allowed=new Set(keys.map(key=>JSON.stringify(key))),db=await open();
      if(!db){for(const key of memory.keys())if(!allowed.has(key))memory.delete(key);return;}
      const transaction=db.transaction('media','readwrite'),done=complete(transaction),request=transaction.objectStore('media').openCursor();
      request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(!allowed.has(JSON.stringify(cursor.key)))cursor.delete();cursor.continue();};await done;
    },
  };return storage;
}
