import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterClient } from '../src/openrouter.ts';
import type { ModelContext } from '@replybot/core';

test('bounded provider strings still receive runtime single-emoji and sequence-total validation',async()=>{
  const context:ModelContext={instructions:'Synthetic only',messages:[],memories:[],styleExamples:[],limitations:[],worstCaseTextTokens:100};
  const fire={kind:'reaction',reaction:{targetMessageId:'target',emoji:'🔥'},reason:'test'};
  const sequence={kind:'text_sequence',messages:[{text:'one',quotedMessageId:null},{text:'two',quotedMessageId:null}],reason:'test'};
  let action:unknown=fire;
  const fetcher:typeof fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({action})}}]}));
  const client=new OpenRouterClient({apiKey:'synthetic',allowRemote:true,ownerConsent:true,fetcher});
  assert.deepEqual(await client.generate(context),fire);action=sequence;assert.deepEqual(await client.generate(context),sequence);
  for(const invalid of [
    {...fire,reaction:{targetMessageId:'target',emoji:'fire'}},
    {...fire,reaction:{targetMessageId:'target',emoji:'🔥🔥'}},
    {...sequence,messages:[{text:'a'.repeat(2500),quotedMessageId:null},{text:'b'.repeat(2500),quotedMessageId:null}]},
    {...sequence,messages:[{text:'',quotedMessageId:null},{text:'two',quotedMessageId:null}]},
  ]){action=invalid;await assert.rejects(client.generate(context),/invalid_model_response/);}
});
