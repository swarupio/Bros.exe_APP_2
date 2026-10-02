import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from './database.js';
import { createApp } from './server.js';
import { Store } from './store.js';
import { Workflows } from './workflows.js';
import type { Inference } from './ai.js';

const engine=new PGlite();
await engine.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
  create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`);
const migrationFolder=new URL('../../../supabase/migrations/',import.meta.url);
for (const file of (await readdir(migrationFolder)).filter(f => f.endsWith('.sql')).sort()) await engine.exec(await readFile(new URL(file,migrationFolder),'utf8'));
const isolation=await readFile(new URL('../../../supabase/tests/ownership.sql',import.meta.url),'utf8');
await engine.exec(isolation.replace(/^\\set.*$/m,''));
console.log('Database migration and two-user RLS/storage/revision regression passed');

function wrap(e: Pick<PGlite,'query'>): Database {
  return {query:async <T>(sql:string,values:unknown[]=[]) => (await e.query<T>(sql,values)).rows,
    transaction:fn => engine.transaction(tx => fn(wrap(tx)))};
}
const db=wrap(engine),alice=randomUUID(),bob=randomUUID();
await db.query('insert into auth.users(id) values($1::uuid),($2::uuid) returning id',[alice,bob]);
const app=createApp({db,mockAI:true,verifyToken:async token => token==='alice' ? alice : token==='bob' ? bob : null,cleanup:async () => {}});
const request=async (method:'GET'|'POST'|'PATCH'|'DELETE',url:string,payload?:unknown,token='alice') => app.inject({method,url,headers:{authorization:`Bearer ${token}`},...(payload===undefined ? {} : {payload:payload as object})});
try {
  assert.equal((await app.inject({method:'GET',url:'/api/v1/cases'})).statusCode,401);
  const unknownRoute=await app.inject({method:'GET',url:'/api/v1/nonexistent'});
  assert.equal(unknownRoute.statusCode,404);assert.equal(unknownRoute.json().error.code,'NOT_FOUND');
  const created=await request('POST','/api/v1/cases',{original_account:'My landlord has not returned my rental deposit.'});
  assert.equal(created.statusCode,200); const caseId=created.json().id;
  assert.equal((await request('GET',`/api/v1/cases/${caseId}`,undefined,'bob')).statusCode,404);
  assert.equal((await app.inject({method:'POST',url:'/api/v1/knowledge/retrieve',payload:{case_id:caseId}})).statusCode,401);
  assert.equal((await request('POST','/api/v1/knowledge/retrieve',{case_id:caseId},'bob')).statusCode,404);
  const retrieved=await request('POST','/api/v1/knowledge/retrieve',{case_id:caseId,query:'What records help with my rental deposit?'});
  assert.equal(retrieved.statusCode,200);assert.equal(retrieved.json().topics[0].pack_id,'rent_deposit');
  assert.equal((await request('POST','/api/v1/knowledge/retrieve',{case_id:caseId,query:'x'.repeat(1001)})).statusCode,400);
  assert.equal((await request('POST','/api/v1/ai/plan',{case_id:caseId,request_id:randomUUID(),trigger:'initial'})).statusCode,422);
  const intake=await request('POST','/api/v1/ai/intake',{case_id:caseId,request_id:randomUUID()});
  assert.equal(intake.statusCode,200); assert.equal(intake.json().fallback,true);
  let rev=intake.json().case_rev;
  const manual=await request('POST',`/api/v1/cases/${caseId}/facts`,{expected_rev:rev,fact:{key:'amount_paid',label:'Deposit paid',kind:'amount',value:{inr:50000}}});
  assert.equal(manual.statusCode,200); rev=manual.json().case_rev;
  const f=manual.json().fact;
  const review=await request('POST',`/api/v1/cases/${caseId}/facts/confirm`,{expected_rev:rev,facts:[{id:f.id,key:f.key,label:f.label,kind:f.kind,value:f.value,status:'confirmed'}]});
  assert.equal(review.statusCode,200);
  const planRequest={case_id:caseId,request_id:randomUUID(),trigger:'initial'};
  const plan=await request('POST','/api/v1/ai/plan',planRequest);
  assert.equal(plan.statusCode,200); assert.equal(plan.json().revision,1);
  assert.equal(plan.json().retrieval.method,'lexical_bm25');
  const storedPlan=(await request('GET',`/api/v1/cases/${caseId}`)).json().plans[0];
  assert.deepEqual(storedPlan.content.retrieval,plan.json().retrieval);
  assert.equal((await request('POST','/api/v1/ai/plan',planRequest)).statusCode,409);
  const draft=await request('POST','/api/v1/ai/draft',{case_id:caseId,request_id:randomUUID(),purpose:'request',language:'en',tone:'polite'});
  assert.equal(draft.statusCode,200); const draftId=draft.json().draft.id;
  const saved=await request('PATCH',`/api/v1/drafts/${draftId}`,{expected_token:1,body:'My edited draft'});
  assert.equal(saved.statusCode,200); assert.equal(saved.json().save_token,2);
  const readiness=await request('POST','/api/v1/ai/draft/check',{case_id:caseId,draft_id:draftId});
  assert.equal(readiness.statusCode,200);assert.equal(readiness.json().ready,false);
  assert.ok(readiness.json().issues.some((i:{code:string}) => i.code==='MISSING_RECIPIENT'));
  const invalidJSON=await app.inject({method:'POST',url:'/api/v1/cases',headers:{authorization:'Bearer alice','content-type':'application/json'},payload:'{'});
  assert.equal(invalidJSON.statusCode,400);
  const oversized=await app.inject({method:'POST',url:'/api/v1/cases',headers:{authorization:'Bearer alice','content-type':'application/json'},payload:'x'.repeat(200000)});
  assert.equal(oversized.statusCode,413);
  assert.equal((await request('PATCH',`/api/v1/drafts/${draftId}`,{expected_token:1,body:'Overwrite'})).statusCode,409);
  const update=await request('POST','/api/v1/ai/update',{case_id:caseId,request_id:randomUUID(),outcome:'reply_received',note:'The landlord replied.',document_id:null});
  assert.equal(update.statusCode,200);
  const second=await request('POST','/api/v1/ai/plan',{case_id:caseId,request_id:randomUUID(),trigger:'update'});
  assert.equal(second.statusCode,200); assert.equal(second.json().revision,2);
  const reopened=(await request('GET',`/api/v1/cases/${caseId}`)).json();
  assert.equal(reopened.plans.length,2); assert.equal(reopened.drafts[0].body,'My edited draft');
  assert.equal(reopened.updates[0].plan_revision_after,2);
  await engine.exec(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${bob}',true);
    do $$ begin
      if exists(select 1 from public.plan_revisions) or exists(select 1 from public.drafts)
        or exists(select 1 from public.case_updates) then raise exception 'Generated data isolation failed'; end if;
    end $$; rollback;`);
  const s=new Store(db),snapshot=await s.snapshot(alice,caseId);
  await request('DELETE',`/api/v1/cases/${caseId}`);
  await assert.rejects(s.commit(alice,snapshot,randomUUID(),'intake',true,async tx => s.proposals(tx,caseId,[])),/STALE_CASE/);
  assert.equal((await request('GET',`/api/v1/cases/${caseId}`)).statusCode,404);
  // Actual in-flight inference: a changed/deleted parent rejects the late result.
  const [raceCase]=await db.query<{id:string}>('insert into public.cases(user_id,original_account) values($1::uuid,$2) returning id',[alice,'A rental deposit remains unpaid after moving out.']);
  let release!: () => void,signalStarted!: () => void;
  const started=new Promise<void>(resolve => { signalStarted=resolve; });
  const gate=new Promise<void>(resolve => { release=resolve; });
  const delayed:Inference={generate:async <T>(schema:import('zod').z.ZodType<T>,context:unknown) => {
    signalStarted(); await gate;
    const case_id=(context as {case_id:string}).case_id;
    return schema.parse({case_id,title:'Rent deposit',issue_tags:[],pack_id:'rent_deposit',urgency:'none',safety_reasons:[],user_role:'unknown',facts:[],questions:[],restatement:'Please review the account.'});
  }};
  const inFlight=new Workflows(s,delayed).intake(alice,{case_id:raceCase.id,request_id:randomUUID(),ui_lang:'en'});
  await started;
  await db.query('update public.cases set title=$1 where id=$2::uuid returning id',['Changed while inference runs',raceCase.id]);
  release();
  await assert.rejects(inFlight,/STALE_CASE/);
  const leaked=await db.query('select status,error_code from public.ai_requests where case_id=$1::uuid',[raceCase.id]);
  assert.equal(leaked.length,1); assert.equal(leaked[0].status,'stale'); assert.equal(leaked[0].error_code,'STALE_CASE');
  console.log('In-flight inference revision race rejects generated writes and records metadata-only stale status');

  // Schema-valid model output still remains proposed and uses canonical claims.
  const grounded:Inference={generate:async <T>(schema:import('zod').z.ZodType<T>,context:unknown) => {
    const input=context as {case_id?:string;account?:string;note?:string;allowed_claims?:unknown[];allowed_fact_ids?:string[];purpose?:string;tone?:string};
    const response=input.account ? {case_id:input.case_id,title:'Rent deposit',issue_tags:['housing'],pack_id:'rent_deposit',urgency:'none',safety_reasons:[],user_role:'affected_person',
      facts:[{key:'amount_paid',label:'Deposit paid',kind:'amount',value:{inr:50000},raw_text:'50000',status:'confirmed'}],questions:[],restatement:'You stated that you paid a deposit.'}
      : input.note ? {interpretation:'A partial return was reported.',facts:[{key:'amount_returned',label:'Amount returned',kind:'amount',value:{inr:15000},raw_text:'15000',status:'confirmed'}],questions:[]}
      : input.allowed_fact_ids ? {fact_ids:input.allowed_fact_ids,opening:input.purpose,tone:input.tone} : {claim_ids:['RD-1']};
    return schema.parse(response);
  }};
  const [liveCase]=await db.query<{id:string}>('insert into public.cases(user_id,original_account) values($1::uuid,$2) returning id',[alice,'I paid a rental deposit of 50000 and need it returned.']);
  const workflow=new Workflows(s,grounded);
  const extracted=await workflow.intake(alice,{case_id:liveCase.id,request_id:randomUUID(),ui_lang:'en'});
  assert.equal(extracted.facts[0].status,'proposed');
  await s.review(alice,liveCase.id,extracted.case_rev,[{...extracted.facts[0],status:'confirmed'}]);
  const sourced=await workflow.plan(alice,{case_id:liveCase.id,request_id:randomUUID(),trigger:'initial',explain_lang:'en'});
  assert.equal(sourced.sources?.[0].status,'seed');
  assert.equal(sourced.content.what_may_apply[0].claim_id,'RD-1');
  const originalDraft=await workflow.draft(alice,{case_id:liveCase.id,request_id:randomUUID(),purpose:'request',language:'en',tone:'polite'});
  const changed=await workflow.update(alice,{case_id:liveCase.id,request_id:randomUUID(),outcome:'partially_resolved',note:'The landlord returned 15000.',document_id:null});
  assert.equal(changed.facts[0].status,'proposed');
  assert.equal((await s.snapshot(alice,liveCase.id)).facts.filter(f => f.status==='confirmed').length,1);
  await s.review(alice,liveCase.id,changed.case_rev,[{...changed.facts[0],status:'confirmed'}]);
  const fresh=await s.snapshot(alice,liveCase.id);
  assert.notEqual(originalDraft.draft.facts_hash,(await import('./store.js')).hashFacts(fresh.facts));
  const regenerated=await workflow.draft(alice,{case_id:liveCase.id,request_id:randomUUID(),purpose:'request',language:'en',tone:'firm'});
  assert.equal(regenerated.draft.version,2); assert.match(regenerated.draft.body,/35,000/);
  const old=await db.query<{body:string}>('select body from public.drafts where id=$1::uuid',[originalDraft.draft.id]);
  assert.equal(old[0].body,originalDraft.draft.body);
  assert.equal(regenerated.fallback_used,false);
  const [unsafeCase]=await db.query<{id:string}>('insert into public.cases(user_id,original_account) values($1::uuid,$2) returning id',[alice,'I am being threatened by my landlord right now.']);
  await db.query(`insert into public.facts(case_id,key,label,kind,value,status,source_type) values($1::uuid,'amount_paid','Paid','amount','{"inr":50000}','confirmed','user') returning id`,[unsafeCase.id]);
  await assert.rejects(workflow.draft(alice,{case_id:unsafeCase.id,request_id:randomUUID(),purpose:'request',language:'en',tone:'polite'}),/UNSAFE_DIRECT_CONTACT/);
  // Changing an already confirmed value preserves the facts referenced by old plans.
  const paid=fresh.facts.find(f => f.key==='amount_paid')!;
  const current=await s.snapshot(alice,liveCase.id);
  await s.review(alice,liveCase.id,current.case.rev,[{id:paid.id,key:paid.key,label:paid.label,kind:paid.kind,value:{inr:60000},status:'confirmed'}]);
  const history=await db.query<{value:{inr:number};retired_at:unknown}>('select value,retired_at from public.facts where id=$1::uuid',[paid.id]);
  assert.equal(history[0].value.inr,50000); assert.ok(history[0].retired_at);
  const after=await s.snapshot(alice,liveCase.id);
  assert.equal((after.facts.find(f => f.key==='amount_paid')!.value as {inr:number}).inr,60000);
  // New conflicting proposals require an explicit choice before plan/draft writes.
  const newId=randomUUID();
  await db.query(`insert into public.facts(id,case_id,key,label,kind,value,status,source_type) values($1::uuid,$2::uuid,'amount_paid','Paid','amount','{"inr":70000}','proposed','ai_inferred') returning id`,[newId,liveCase.id]);
  await assert.rejects(workflow.plan(alice,{case_id:liveCase.id,request_id:randomUUID(),trigger:'update',explain_lang:'en'}),/FACT_CONFLICT/);
  const conflicted=await s.snapshot(alice,liveCase.id),chosen=conflicted.facts.find(f => f.id===newId)!;
  await s.review(alice,liveCase.id,conflicted.case.rev,[{id:chosen.id,key:chosen.key,label:chosen.label,kind:chosen.kind,value:null,status:'unknown'}]);
  assert.equal((await s.snapshot(alice,liveCase.id)).facts.filter(f => f.key==='amount_paid' && f.status==='confirmed').length,0);
  // Duplicate request while inference is running must not invoke the model twice.
  let providerCalls=0,resume!:()=>void,onStarted!:()=>void;
  const ready=new Promise<void>(resolve => {onStarted=resolve;});
  const held=new Promise<void>(resolve => {resume=resolve;});
  const waiting:Inference={generate:async <T>(schema:import('zod').z.ZodType<T>,context:unknown) => {providerCalls++;onStarted();await held;return grounded.generate(schema,context);}};
  const pendingFlow=new Workflows(s,waiting),duplicateId=randomUUID();
  const first=pendingFlow.intake(alice,{case_id:liveCase.id,request_id:duplicateId,ui_lang:'en'});
  await ready;
  await assert.rejects(pendingFlow.intake(alice,{case_id:liveCase.id,request_id:duplicateId,ui_lang:'en'}),/DUPLICATE_REQUEST/);
  assert.equal(providerCalls,1);resume();await first;
  // New threats reported in updates immediately change the deterministic safety gate.
  await workflow.update(alice,{case_id:liveCase.id,request_id:randomUUID(),outcome:'situation_changed',note:'I am being threatened right now.',document_id:null});
  const threatened=await s.snapshot(alice,liveCase.id);assert.equal(threatened.case.urgency,'urgent');
  await assert.rejects(workflow.draft(alice,{case_id:liveCase.id,request_id:randomUUID(),purpose:'request',language:'en',tone:'polite'}),/UNSAFE_DIRECT_CONTACT/);
  // Sent drafts freeze; edits also advance case revision to invalidate older inference.
  await db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub',$1,true) as uid`,[alice]);
    await tx.query('select * from public.save_draft($1::uuid,1,$2,$3)',[regenerated.draft.id,'To Someone\nRequested response: Review','user_reports_sent']);
  });
  await assert.rejects(db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub',$1,true) as uid`,[alice]);
    await tx.query('select * from public.save_draft($1::uuid,2,$2,$3)',[regenerated.draft.id,'Edited','draft_prepared']);
  }),/DRAFT_FROZEN/);
  // Cleanup failure retains a hidden retryable case; retry purges all children.
  let failures=1;
  const deletionApp=createApp({db,verifyToken:async () => alice,cleanup:async () => {if (failures-->0) throw new Error('storage unavailable');}});
  try {
    const del=() => deletionApp.inject({method:'DELETE',url:`/api/v1/cases/${liveCase.id}`,headers:{authorization:'Bearer alice'}});
    assert.equal((await del()).statusCode,503);
    assert.ok((await db.query<import('./store.js').CaseRow>('select * from public.cases where id=$1::uuid',[liveCase.id]))[0].deleted_at);
    assert.equal((await del()).statusCode,200);assert.equal((await del()).statusCode,200);
    for (const table of ['cases','facts','drafts','plan_revisions','case_updates','ai_requests']) {
      const rows=await db.query(`select id from public.${table} where ${table==='cases' ? 'id' : 'case_id'}=$1::uuid`,[liveCase.id]);assert.equal(rows.length,0,table);
    }
  } finally {await deletionApp.close();}
  console.log('Fact history/conflicts, pre-inference duplicate prevention, update safety, sent freeze and retryable hard deletion checks passed');
  console.log('Structured intake/update proposal confirmation, seed-source rendering and stale/versioned draft checks passed');
  console.log('Authenticated case → fallback intake → confirmation → plan → draft save → update → revision → deletion checks passed');
} finally { await app.close(); await engine.close(); }
