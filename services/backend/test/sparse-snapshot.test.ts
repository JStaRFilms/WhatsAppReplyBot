import test from 'node:test';
import assert from 'node:assert/strict';
import { Workflow } from '@replybot/core';
import { createApp } from '../src/server.ts';
import { fixture, accountId, now, phone } from './snapshot-fixture.ts';

for (const dense of [false,true]) test(`${dense ? 'dense 200000-message' : 'sparse 3437-contact'} snapshot reuses account and group reads`, async t => {
  const store=fixture(dense);
  const app=createApp({store,accountId,token:'synthetic',seed:false,now:()=>now});
  try {
    await app.ready();
    const db=store['db'],prepare=db.prepare.bind(db);
    let total=0,conversations=0,outboxes=0,aliasScans=0,latest=0;
    t.mock.method(db,'prepare',(sql:string)=>{
      total++;
      // Abort the original quadratic path early, without a wall-clock threshold.
      if(total>10000)throw new Error('snapshot SQL budget exceeded');
      if(sql==='SELECT payload FROM conversations WHERE account_id=? ORDER BY rowid')conversations++;
      if(sql==='SELECT payload FROM outbox WHERE account_id=? ORDER BY rowid')outboxes++;
      if(sql.startsWith('SELECT alias FROM wa_aliases'))aliasScans++;
      if(sql.startsWith('SELECT result.payload'))latest++;
      return prepare(sql);
    });
    const result=await app.inject({url:'/v1/snapshot',headers:{authorization:'Bearer synthetic'}});
    assert.equal(result.statusCode,200,result.body);
    const body=result.json();
    assert.equal(body.conversations.length,dense?100:3437);
    assert.equal(body.historyGroups.length,dense?100:3437,'empty legacy conversations remain visible');
    assert.equal(body.lastMessages.length,dense?100:345);
    assert.equal(body.drafts.length,dense?0:166);
    assert.equal(body.outbox.length,dense?0:135);
    assert.equal(conversations,1); assert.equal(outboxes,1); assert.equal(aliasScans,0);
    assert.equal(latest,dense?100:345,'one bounded latest read per populated group');
    assert.ok(total<3500,`${total} SQL preparations`);
    assert.equal(body.unreadCounts[phone(0)],dense?2000:275);
    assert.equal(body.historyGroups.at(-1).lastMessageId,dense?'synthetic-199999':null);
    assert.equal(body.lastMessages.find((m:{conversationId:string})=>m.conversationId===phone(0)).id,dense?'synthetic-199900':'synthetic-274');
  } finally { t.mock.restoreAll(); await app.close(); }
});

test('many-contact policy listing projects physical outboxes only once', t => {
  const store=fixture();
  try {
    const flow=new Workflow(store,accountId,()=>now);
    const db=store['db'],prepare=db.prepare.bind(db);let outboxes=0,total=0;
    t.mock.method(db,'prepare',(sql:string)=>{
      if(++total>10000)throw new Error('policy SQL budget exceeded');
      if(sql==='SELECT payload FROM outbox WHERE account_id=? ORDER BY rowid')outboxes++;
      return prepare(sql);
    });
    assert.equal(flow.effectiveConversations().length,3437);
    assert.equal(outboxes,1); assert.ok(total<1000,`${total} SQL preparations`);
  } finally { t.mock.restoreAll(); store.close(); }
});
