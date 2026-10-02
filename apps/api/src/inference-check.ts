import assert from 'node:assert/strict';
import { z } from 'zod';
import { inferOrFallback, AnthropicInference } from './ai.js';
import { hashFacts, derivedAmounts, confirmedFacts, type FactRow } from './store.js';
import { publicResources, emergency } from './knowledge.js';
import { validFactValue } from '@kayda-sathi/shared';

let attempts=0;
const schema=z.object({claim_ids:z.array(z.string())}).strict();
const invalid={generate:async <T>() => { attempts++; return {claim_ids:['fabricated-law']} as T; }};
const result=await inferOrFallback(invalid,schema,{},() => ({claim_ids:[]}),v => { if (v.claim_ids.length) throw new Error('INVALID_CLAIM'); return v; });
assert.equal(attempts,2); assert.equal(result.fallback,true); assert.deepEqual(result.value.claim_ids,[]);
assert.equal(emergency('I am being threatened').urgent,true);
assert.equal(emergency('I am not being threatened').urgent,false);
assert.ok(publicResources().resources.every(r => r.status==='verified' || r.phone===null));
const fact=(key:string,value:unknown,status:FactRow['status']='confirmed'):FactRow => ({id:'00000000-0000-4000-8000-000000000001',key,label:key,kind:'amount',value,status,raw_text:null,source_type:'user'});
assert.deepEqual(derivedAmounts([fact('amount_paid',{inr:50000}),fact('amount_returned',{inr:15000})]),{amount_remaining:{inr:35000}});
assert.throws(() => derivedAmounts([fact('amount_paid',{inr:100}),fact('amount_returned',{inr:200})]),/AMOUNT_CONFLICT/);
assert.deepEqual(derivedAmounts([fact('amount_paid',{inr:50000},'proposed'),fact('amount_returned',{inr:15000})]),{});
assert.equal(validFactValue({kind:'amount',value:{inr:-1},status:'confirmed'}),false);
assert.equal(validFactValue({kind:'bool',value:'true',status:'confirmed'}),false);
assert.equal(validFactValue({kind:'date',value:{date:'2026-02-30'},status:'confirmed'}),false);
assert.equal(validFactValue({kind:'text',value:'a'.repeat(3000),status:'confirmed'}),true);
assert.equal(validFactValue({kind:'text',value:'a'.repeat(3001),status:'confirmed'}),false);
assert.equal(validFactValue({kind:'party',value:'a'.repeat(1001),status:'confirmed'}),false);
assert.equal(hashFacts([fact('one',{a:1,b:2})]),hashFacts([fact('one',{b:2,a:1})]));
assert.throws(() => confirmedFacts({case:{} as never,facts:[fact('a',{inr:1}),fact('a',{inr:2})]}),/FACT_CONFLICT/);

// Test timeout/refusal handling without a network call or API credentials.
const originalFetch=globalThis.fetch;
try {
  globalThis.fetch=async () => new Response(JSON.stringify({stop_reason:'refusal',content:[]}),{status:200});
  await assert.rejects(new AnthropicInference('test','test').generate(schema,{}),/PROVIDER_INCOMPLETE/);
  globalThis.fetch=async () => { throw new DOMException('Timeout','TimeoutError'); };
  assert.equal((await inferOrFallback(new AnthropicInference('test','test'),schema,{},() => ({claim_ids:[]}))).fallback,true);
  let release!:()=>void;
  const held=new Promise<void>(resolve => {release=resolve;});
  globalThis.fetch=async () => {await held;return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'{"claim_ids":[]}'}]}),{status:200});};
  const limited=new AnthropicInference('test','test');
  const active=Array.from({length:4},() => limited.generate(schema,{}));
  await assert.rejects(limited.generate(schema,{}),/PROVIDER_BUSY/);
  release();await Promise.all(active);
} finally { globalThis.fetch=originalFetch; }
console.log('AI retry/fallback, refusal/timeout, safe resources, emergency negation, derived amounts and canonical hash checks passed');
