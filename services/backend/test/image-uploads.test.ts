import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import sharp from 'sharp';
import { z } from 'zod';
import makeWASocket, { proto } from '@whiskeysockets/baileys';
import { WhatsAppAdapter } from '../src/whatsapp.ts';
import { DomainError, ImageUpload, SqliteStore, Workflow } from '@replybot/core';
import { MAX_IMAGE_BYTES, normalizeOwnerImage, registerImageUploads } from '../src/image-uploads.ts';

test('normalization rotates, removes metadata and flattens transparency into bounded JPEG', async () => {
  const oriented = await sharp({create:{width:2,height:3,channels:3,background:'#ff0000'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const image = await normalizeOwnerImage(oriented);
  assert.equal(image.mime,'image/jpeg'); assert.equal(image.width,3); assert.equal(image.height,2);
  const metadata = await sharp(image.bytes).metadata(); assert.equal(metadata.format,'jpeg'); assert.equal(metadata.exif,undefined);
  const transparent = await sharp({create:{width:2,height:2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
  const flattened = await normalizeOwnerImage(transparent);
  const pixel = await sharp(flattened.bytes).raw().toBuffer(); assert.deepEqual([...pixel.subarray(0,3)],[255,255,255]);
  const large = await sharp({create:{width:3000,height:1500,channels:3,background:'#123456'}}).png().toBuffer();
  const resized = await normalizeOwnerImage(large); assert.equal(resized.width,2048); assert.equal(resized.height,1024);
});
test('normalization rejects empty, oversized, corrupt and non-image documents', async () => {
  for (const bytes of [Buffer.alloc(0),Buffer.from('not an image'),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>')])
    await assert.rejects(normalizeOwnerImage(bytes),DomainError);
  await assert.rejects(normalizeOwnerImage(Buffer.alloc(MAX_IMAGE_BYTES+1)),/image_too_large/);
});
test('binary upload keeps shared auth, request idempotency, conversation scope and a 10MB route limit', async () => {
  const app = Fastify({bodyLimit:16384}); const store = new SqliteStore(); const flow = new Workflow(store,'synthetic-owner',() => 1000);
  store.saveConversation({id:'c1',accountId:flow.accountId,contactId:'c1',name:'Synthetic',kind:'direct',mode:'draft_only',excluded:false,
    control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
  app.addHook('onRequest',async (request,reply) => {
    if (request.headers.authorization !== 'Bearer synthetic-test-token') return reply.code(401).send({error:'owner_auth_required'});
  });
  app.setErrorHandler((error,_request,reply) => reply.code(error instanceof DomainError ? error.status : 500).send({error:error instanceof DomainError ? error.code : 'service_error'}));
  registerImageUploads(app,flow);
  const jpeg = await sharp({create:{width:4,height:5,channels:3,background:'#abcdef'}}).jpeg().toBuffer();
  const bytes = Buffer.concat([jpeg,Buffer.alloc(20000)]);
  const headers = {authorization:'Bearer synthetic-test-token','content-type':'application/octet-stream','x-request-id':'stage'};
  const url = '/v1/conversations/c1/uploads';
  try {
    assert.equal((await app.inject({method:'POST',url,payload:bytes,headers:{'content-type':'application/octet-stream','x-request-id':'stage'}})).statusCode,401);
    const response = await app.inject({method:'POST',url,payload:bytes,headers}); assert.equal(response.statusCode,200,response.body);
    const upload = ImageUpload.parse(response.json<unknown>()); assert.equal(upload.width,4); assert.equal(upload.height,5);
    assert.equal(response.headers['cache-control'],'no-store');
    assert.deepEqual((await app.inject({method:'POST',url,payload:bytes,headers})).json<unknown>(),upload);
    assert.equal(store.imageUpload(flow.accountId,'c1',upload.id)?.mime,'image/jpeg');
    const other = await sharp({create:{width:4,height:5,channels:3,background:'#ff0000'}}).jpeg().toBuffer();
    assert.equal((await app.inject({method:'POST',url,payload:other,headers})).statusCode,409);
    assert.equal((await app.inject({method:'POST',url:'/v1/conversations/missing/uploads',payload:bytes,headers:{...headers,'x-request-id':'missing'}})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url,payload:bytes,headers:{authorization:headers.authorization,'content-type':headers['content-type']}})).statusCode,422);
    assert.equal((await app.inject({method:'POST',url,payload:Buffer.alloc(MAX_IMAGE_BYTES+1),headers:{...headers,'x-request-id':'too-large'}})).statusCode,413);
    assert.equal((await app.inject({method:'POST',url,payload:Buffer.from('invalid'),headers:{...headers,'x-request-id':'invalid'}})).statusCode,422);
    assert.equal((await app.inject({method:'POST',url,payload:{uri:'file:///private/arbitrary-path'},headers:{...headers,'content-type':'application/json','x-request-id':'path'}})).statusCode,415);
  } finally {await app.close();store.close();}
});

type Socket = ReturnType<typeof makeWASocket>;
function syntheticTransport(sendMessage: Socket['sendMessage']) {
  const store = new SqliteStore(); const flow = new Workflow(store,'synthetic-owner',() => 1000);
  const chat = '123@s.whatsapp.net';
  store.saveConversation({id:chat,accountId:flow.accountId,contactId:chat,name:'Synthetic',kind:'direct',mode:'draft_only',excluded:false,
    control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:0,hours:null});
  const adapter = new WhatsAppAdapter(flow,'unused-synthetic-auth',async () => {});
  const socket: Pick<Socket,'sendMessage'|'user'> = {sendMessage,user:{id:'456@s.whatsapp.net'}};
  // Isolated fake transport only. Never connect a real socket or create credentials.
  Object.defineProperty(adapter,'socket',{value:socket,configurable:true});
  Object.defineProperty(adapter,'verifiedSocket',{value:socket,configurable:true});
  Object.defineProperty(adapter,'status',{value:{...adapter.snapshot(),state:'connected'}});
  return {store,flow,chat,adapter};
}
test('image transport passes staged bytes, caption and quote; saved raw supports previews without reviving tombstones', async () => {
  for (const deleted of [false,true]) {
    const bytes = await sharp({create:{width:4,height:5,channels:3,background:'#123456'}}).jpeg().toBuffer();
    let calls = 0;
    const fixture = syntheticTransport(async (jid,content,options) => {
      calls++;
      assert.equal(jid,'123@s.whatsapp.net'); assert.ok('image' in content);
      if ('image' in content) {assert.deepEqual(content.image,bytes);assert.equal(content.caption,'caption');}
      assert.equal(options?.quoted?.key.id,'quote-transport');
      return {key:{id:'sent-image',remoteJid:jid,fromMe:true},messageTimestamp:1,
        message:{imageMessage:{mimetype:'image/jpeg',width:4,height:5,caption:'caption'}}};
    });
    const {store,flow,chat,adapter} = fixture;
    try {
      const quote = {key:{id:'quote-transport',remoteJid:chat,fromMe:false},messageTimestamp:1,message:{conversation:'synthetic quote'}};
      store.saveMessage({id:'quote-id',accountId:flow.accountId,conversationId:chat,transportId:'quote-transport',direction:'inbound',
        authorship:'contact_written',text:'synthetic quote',occurredAt:1000,source:'live',quotedMessageId:null,statusReply:false,statusContext:null,media:null,reaction:null});
      store.saveWaMessage(flow.accountId,chat,'quote-transport',JSON.stringify({protobuf:Buffer.from(proto.WebMessageInfo.encode(quote).finish()).toString('base64')}));
      if (deleted) store.saveWaMessage(flow.accountId,chat,'sent-image',JSON.stringify({deleted:true}));
      const upload = flow.stageImage(chat,{mime:'image/jpeg',width:4,height:5,bytes},'upload');
      const queued = flow.manualSend(chat,{kind:'image',uploadId:upload.id,caption:'caption',reason:'test'},'send','quote-id');
      assert.equal((await adapter.dispatch(queued.id)).state,'accepted'); assert.equal(calls,1);
      const sent = store.messages(flow.accountId,chat).at(-1); assert.ok(sent);
      assert.equal(adapter.mediaCurrent(sent),!deleted);
      if(deleted){assert.equal(sent.media,null);assert.equal(sent.text,'[Message deleted]');}
      if (deleted) assert.equal(store.waMessage(flow.accountId,chat,'sent-image'),JSON.stringify({deleted:true}));
      else {
        const raw = store.waMessage(flow.accountId,chat,'sent-image'); assert.ok(raw);
        assert.ok(z.object({protobuf:z.string().min(1)}).parse(JSON.parse(raw)).protobuf);
      }
    } finally {store.close();}
  }
});
test('socket replacement during image handoff is unknown, retains bytes and cannot retry', async () => {
  let calls = 0;
  const fixture = syntheticTransport(async jid => {
    calls++; Object.defineProperty(fixture.adapter,'socket',{value:undefined});
    return {key:{id:'uncertain-image',remoteJid:jid,fromMe:true},messageTimestamp:1,message:{imageMessage:{caption:'caption'}}};
  });
  const {store,flow,chat,adapter} = fixture;
  try {
    const upload = flow.stageImage(chat,{mime:'image/jpeg',width:2,height:3,bytes:Buffer.from('synthetic')},'upload');
    const queued = flow.manualSend(chat,{kind:'image',uploadId:upload.id,caption:'caption',reason:'test'},'send');
    assert.equal((await adapter.dispatch(queued.id)).state,'unknown'); store.cleanupImageUploads(flow.accountId,1001);
    assert.ok(store.imageUpload(flow.accountId,chat,upload.id));
    await flow.dispatch(queued.id,async () => {calls++;return {state:'accepted',transportId:'must-not-retry'};});
    assert.equal(calls,1); assert.equal(store.waMessage(flow.accountId,chat,'uncertain-image'),undefined);
  } finally {store.close();}
});
