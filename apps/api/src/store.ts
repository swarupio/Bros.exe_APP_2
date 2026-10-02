import { createHash, randomUUID } from 'node:crypto';
import { validFactValue, type Fact } from '@kayda-sathi/shared';
import type { Database } from './database.js';
import { APIError } from './errors.js';

export interface CaseRow { id: string; user_id: string; title: string; original_account: string; rev: number; pack_id: string | null; urgency: string; status:string; deleted_at: Date | null; current_plan_revision: number | null }
export interface FactRow { id: string; key: string; label: string; kind: Fact['kind']; value: unknown; raw_text: string | null; status: Fact['status']; source_type: string; retired_at?:Date|null }
export interface Snapshot { case: CaseRow; facts: FactRow[] }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,canonical(v)]));
  return value;
}
export const hashFacts = (facts: FactRow[]) => createHash('sha256').update(JSON.stringify(canonical(facts.filter(f => f.status === 'confirmed').map(f => ({ key: f.key, kind: f.kind, value: f.value })).sort((a,b) => a.key.localeCompare(b.key))))).digest('hex');

export class Store {
  constructor(public db: Database) {}
  async snapshot(user: string, id: string, includeDeleted = false): Promise<Snapshot> {
    return this.withSnapshot(user,id,async (_tx,snapshot) => snapshot,includeDeleted);
  }
  async withSnapshot<T>(user:string,id:string,run:(tx:Database,snapshot:Snapshot)=>Promise<T>,includeDeleted=false):Promise<T> {
    return this.db.transaction(async tx => {
      const [c] = await tx.query<CaseRow>(`select * from public.cases where id=$1::uuid and user_id=$2::uuid ${includeDeleted ? '' : 'and deleted_at is null'} for update`, [id,user]);
      if (!c) throw new APIError('CASE_NOT_FOUND',404);
      const facts = await tx.query<FactRow>('select * from public.facts where case_id=$1::uuid and retired_at is null order by key,created_at',[id]);
      return run(tx,{case:c,facts});
    });
  }
  async execute<T>(user:string,id:string,request:string,kind:string,run:(snapshot:Snapshot) => Promise<T>):Promise<T> {
    const snapshot=await this.snapshot(user,id);
    await this.db.transaction(async tx => {
      const [c]=await tx.query<CaseRow>('select * from public.cases where id=$1::uuid and user_id=$2::uuid for update',[id,user]);
      if (!c || c.deleted_at || c.rev!==snapshot.case.rev) throw new APIError('STALE_CASE');
      try { await tx.query(`insert into public.ai_requests(request_id,user_id,case_id,kind,status) values($1::uuid,$2::uuid,$3::uuid,$4,'pending') returning id`,[request,user,id,kind]); }
      catch(error) { if (/duplicate key|unique constraint/i.test(String(error))) throw new APIError('DUPLICATE_REQUEST'); throw error; }
    });
    const started=performance.now();
    try { return await run(snapshot); }
    catch(error) {
      const code=error instanceof APIError ? error.code : 'REQUEST_FAILED';
      await this.db.query(`update public.ai_requests set status=$1,error_code=$2 where request_id=$3::uuid and user_id=$4::uuid and status='pending' returning id`,[code==='STALE_CASE' ? 'stale' : 'error',code,request,user]).catch(() => {});
      throw error;
    } finally {
      // Metadata only; never retain inference inputs or outputs.
      await this.db.query('update public.ai_requests set latency_ms=$1 where request_id=$2::uuid and user_id=$3::uuid returning id',[Math.round(performance.now()-started),request,user]).catch(() => {});
    }
  }
  async commit<T>(user: string, snapshot: Snapshot, request: string, kind: string, fallback: boolean, fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async tx => {
      const [c] = await tx.query<CaseRow>('select * from public.cases where id=$1::uuid and user_id=$2::uuid for update',[snapshot.case.id,user]);
      if (!c || c.deleted_at || c.rev !== snapshot.case.rev) throw new APIError('STALE_CASE');
      const [prior] = await tx.query<{user_id:string;case_id:string;kind:string;status:string}>('select user_id,case_id,kind,status from public.ai_requests where request_id=$1::uuid for update',[request]);
      if (prior && (prior.user_id!==user || prior.case_id!==c.id || prior.kind!==kind || prior.status!=='pending')) throw new APIError('DUPLICATE_REQUEST');
      try {
        if (prior) await tx.query('update public.ai_requests set status=$1 where request_id=$2::uuid returning id',[fallback ? 'fallback' : 'ok',request]);
        else await tx.query(`insert into public.ai_requests(request_id,user_id,case_id,kind,status) values($1::uuid,$2::uuid,$3::uuid,$4,$5) returning id`,[request,user,c.id,kind,fallback ? 'fallback' : 'ok']);
      } catch (error) {
        if (/duplicate key|unique constraint/i.test(String(error))) throw new APIError('DUPLICATE_REQUEST');
        throw error;
      }
      return fn(tx);
    });
  }
  async proposals(tx: Database, caseId: string, facts: Fact[]) {
    const result: Fact[] = [];
    for (const f of facts) {
      const id = randomUUID();
      // Update suggestions never replace the user's existing confirmed ledger.
      await tx.query(`insert into public.facts(id,case_id,key,label,kind,value,raw_text,status,source_type)
        values($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,'proposed','ai_inferred') returning id`,
      [id,caseId,f.key,f.label,f.kind,JSON.stringify(f.value ?? null),f.raw_text ?? null]);
      result.push({ ...f,id,status:'proposed',source:'ai_inferred' });
    }
    return result;
  }
  async review(user: string, id: string, rev: number, facts: Fact[]) {
    return this.db.transaction(async tx => {
      const [c] = await tx.query<CaseRow>('select * from public.cases where id=$1::uuid and user_id=$2::uuid and deleted_at is null for update',[id,user]);
      if (!c || c.rev !== rev) throw new APIError('STALE_CASE');
      for (const f of facts) {
        if (!validFactValue(f)) throw new APIError('INVALID_FACT_VALUE',400);
        const own = await tx.query<FactRow>('select * from public.facts where id=$1::uuid and case_id=$2::uuid and retired_at is null',[f.id,id]);
        if (!own.length) throw new APIError('FACT_NOT_FOUND',404);
        if (f.key!==own[0].key) throw new APIError('IMMUTABLE_FACT_KEY',400);
        if (f.status === 'confirmed' || f.status === 'unknown') {
          // Explicit choice supersedes earlier candidates for the same key.
          await tx.query(`update public.facts set retired_at=now() where case_id=$1::uuid and key=$2 and id<>$3::uuid and retired_at is null returning id`,[id,f.key,f.id]);
        }
        const old=own[0];
        const changed=old.status==='confirmed' && (f.status!==old.status || f.kind!==old.kind || f.label!==old.label || JSON.stringify(canonical(f.value))!==JSON.stringify(canonical(old.value)));
        if (changed) {
          await tx.query('update public.facts set retired_at=now() where id=$1::uuid returning id',[old.id]);
          await tx.query(`insert into public.facts(case_id,key,label,kind,value,status,source_type,raw_text,supersedes_id)
            values($1::uuid,$2,$3,$4,$5::jsonb,$6,'user',$7,$8::uuid) returning id`,[id,f.key,f.label,f.kind,JSON.stringify(f.value ?? null),f.status,old.raw_text,old.id]);
        } else await tx.query(`update public.facts set value=$1::jsonb,status=$2,label=$3,kind=$4,source_type='user' where id=$5::uuid and case_id=$6::uuid returning id`,[JSON.stringify(f.value ?? null),f.status,f.label,f.kind,f.id,id]);
      }
      const [updated] = await tx.query<CaseRow>('select * from public.cases where id=$1::uuid',[id]);
      return { rev: updated.rev };
    });
  }
}

