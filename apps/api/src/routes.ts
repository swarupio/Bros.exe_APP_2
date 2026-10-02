import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { caseCreateSchema, factReviewSchema, factCreateSchema, intakeRequestSchema, planRequestSchema, draftRequestSchema, updateRequestSchema, draftSaveSchema, draftCheckSchema, uuidSchema, validFactValue,retrievalRequestSchema } from '@kayda-sathi/shared';
import { Store, hashFacts, type CaseRow } from './store.js';
import { Workflows } from './workflows.js';
import type { Database } from './database.js';
import type { Inference } from './ai.js';
import { APIError } from './errors.js';
import { checkReadiness } from './draft-tools.js';
import { retrieveContext } from './retrieval.js';

export function registerRoutes(app: FastifyInstance, options: { db?: Database; ai?: Inference; cleanup?: (user:string,caseId:string) => Promise<void> }) {
  const store=options.db ? new Store(options.db) : undefined;
  const workflows=store ? new Workflows(store,options.ai) : undefined;
  const db=() => { if (!store) throw new APIError('DATABASE_NOT_CONFIGURED',503); return store; };
  const flows=() => { db(); return workflows!; };
  const id=(params:unknown) => z.object({id:uuidSchema}).parse(params).id;
  const auth={preHandler:app.requireAuth};
  app.get('/api/v1/cases',auth,async req => db().db.query('select id,title,status,urgency,rev,updated_at from public.cases where user_id=$1::uuid and deleted_at is null order by updated_at desc',[req.userId]));
  app.post('/api/v1/cases',auth,async req => {
    const input=caseCreateSchema.parse(req.body);
    const [row]=await db().db.query('insert into public.cases(user_id,original_account,title) values($1::uuid,$2,$3) returning id,rev,title',[req.userId,input.original_account,input.title]); return row;
  });
  app.get('/api/v1/cases/:id',auth,async req => {
    const caseId=id(req.params);
    return db().withSnapshot(req.userId!,caseId,async (tx,snapshot) => {
      const plans=await tx.query('select * from public.plan_revisions where case_id=$1::uuid order by revision',[caseId]);
      const drafts=await tx.query('select * from public.drafts where case_id=$1::uuid order by version',[caseId]);
      const updates=await tx.query('select * from public.case_updates where case_id=$1::uuid order by created_at,id',[caseId]);
      const fact_history=await tx.query('select * from public.facts where case_id=$1::uuid and retired_at is not null order by created_at,id',[caseId]);
      return {...snapshot,fact_history,plans,drafts,updates,facts_hash:hashFacts(snapshot.facts)};
    });
  });
  app.post('/api/v1/cases/:id/facts',auth,async req => {
    const s=db(),caseId=id(req.params);
    const input=factCreateSchema.parse(req.body);
    return s.db.transaction(async tx => {
      const [c]=await tx.query<CaseRow>('select * from public.cases where id=$1::uuid and user_id=$2::uuid and deleted_at is null for update',[caseId,req.userId]);
      if (!c || c.rev!==input.expected_rev) throw new APIError('STALE_CASE');
      const f=input.fact;
      if (!/^[a-z][a-z0-9_]*$/.test(f.key) || !validFactValue({...f,status:'proposed'})) throw new APIError('INVALID_FACT_VALUE',400);
      const [row]=await tx.query(`insert into public.facts(case_id,key,label,kind,value,status,source_type) values($1::uuid,$2,$3,$4,$5::jsonb,'proposed','user') returning *`,[caseId,f.key,f.label,f.kind,JSON.stringify(f.value ?? null)]);
      const [updated]=await tx.query<{rev:number}>('select rev from public.cases where id=$1::uuid',[caseId]); return {fact:row,case_rev:updated.rev};
    });
  });
  app.post('/api/v1/cases/:id/facts/confirm',auth,async req => { const input=factReviewSchema.parse(req.body); return db().review(req.userId!,id(req.params),input.expected_rev,input.facts); });
  app.post('/api/v1/ai/intake',auth,async req => flows().intake(req.userId!,intakeRequestSchema.parse(req.body)));
  app.post('/api/v1/knowledge/retrieve',auth,async req => {
    const input=retrievalRequestSchema.parse(req.body);
    const snapshot=await db().snapshot(req.userId!,input.case_id);
    return retrieveContext(snapshot,input.query);
  });
  app.post('/api/v1/ai/plan',auth,async req => flows().plan(req.userId!,planRequestSchema.parse(req.body)));
  app.post('/api/v1/ai/draft',auth,async req => flows().draft(req.userId!,draftRequestSchema.parse(req.body)));
  app.post('/api/v1/ai/update',auth,async req => flows().update(req.userId!,updateRequestSchema.parse(req.body)));
  app.post('/api/v1/ai/draft/check',auth,async req => {
    const input=draftCheckSchema.parse(req.body);
    return db().withSnapshot(req.userId!,input.case_id,async (tx,snapshot) => {
      const [draft]=await tx.query<{body:string;facts_hash:string;purpose:string}>('select body,facts_hash,purpose from public.drafts where id=$1::uuid and case_id=$2::uuid',[input.draft_id,input.case_id]);
      if (!draft) throw new APIError('DRAFT_NOT_FOUND',404);
      const documents=await tx.query(`select id from public.documents where case_id=$1::uuid and status in ('uploaded','analyzing','analyzed')`,[input.case_id]);
      return checkReadiness(draft,snapshot,documents.length);
    });
  });
  app.patch('/api/v1/drafts/:id',auth,async req => {
    const input=draftSaveSchema.parse(req.body),draftId=id(req.params);
    return db().db.transaction(async tx => {
      await tx.query(`select set_config('request.jwt.claim.sub',$1,true) as uid`,[req.userId]);
      try { const [row]=await tx.query('select * from public.save_draft($1::uuid,$2,$3,$4)',[draftId,input.expected_token,input.body,input.status]); return row; }
      catch (error) {
        const message=String(error);
        for (const code of ['DRAFT_CONFLICT','DRAFT_FROZEN','STALE_CASE','INVALID_DRAFT']) if (message.includes(code)) throw new APIError(code);
        throw error;
      }
    });
  });
  app.delete('/api/v1/cases/:id',auth,async req => {
    const caseId=id(req.params);
    await db().db.transaction(async tx => {
      const [c]=await tx.query<CaseRow>('select * from public.cases where id=$1::uuid and user_id=$2::uuid for update',[caseId,req.userId]);
      if (!c) {
        const other=await tx.query('select id from public.cases where id=$1::uuid',[caseId]);
        if (other.length) throw new APIError('CASE_NOT_FOUND',404);
        return;
      }
      if (!c.deleted_at) await tx.query('update public.cases set deleted_at=now() where id=$1::uuid returning id',[caseId]);
    });
    if (!options.cleanup) throw new APIError('STORAGE_CLEANUP_PENDING',503,true);
    try { await options.cleanup(req.userId!,caseId); } catch { throw new APIError('STORAGE_CLEANUP_PENDING',503,true); }
    await db().db.query('delete from public.cases where id=$1::uuid and user_id=$2::uuid and deleted_at is not null returning id',[caseId,req.userId]);
    return {deleted:true};
  });
}
