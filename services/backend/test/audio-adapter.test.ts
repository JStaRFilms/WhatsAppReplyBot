import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterClient, AUDIO_MODEL, resolveAudioModel } from '../src/openrouter.ts';

const bytes=Buffer.from('synthetic-mp3');
const client=(fetcher:typeof fetch,audioModel?:string)=>new OpenRouterClient({apiKey:'synthetic-key',allowRemote:true,ownerConsent:true,
  fetcher,...(audioModel===undefined?{}:{audioModel})});

test('missing and exact legacy settings select Turbo; unsupported settings and disabled/key/guard failures export nothing',async()=>{
  let calls=0;
  const fetcher:typeof fetch=async(url,init)=>{
    calls++;assert.equal(url,'https://openrouter.ai/api/v1/audio/transcriptions');assert.equal(init?.method,'POST');assert.equal(init.redirect,'error');
    assert.deepEqual(JSON.parse(String(init?.body)),{model:AUDIO_MODEL,input_audio:{data:bytes.toString('base64'),format:'mp3'},response_format:'verbose_json',temperature:0});
    const headers=new Headers(init?.headers);assert.equal(headers.get('Authorization'),'Bearer synthetic-key');
    assert.equal(headers.get('X-OpenRouter-App-Visibility'),'hidden');
    assert.ok(init?.signal);return Response.json({text:'Original — punctuation, no wahala.',language:'en',confidence:0.95});
  };
  for(const setting of [undefined,'google/gemini-3.8-flash',AUDIO_MODEL]){
    assert.equal(resolveAudioModel(setting),AUDIO_MODEL);
    assert.deepEqual(await client(fetcher,setting).transcribe(bytes,()=>{}),{text:'Original — punctuation, no wahala.',uncertain:false});
  }
  assert.equal(calls,3);
  await assert.rejects(client(fetcher,'custom/model').transcribe(bytes,()=>{}),/unsupported_audio_model/);
  await assert.rejects(client(fetcher).transcribe(bytes,()=>{throw new Error('guard_denied');}),/guard_denied/);
  for(const options of [{apiKey:'synthetic-key',allowRemote:false,ownerConsent:true},{apiKey:'synthetic-key',allowRemote:true,ownerConsent:false},{apiKey:'',allowRemote:true,ownerConsent:true}]){
    await assert.rejects(new OpenRouterClient({...options,fetcher}).transcribe(bytes,()=>{}),/live_model_disabled|model_key_missing/);
  }
  await assert.rejects(client(fetcher).transcribe(Buffer.alloc(10*1024*1024+1),()=>{}),/audio_too_large/);
  assert.equal(calls,3);
});

test('bounded verbose STT parsing preserves text and silence and treats missing or weak confidence as uncertain',async()=>{
  for(const [response,expected] of [
    [{text:'',language:'english'},{text:'',uncertain:true}],
    [{text:'Abeg, ça va?',segments:[{text:'Abeg, ça va?',start:0,end:1,avg_logprob:-0.2,no_speech_prob:0.01}]},{text:'Abeg, ça va?',uncertain:true}],
    [{text:'words',confidence:0.8},{text:'words',uncertain:true}],
    [{text:'words',confidence:0.99,segments:[{text:'words',confidence:0.4}]},{text:'words',uncertain:true}],
    [{text:'words',confidence:0.99,segments:[{text:'words',avg_logprob:-2}]},{text:'words',uncertain:true}],
    [{text:'words',confidence:0.99,segments:[{text:'words',no_speech_prob:0.9}]},{text:'words',uncertain:true}],
    [{text:'words',confidence:0.99,language:'english',segments:[{text:'words',start:0,end:2,speaker:12}]},{text:'words',uncertain:false}],
  ] as const){assert.deepEqual(await client(async()=>Response.json(response)).transcribe(bytes,()=>{}),expected);}
});

test('malformed and over-limit paid responses fail with codes, not raw provider text; no retry or chat fallback',async()=>{
  const privateMarker='synthetic-provider-secret-not-for-errors';let calls=0;
  for(const response of [
    {choices:[{message:{content:privateMarker}}]}, {text:15}, {text:'x'.repeat(12001)},
    {text:'words',language:'x'.repeat(129)}, {text:'words',confidence:2}, {text:'words',duration:301},
    {text:'words',segments:Array.from({length:1001},()=>({text:'x'}))}, {text:'words',segments:[{text:'x',no_speech_prob:2}]},
  ]){
    const model=client(async()=>{calls++;return Response.json({...response,privateMarker});});
    await assert.rejects(model.transcribe(bytes,()=>{}),error=>error instanceof Error && error.message==='invalid_transcript_response' && !error.message.includes(privateMarker));
  }
  for(const response of [new Response(privateMarker),new Response(Buffer.concat([Buffer.from('{"text":"'),Buffer.from([0xff]),Buffer.from('"}')])),new Response('x'.repeat(256*1024+1)),new Response('{}',{headers:{'content-length':String(256*1024+1)}})]){
    await assert.rejects(client(async()=>{calls++;return response;}).transcribe(bytes,()=>{}),/invalid_transcript_response/);
  }
  await assert.rejects(client(async()=>{calls++;throw new Error(privateMarker);}).transcribe(bytes,()=>{}),/^Error: transcription_unknown$/);
  await assert.rejects(client(async()=>{calls++;return new Response(privateMarker,{status:500});}).transcribe(bytes,()=>{}),/^Error: model_request_failed$/);
  assert.equal(calls,14);
});
