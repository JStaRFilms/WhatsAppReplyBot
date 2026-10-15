import { Directory, File, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest, digestStringAsync } from 'expo-crypto';
import { randomUUID } from './uuid';
import type { MediaRecord, MediaStorage, StoredMedia } from './media-cache';

const root=new Directory(Paths.cache,'otherme-media-v1');
const hash=(key:readonly string[])=>digestStringAsync(CryptoDigestAlgorithm.SHA256,JSON.stringify(key));
const checksum=async(bytes:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256,bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
function ensureRoot(){root.create({idempotent:true,intermediates:true});}
async function indexFile(key:readonly string[]){return new File(root,(await hash(key))+'.json');}
async function dataFile(key:readonly string[]){return new File(root,(await hash(key))+'.bin');}
async function readIndex(file:File):Promise<unknown>{if(!file.exists || file.size>32768)return null;try{return JSON.parse(await file.text());}catch{return null;}}
function indexValue(value:unknown):{record:unknown;digest:string} | null {
  if(typeof value!=='object' || value===null || !('record' in value) || !('digest' in value) || typeof value.digest!=='string' || !/^[a-f0-9]{64}$/.test(value.digest))return null;
  return {record:value.record,digest:value.digest};
}
async function writeIndex(record:MediaRecord,checksum:string){
  const destination=await indexFile(record.key),temp=new File(root,randomUUID()+'.partial');
  let moved=false;
  try {temp.create();temp.write(JSON.stringify({record,digest:checksum}));await temp.move(destination,{overwrite:true});moved=true;}
  finally {if(!moved && temp.exists)temp.delete();}
}

export function createMediaStorage():MediaStorage {
  return {
    persistent:true,
    async list(){ensureRoot();const files=root.list();if(files.length>2000)throw new Error('Media cache needs cleanup before new downloads.');
      const records:unknown[]=[];for(const file of files)if(file instanceof File && /^[a-f0-9]{64}\.json$/.test(file.name)){
        const value=indexValue(await readIndex(file));if(value)records.push(value.record);
      }return records;
    },
    async read(record):Promise<StoredMedia | null>{
      const file=await dataFile(record.key),index=indexValue(await readIndex(await indexFile(record.key)));
      if(!index || !file.exists || file.size!==record.size || file.size>10*1024*1024)return null;
      const bytes=await file.bytes();if(bytes.length!==record.size || await checksum(bytes)!==index.digest)return null;
      return {uri:file.uri,release(){}};
    },
    async write(record,bytes){ensureRoot();const destination=await dataFile(record.key),temp=new File(root,randomUUID()+'.partial');
      let moved=false;
      try {temp.create();temp.write(bytes);if(temp.size!==record.size)throw new Error('Incomplete media write.');
        const sum=await checksum(bytes);await temp.move(destination,{overwrite:true});moved=true;await writeIndex(record,sum);
      }finally {if(!moved && temp.exists)temp.delete();}
    },
    async touch(record){const index=indexValue(await readIndex(await indexFile(record.key)));if(!index)throw new Error('Media index was evicted.');await writeIndex(record,index.digest);},
    async remove(record){const index=await indexFile(record.key),file=await dataFile(record.key);
      // Keep the index if unlink fails, so the manager can persist pending purge.
      if(file.exists)file.delete();if(index.exists)index.delete();
    },
    async sweep(keys){ensureRoot();const allowed=new Set<string>();for(const key of keys){const name=await hash(key);allowed.add(name+'.json');allowed.add(name+'.bin');}
      for(const child of root.list())if(!allowed.has(child.name))child.delete();
    },
  };
}
