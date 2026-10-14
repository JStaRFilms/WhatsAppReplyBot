import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '@replybot/core';
import { normalizeWhatsApp } from '../src/whatsapp-normalize.ts';
import { createApp } from '../src/server.ts';
test('normalization scopes quotes, marks historical input and excludes view-once content', () => {
  const raw = { key: { remoteJid: '123@s.whatsapp.net', id: 'a', fromMe: false },
    messageTimestamp: 1700000000, message: { extendedTextMessage: { text: 'hello',
      contextInfo: { stanzaId: 'other', remoteJid: '999@s.whatsapp.net' } } } };
  const history = normalizeWhatsApp(raw,'owner','123@s.whatsapp.net','backfill');
  assert.equal(history?.source,'backfill'); assert.equal(history?.quotedMessageId,null);
  assert.equal(normalizeWhatsApp(raw,'owner','123@g.us','live'),null);
  const once = normalizeWhatsApp({ ...raw, message: { viewOnceMessageV2: { message: { imageMessage: { caption: 'private' } } } } },'owner','123@s.whatsapp.net','live');
  assert.equal(once?.text,''); assert.equal(once?.media?.viewOnce,true);
  const audio = normalizeWhatsApp({ ...raw, message: { viewOnceMessageV2: { message: { audioMessage: {} } } } },'owner','123@s.whatsapp.net','live');
  assert.equal(audio?.media?.viewOnce,true);
  const nested = normalizeWhatsApp({ ...raw, message: { ephemeralMessage: { message: { viewOnceMessageV2: { message: { imageMessage: { caption: 'nested private' } } } } } } },'owner','123@s.whatsapp.net','live');
  assert.equal(nested?.media?.viewOnce,true); assert.equal(nested?.text,'');
});
test('live account starts empty, requires authentication and disables demo injection', async () => {
  const store = new SqliteStore();
  store.saveWaAlias('owner-a','123@lid','456@s.whatsapp.net');
  assert.equal(store.waCanonical('owner-b','123@lid'),'123@lid');
  assert.throws(() => store.saveWaAlias('owner-a','123@lid','999@s.whatsapp.net'));
  const app = createApp({ store, token: 'test-owner-token', whatsapp: { authDir: '.runtime/never-opened-test-auth' }, allowedOrigins: ['http://192.168.1.2:8081'] });
  try {
    assert.equal((await app.inject({ method:'GET',url:'/v1/whatsapp' })).statusCode,401);
    const headers = { authorization:'Bearer test-owner-token', origin:'http://192.168.1.2:8081' };
    const snapshot = await app.inject({ method:'GET',url:'/v1/snapshot',headers });
    assert.equal(snapshot.json().demo,false); assert.deepEqual(snapshot.json().conversations,[]);
    assert.equal(snapshot.json().accountId,'whatsapp-owner');
    assert.equal((await app.inject({ method:'POST',url:'/v1/conversations/x/demo-incoming',headers,payload:{ requestId:'in',text:'test' } })).statusCode,403);
    assert.equal((await app.inject({ method:'POST',url:'/v1/local-provision',headers:{origin:'http://192.168.1.2:8081'},remoteAddress:'192.168.1.4',payload:{confirmLocalDemo:true} })).statusCode,403);
    assert.equal((await app.inject({ method:'GET',url:'/v1/health',remoteAddress:'8.8.8.8' })).statusCode,403);
  } finally { await app.close(); }
});