export function confirmedFacts(snapshot: Snapshot): FactRow[] {
  const confirmed = snapshot.facts.filter(f => f.status === 'confirmed');
  if (!confirmed.length) throw new APIError('FACTS_NOT_CONFIRMED',422);
  if (confirmed.length>50) throw new APIError('FACT_LIMIT_EXCEEDED',422);
  if (snapshot.facts.some(f => f.status === 'disputed')) throw new APIError('FACT_CONFLICT',422);
  const keys = new Set<string>();
  for (const f of snapshot.facts.filter(f => f.status==='proposed')) {
    const other=snapshot.facts.find(other => other.id!==f.id && other.key===f.key && (other.status==='confirmed' || other.status==='proposed') && JSON.stringify(canonical(other.value))!==JSON.stringify(canonical(f.value)));
    if (other) throw new APIError('FACT_CONFLICT',422);
  }
  for (const f of confirmed) {
    if (!validFactValue(f)) throw new APIError('INVALID_FACT_VALUE',422);
    if (keys.has(f.key)) throw new APIError('FACT_CONFLICT',422);
    keys.add(f.key);
  }
  return confirmed;
}
export function derivedAmounts(facts: FactRow[]) {
  const read = (key: string) => {
    const value = facts.find(f => f.key === key && f.status === 'confirmed')?.value as { inr?: number } | undefined;
    return typeof value?.inr === 'number' && Number.isSafeInteger(value.inr) && value.inr >= 0 ? value.inr : undefined;
  };
  const paid = read('amount_paid'), returned = read('amount_returned');
  if (paid === undefined || returned === undefined) return {};
  if (returned > paid) throw new APIError('AMOUNT_CONFLICT',422);
  return { amount_remaining: { inr: paid-returned } };
}
