import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterClient } from '../src/openrouter.ts';

test('ASR failures record only the adapter stage and HTTP status, never request/response contents',async()=>{
  const observed:unknown[][]=[],warn=console.warn;
  console.warn=(...args:unknown[])=>{observed.push(args);};
  try {
    for(const mode of ['network','http','response'] as const){
      const client=new OpenRouterClient({apiKey:'synthetic-private-key',allowRemote:true,ownerConsent:true,fetcher:async()=>{
        if(mode==='network')throw new Error('synthetic-private-network-message');
        return mode==='http'?new Response('synthetic-private-provider-body',{status:403}):Response.json({text:42,private:'synthetic-private-response'});
      }});
      await assert.rejects(client.transcribe(Buffer.from('synthetic-private-audio'),()=>{}),mode==='network'?/transcription_unknown/:mode==='http'?/model_request_failed/:/invalid_transcript_response/);
    }
    assert.deepEqual(observed,[
      ['Voice transcription failed.',{stage:'network'}],
      ['Voice transcription failed.',{stage:'request',httpStatus:403}],
      ['Voice transcription failed.',{stage:'response',httpStatus:200}],
    ]);
    assert.equal(JSON.stringify(observed).includes('synthetic-private'),false);
  }finally{console.warn=warn;}
});
