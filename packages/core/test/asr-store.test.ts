import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore, historyDigest, type AsrSource } from '../src/index.ts';

const source:AsrSource={accountId:'synthetic-asr',profileId:'synthetic-profile',conversationId:'synthetic-chat',
  messageId:'synthetic-message',transportId:'synthetic-transport',contentId:historyDigest('synthetic-attachment')};
const provenance={adapter:'synthetic-adapter-v1',model:'synthetic-model',normalizer:'synthetic-normalizer-v1'};
const transcript={text:'Synthetic original — punctuation.',uncertain:true};
function disposable(run:(store:SqliteStore,db:DatabaseSync,path:string)=>void):void {
  const dir=mkdtempSync(join(tmpdir(),'replybot-asr-store-')),path=join(dir,'synthetic.sqlite');
  const store=new SqliteStore(path),db=new DatabaseSync(path);
  try{run(store,db,path);}finally{db.close();store.close();rmSync(dir,{recursive:true,force:true});}
}
function seed(db:DatabaseSync,count:number,text:string|null):void {
  db.prepare(`WITH RECURSIVE numbers(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM numbers WHERE n<?)
    INSERT INTO asr_attempts(account_id,profile_id,source_key,content_id,conversation_id,message_id,transport_id,
      attempt_id,state,transcript,provenance,last_used)
    SELECT ?,?,printf('%064x',n),?,?,'seed-'||n,'seed-'||n,'synthetic-seed-'||n,?,?,?,1000+n FROM numbers`)
    .run(count,source.accountId,source.profileId,source.contentId,source.conversationId,text===null?'suppressed':'complete',text,JSON.stringify(provenance));
}

test('transactional unique reservation and opaque attempt CAS preserve scope and cannot revive suppressed/unknown attempts',()=>{
  disposable((store,_db,path)=>{
    const second=new SqliteStore(path);
    try {
      const attempt=store.reserveAsr(source,null,1);assert.match(attempt,/^[\da-f-]{36}$/);
      assert.throws(()=>second.reserveAsr(source,null,1),/audio_attempt_unavailable/);
      assert.equal(store.completeAsr(source,'wrong-attempt',transcript,provenance,2),false);
      assert.equal(store.completeAsr({...source,profileId:'other-profile'},attempt,transcript,provenance,2),false);
      assert.equal(store.completeAsr(source,attempt,transcript,provenance,2),true);
      assert.deepEqual(second.asrAttempt(source,3)?.transcript,transcript);
      assert.deepEqual(second.asrAttempt(source,3)?.provenance,provenance);
      store.suppressAsr(source.accountId,source.conversationId,source.transportId);
      assert.equal(store.completeAsr(source,attempt,transcript,provenance,4),false);
      store.unknownAsr(source.accountId,attempt);assert.equal(store.asrAttempt(source,4)?.state,'suppressed');
      assert.equal(store.asrAttempt({...source,accountId:'another-account'},4),undefined);
      assert.equal(store.asrAttempt({...source,profileId:'another-profile'},4),undefined);
      assert.equal(store.asrAttempt({...source,messageId:'another-message'},4),undefined);
      assert.throws(()=>store.reserveAsr(source,null,4),/audio_attempt_unavailable/);
    }finally{second.close();}
  });
});

test('completed silence is reusable and expiry removes text without removing attempt protection',()=>{
  const store=new SqliteStore();
  try {
    const attempt=store.reserveAsr(source,2000,1000);
    assert.equal(store.completeAsr(source,attempt,{text:'',uncertain:true},provenance,1001),true);
    assert.deepEqual(store.asrAttempt(source,1999)?.transcript,{text:'',uncertain:true});
    assert.equal(store.asrAttempt(source,2000)?.transcript,null);assert.equal(store.asrAttempt(source,2000)?.state,'suppressed');
    assert.throws(()=>store.reserveAsr(source,null,2001),/audio_attempt_unavailable/);
    const changed={...source,contentId:historyDigest('changed-content')};
    const next=store.reserveAsr(changed,null,2001);store.unknownAsr(source.accountId,next);
    assert.equal(store.completeAsr(changed,next,transcript,provenance,2002),false);
  }finally{store.close();}
});

test('1000-text LRU eviction leaves a suppression marker; touched text wins over older entries',()=>{
  disposable((store,db)=>{
    const old=store.reserveAsr(source,null,0);store.completeAsr(source,old,transcript,provenance,0);
    seed(db,999,JSON.stringify(transcript));
    const touched=store.asrAttempt(source,5000);assert.equal(touched?.state,'complete');
    const next={...source,messageId:'newest',transportId:'newest'},id=store.reserveAsr(next,null,6000);
    store.completeAsr(next,id,transcript,provenance,6000);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM asr_attempts WHERE transcript IS NOT NULL').get()?.count,1000);
    assert.equal(db.prepare("SELECT state FROM asr_attempts WHERE attempt_id='synthetic-seed-1'").get()?.state,'suppressed');
    assert.equal(store.asrAttempt(source,6001)?.state,'complete');
    // The seed's source key is synthetic. Its retained marker still occupies the original unique reservation.
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM asr_attempts').get()?.count,1001);
    const another={...source,messageId:'another',transportId:'another'};
    store.completeAsr(another,store.reserveAsr(another,null,10000),transcript,provenance,10000);
    assert.equal(store.asrAttempt(source,10001)?.state,'complete');
  });
});

test('4MiB retention counts UTF-8 bytes, not characters, and text eviction cannot reopen a paid source',()=>{
  disposable((store,db)=>{
    const old=store.reserveAsr(source,null,0);store.completeAsr(source,old,transcript,provenance,0);
    seed(db,750,JSON.stringify({text:'界'.repeat(2000),uncertain:true}));
    const next={...source,messageId:'newest',transportId:'newest'},id=store.reserveAsr(next,null,6000);
    store.completeAsr(next,id,transcript,provenance,6000);
    const size=db.prepare('SELECT SUM(length(CAST(transcript AS BLOB))) AS bytes,COUNT(*) AS count FROM asr_attempts WHERE transcript IS NOT NULL').get();
    assert.ok(size && typeof size.bytes==='number' && size.bytes<=4*1024*1024);assert.ok(typeof size.count==='number' && size.count<1000);
    assert.equal(store.asrAttempt(source,6001)?.state,'suppressed');assert.equal(store.asrAttempt(source,6001)?.transcript,null);
    assert.throws(()=>store.reserveAsr(source,null,6001),/audio_attempt_unavailable/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM asr_attempts').get()?.count,752);
  });
});

test('10000 markers per account fail closed across profiles; unknown and suppressed markers are never evicted for capacity',()=>{
  disposable((store,db)=>{
    const id=store.reserveAsr(source,null,1);store.unknownAsr(source.accountId,id);seed(db,9999,null);
    assert.throws(()=>store.reserveAsr({...source,messageId:'new'},null,2),/audio_attempt_capacity/);
    assert.throws(()=>store.reserveAsr({...source,profileId:'other-profile',messageId:'new'},null,2),/audio_attempt_capacity/);
    assert.equal(store.asrAttempt(source,3)?.state,'unknown');
    assert.throws(()=>store.reserveAsr(source,null,3),/audio_attempt_unavailable/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM asr_attempts WHERE account_id=?').get(source.accountId)?.count,10000);
    assert.ok(store.reserveAsr({...source,accountId:'other-account'},null,3));
  });
});
