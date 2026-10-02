import assert from 'node:assert/strict';
// Exercise browser request coordination against a synthetic auth session and transport.
const entries=new Map<string,string>();
const surface=Object.assign(new EventTarget(),{localStorage:{getItem:(key:string)=>entries.get(key) ?? null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)}});
Object.assign(globalThis,{window:surface});
const setUser=(id:string) => entries.set('kayda-sathi-auth-session',JSON.stringify({access_token:'synthetic-token',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id}}));
setUser('alice');
const {apiRequest,apiWorkflowRequest}=await import('../../mobile/lib/supabase.js');
const originalFetch=globalThis.fetch;
try {
  let calls=0,finish!:(value:Response)=>void;
  globalThis.fetch=async () => {calls++;return new Promise<Response>(resolve=>{finish=resolve;});};
  const first=apiWorkflowRequest('/ai/plan',{case_id:'case',trigger:'initial'},1);
  const second=apiWorkflowRequest('/ai/plan',{case_id:'case',trigger:'initial'},1);
  assert.equal(first,second);
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,1);
  finish(new Response(JSON.stringify({revision:1}),{status:200}));await Promise.all([first,second]);
  const next=apiWorkflowRequest('/ai/plan',{case_id:'case',trigger:'initial'},2);
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,2);
  finish(new Response(JSON.stringify({error:{code:'STALE_CASE'}}),{status:409}));await assert.rejects(next,/changed/);
  const retry=apiWorkflowRequest('/ai/plan',{case_id:'case',trigger:'initial'},2);
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,3);
  finish(new Response('{}'));await retry;
  const pending=apiRequest('/cases',undefined,'GET');
  await new Promise(resolve=>setTimeout(resolve,0));setUser('bob');
  finish(new Response(JSON.stringify([{title:'Alice private case'}])));
  await assert.rejects(pending,/Sign in/);
} finally {globalThis.fetch=originalFetch;}
console.log('Client request deduplication, failed-request retry and account-switch response isolation passed');
