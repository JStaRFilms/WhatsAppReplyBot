import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SqliteStore} from '../src/store.ts';
import {chat} from './fixtures.ts';
const phone='15550000001@s.whatsapp.net';

test('standalone history membership uses an account/canonical covering index',t=>{
 const store=new SqliteStore();
 try{
  store.saveConversation(chat(phone));store.saveConversation({...chat('123@lid'),kind:'unknown'});
  const db=store['db'];
  db.prepare('INSERT INTO wa_aliases VALUES(?,?,?)').run('a','123@lid',phone);
  db.prepare('INSERT INTO wa_aliases VALUES(?,?,?)').run('b','456@lid',phone);
  const prepare=db.prepare.bind(db);let plan:string[]=[];
  t.mock.method(db,'prepare',(sql:string)=>{
   if(sql.startsWith('SELECT alias FROM wa_aliases'))plan=prepare('EXPLAIN QUERY PLAN '+sql).all('a',phone).map(row=>String(row.detail));
   return prepare(sql);
  });
  assert.deepEqual(store.historyGroup('a',phone).memberIds,[phone,'123@lid'].sort());
  assert.ok(plan.some(line=>/SEARCH wa_aliases USING COVERING INDEX wa_aliases_canonical \(account_id=\? AND canonical=\?\)/.test(line)),plan.join('\n'));
 }finally{store.close();}
});

test('opening an existing store adds the derived canonical index without changing mappings',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'otherme-alias-index-')),file=join(temporary,'test.sqlite');
 let store:SqliteStore|undefined;
 try{
  store=new SqliteStore(file);const db=store['db'];
  db.prepare('INSERT INTO wa_aliases VALUES(?,?,?)').run('a','123@lid',phone);
  db.prepare('INSERT INTO wa_aliases VALUES(?,?,?)').run('b','123@lid','15550000002@s.whatsapp.net');
  db.exec('DROP INDEX IF EXISTS wa_aliases_canonical');
  const expected=db.prepare('SELECT * FROM wa_aliases ORDER BY account_id,alias').all();
  store.close();store=undefined;
  store=new SqliteStore(file);
  assert.ok(store['db'].prepare('PRAGMA index_list(wa_aliases)').all().some(row=>row.name==='wa_aliases_canonical'));
  assert.deepEqual(store['db'].prepare('SELECT * FROM wa_aliases ORDER BY account_id,alias').all(),expected);
  assert.equal(store.waCanonical('a','123@lid'),phone);
  assert.equal(store.waCanonical('b','123@lid'),'15550000002@s.whatsapp.net');
 }finally{store?.close();rmSync(temporary,{recursive:true,force:true});}
});
