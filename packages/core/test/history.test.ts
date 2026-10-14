import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { chat,message } from './fixtures.ts';
test('indexed history windows and unread views are chronological and scoped',()=>{
 const store=new SqliteStore();try{
 store.saveConversation(chat());store.saveConversation(chat('c2'));
 store.saveMessage({...message('later'),occurredAt:200});store.saveMessage({...message('older'),occurredAt:100});
 store.saveMessage({...message('history'),source:'backfill',occurredAt:50});store.saveMessage(message('other','c2'));
 assert.deepEqual(store.recentMessages('a','c1',2).map(m=>m.id),['older','later']);assert.equal(store.lastMessages('a').find(m=>m.conversationId==='c1')?.id,'later');
 assert.equal(store.unreadCounts('a').c1,2);assert.deepEqual(store.unreadCounts('b'),{});
 store.markViewed('a','c1','later');assert.equal(store.unreadCounts('a').c1,1);
 assert.throws(()=>store.markViewed('a','c1','other'),/message_not_found/);
 store.markViewed('a','c1','older');assert.equal(store.unreadCounts('a').c1,undefined);
 const revision=store.historyVersions('a').c1;store.saveMessage({...message('late-arrival'),occurredAt:150});
 assert.ok((store.historyVersions('a').c1 ?? 0)>(revision ?? 0));
 const window=store.recentMessages('a','c1');const position=store.historyWatermark('a','c1',window.map(m=>m.id));
 store.markViewedPosition('a','c1',position);assert.equal(store.unreadCounts('a').c1,undefined);
 }finally{store.close();}
});
