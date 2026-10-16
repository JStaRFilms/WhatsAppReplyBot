import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { SqliteStore } from '@replybot/core';
import { createApp } from '../src/server.ts';

const exportRoot = '/assets/__node_modules/.pnpm';
const packageRoot = exportRoot+'/@expo-google-fonts+inter@0.4.2/node_modules/@expo-google-fonts/inter';
function fixture() {
  const owned = new URL('../../../.runtime/pc-task54/', import.meta.url);
  mkdirSync(owned, { recursive:true });
  const temporary = mkdtempSync(fileURLToPath(new URL('export-assets-',owned)));
  const directory = join(temporary,'public');
  const put = (path:string,content:string) => { const file=join(directory,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,content); };
  put('index.html','synthetic-public-app');
  return {temporary,directory,put};
}

for (const font of ['400Regular/Inter_400Regular','500Medium/Inter_500Medium','600SemiBold/Inter_600SemiBold','700Bold/Inter_700Bold']) {
  test('exported Inter font '+font+' is public without exposing dependencies',async()=>{
    const f=fixture(),url=packageRoot+'/'+font+'.synthetic.ttf';f.put(url,'invented-font-bytes');
    const app=createApp({store:new SqliteStore(),token:'invented-owner-token',seed:false,desktopDir:f.directory});
    try {
      const response=await app.inject({url});assert.equal(response.statusCode,200);assert.equal(response.body,'invented-font-bytes');
      assert.match(response.headers['content-type'] ?? '',/^font\/ttf/);assert.equal(response.headers['x-content-type-options'],'nosniff');assert.equal(response.headers['cache-control'],'no-store');
      const head=await app.inject({method:'HEAD',url});assert.equal(head.statusCode,200);assert.equal(head.body,'');
    } finally {await app.close();rmSync(f.temporary,{recursive:true,force:true});}
  });
}

test('export namespace permits public images but rejects hidden, private, source, traversal and symlink files',async()=>{
  const f=fixture(),image=exportRoot+'/invented-package/node_modules/invented-package/public/synthetic.png';f.put(image,'invented-image-bytes');
  const forbidden=[
    '/assets/.pnpm/synthetic.ttf','/assets/__node_modules/.other/synthetic.ttf',
    exportRoot+'/.hidden/synthetic.png',exportRoot+'/pkg/.env.png',exportRoot+'/pkg/.runtime/synthetic.png',
    exportRoot+'/pkg/source.js',exportRoot+'/pkg/source.ts',exportRoot+'/pkg/source.js.map',exportRoot+'/pkg/package.json',exportRoot+'/pkg/.metadata.png',
    '/node_modules/package/public/synthetic.png','/__node_modules/.pnpm/package/public/synthetic.png',
    '/.runtime/owner-token.txt','/.env','/services/backend/src/index.ts',
  ];
  for(const path of forbidden)f.put(path,'invented-private-marker');
  const outside=join(f.temporary,'private');mkdirSync(outside);writeFileSync(join(outside,'escape.png'),'invented-outside-marker');
  symlinkSync(outside,join(f.directory,'assets/__node_modules/.pnpm/linked'),'junction');
  const app=createApp({store:new SqliteStore(),token:'invented-owner-token',seed:false,desktopDir:f.directory});
  try {
    await app.listen({host:'127.0.0.1',port:0});
    const address=app.server.address();assert.ok(address && typeof address!=='string');assert.ok(![3210,8081,8083].includes(address.port));
    // inject, like a browser URL, normalizes dot segments. Send raw targets for
    // traversal checks so the handler, rather than that normalization, is tested.
    const raw=(path:string)=>new Promise<{statusCode:number;body:string}>((resolve,reject)=>{
      const request=http.request({host:'127.0.0.1',port:address.port,path,agent:false},response=>{
        let body='';response.setEncoding('utf8');response.on('data',(chunk:string)=>{body+=chunk;});
        response.on('end',()=>resolve({statusCode:response.statusCode ?? 0,body}));
      });
      request.on('error',reject);request.end();
    });
    const response=await app.inject({url:image});assert.equal(response.statusCode,200);assert.equal(response.body,'invented-image-bytes');
    for(const url of [...forbidden,
      exportRoot+'/linked/escape.png',exportRoot+'/../.other/synthetic.ttf',exportRoot+'/%2e%2e/.other/synthetic.ttf',
      exportRoot+'/%252e%252e/synthetic.png',exportRoot+'/pkg/%2eenv.png',exportRoot+'/pkg/%5c..%5cescape.png',
      exportRoot+'/pkg/synthetic%00.png',exportRoot+'/pkg/%252epnpm/synthetic.png',
      '/assets/__node_modules/%252epnpm/package/synthetic.png','/assets/__node_modules/.pnpm/../../../settings',
    ]) {
      const denied=await raw(url);assert.notEqual(denied.statusCode,200,url);assert.doesNotMatch(denied.body,/invented-(?:private|outside)-marker|synthetic-public-app/,url);
    }
    for(const url of ['/%76%31/snapshot','/v%31/session','/v1%2fsnapshot']) {
      for(const method of ['GET','HEAD'] as const)assert.notEqual((await app.inject({method,url})).statusCode,200,url);
    }
    // Reject a linked namespace itself as well as links inside it.
    rmSync(join(f.directory,'assets/__node_modules/.pnpm'),{recursive:true,force:true});
    symlinkSync(outside,join(f.directory,'assets/__node_modules/.pnpm'),'junction');
    assert.notEqual((await app.inject({url:exportRoot+'/escape.png'})).statusCode,200);
  } finally {await app.close();rmSync(f.temporary,{recursive:true,force:true});}
});
