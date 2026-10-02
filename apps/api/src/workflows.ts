import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { intakeResponseSchema, intakeInferenceSchema, inferenceFactSchema, updateInferenceSchema, draftCompositionSchema, draftResponseSchema, planResponseSchema, updateResponseSchema, validFactValue, type Fact } from '@kayda-sathi/shared';
import { inferOrFallback, type Inference } from './ai.js';
import { Store, confirmedFacts, derivedAmounts, hashFacts, type Snapshot } from './store.js';
import { packs, matchPack, emergency, publicResources } from './knowledge.js';
import { APIError } from './errors.js';
import { renderDraft,legalLint } from './draft-tools.js';

function validateProposals(facts: Fact[], text: string) {
  const seen = new Set<string>();
  return facts.map(f => {
    if (!validFactValue({...f,status:'proposed'})) throw new Error('INVALID_FACT_VALUE');
    if (f.kind==='date' && /(?:^|[\s,])(?:kal|कल)(?:$|[\s,])/iu.test(f.raw_text ?? '')) throw new Error('AMBIGUOUS_DATE');
    if (['party','place'].includes(f.kind) && typeof f.value==='string' && !(f.raw_text ?? '').normalize('NFKC').toLowerCase().includes(f.value.normalize('NFKC').toLowerCase())) throw new Error('UNGROUNDED_NAME');
    if (!/^[a-z][a-z0-9_]*$/.test(f.key) || seen.has(f.key) || !f.raw_text || !text.includes(f.raw_text)) throw new Error('UNGROUNDED_FACT');
    seen.add(f.key);
    return inferenceFactSchema.parse({ ...f, id:undefined,status:'proposed',source:'ai_inferred' });
  });
}
function unsafeContact(snapshot:Snapshot) {
  return snapshot.case.urgency!=='none' || emergency(snapshot.case.original_account).urgent || snapshot.facts.some(f => f.status==='confirmed' && ['threat_present','cannot_safely_contact'].includes(f.key) && f.value===true);
}
export class Workflows {
  constructor(private store: Store, private ai?: Inference) {}
  async intake(user: string, input: {case_id:string;request_id:string;ui_lang:string}) {
    return this.store.execute(user,input.case_id,input.request_id,'intake',snapshot => this.intakeWithSnapshot(user,input,snapshot));
  }
  private async intakeWithSnapshot(user:string,input:{case_id:string;request_id:string;ui_lang:string},snapshot:Snapshot) {
    const text = snapshot.case.original_account;
    const safety=emergency(text);
    const fallback = () => intakeInferenceSchema.parse({ case_id:input.case_id,title:snapshot.case.title,
      issue_tags:[],pack_id:matchPack(text),urgency:safety.urgent ? 'urgent' : 'none',safety_reasons:safety.reasons,user_role:'unknown',facts:[],
      questions:[{id:'describe_facts',key:'situation',text:'Which facts would you like to confirm about the situation?',answer_type:'text',options:null,why:'Only facts you confirm can be used in a plan.'}],
      restatement:'Please review your account and add the facts you want to confirm.' });
    const result = await inferOrFallback(this.ai,intakeInferenceSchema,{case_id:input.case_id,account:text,language:input.ui_lang,allowed_pack_ids:packs.map(p => p.pack_id)},fallback,v => {
      if (v.case_id !== input.case_id || (v.pack_id && !packs.some(p => p.pack_id === v.pack_id))) throw new Error('INVALID_INTAKE');
      if (legalLint([v.title,v.restatement,...v.questions.flatMap(q => [q.text,q.why]),...v.safety_reasons].join('\n')).length) throw new Error('UNSOURCED_INTAKE_TEXT');
      const proposed=validateProposals(v.facts,text);
      if (v.user_role!=='unknown' && !proposed.some(f => f.key==='user_role') && proposed.length<30) proposed.push(inferenceFactSchema.parse({key:'user_role',label:'Your role',kind:'enum',value:v.user_role,raw_text:text,status:'proposed',source:'ai_inferred'}));
      return {...v,urgency:safety.urgent ? 'urgent' as const : v.urgency,safety_reasons:[...new Set([...v.safety_reasons,...safety.reasons])],facts:proposed};
    });
    return this.store.commit(user,snapshot,input.request_id,'intake',result.fallback,async tx => {
      const facts = await this.store.proposals(tx,input.case_id,result.value.facts);
      const [c] = await tx.query<{rev:number}>(`update public.cases set title=$1,pack_id=$2,issue_tags=$3::text[],urgency=$4 where id=$5::uuid returning rev`,[result.value.title,result.value.pack_id,result.value.issue_tags,result.value.urgency,input.case_id]);
      const response={...result.value,facts,fallback:result.fallback,case_rev:c.rev}; intakeResponseSchema.parse(response); return response;
    });
  }
  async plan(user: string, input: {case_id:string;request_id:string;trigger:string;explain_lang:string}) {
    return this.store.execute(user,input.case_id,input.request_id,'plan',snapshot => this.planWithSnapshot(user,input,snapshot));
  }
  private async planWithSnapshot(user:string,input:{case_id:string;request_id:string;trigger:string;explain_lang:string},snapshot:Snapshot) {
    const facts = confirmedFacts(snapshot);
    const remaining=derivedAmounts(facts).amount_remaining;
    const pack = packs.find(p => p.pack_id === snapshot.case.pack_id);
    const allowed = pack?.claims.filter(c => c.status === 'verified' || (c.status === 'seed' && process.env.ALLOW_SEED_CLAIMS !== 'false')) ?? [];
    const resources=publicResources().resources.filter(r => /nalsa|dlsa|tele_law/.test(r.id) && (r.status==='verified' || (pack && process.env.ALLOW_SEED_CLAIMS!=='false')));
    const selectionSchema = z.object({claim_ids:z.array(z.string()).max(10),resource_ids:z.array(z.string()).max(5).default([])}).strict();
    const selection = await inferOrFallback(this.ai,selectionSchema,{facts,allowed_claims:allowed,allowed_resources:resources},() => ({claim_ids:[],resource_ids:resources.map(r => r.id)}),v => {
      if (new Set(v.claim_ids).size!==v.claim_ids.length || new Set(v.resource_ids).size!==v.resource_ids.length || v.claim_ids.some(id => !allowed.some(c => c.id === id)) || v.resource_ids.some(id => !resources.some(r => r.id===id))) throw new Error('UNKNOWN_SOURCE'); return v;
    },40000);
    const unsafe = unsafeContact(snapshot);
    // Model chooses IDs only. Every displayed assertion comes from the source pack.
    const content = planResponseSchema.shape.content.parse({
      understood:{summary:'This preparation plan uses the facts you confirmed.',confirmed_fact_ids:facts.map(f => f.id),unknown_keys:[...new Set([...snapshot.facts.filter(f => f.status === 'unknown').map(f => f.key),...['user_role','desired_outcome'].filter(key => !facts.some(f => f.key===key))])]},
      next_step:{title:unsafe ? 'Prepare safely and seek appropriate support' : snapshot.case.status==='resolved' ? 'Record the reported resolution' : remaining?.inr===0 ? 'Record returned payments and any unresolved issues' : 'Organise your evidence and requested response',why:'A clear record helps you explain the situation.',kind:'prepare',resource_id:null,draft_purpose:unsafe || snapshot.case.status==='resolved' || remaining?.inr===0 ? 'consultation_summary' : 'request'},
      what_may_apply:allowed.filter(c => selection.value.claim_ids.includes(c.id)).map(c => ({claim_id:c.id,text:c.text_en,applies_if:null})),
      steps:[{order:1,title:'Write a factual timeline',detail:'Record what happened and identify the records you have.',kind:'practice',resource_id:null}],
      documents:pack ? pack.checklist.map(d => ({key:d.key,label:d.label_en,why:d.why_en,alternatives:d.alternatives_en})) : [
        {key:'chronology',label:'Chronology of events',why:'Helps explain the order of events.',alternatives:['Write approximate dates and mark what is uncertain.']},
        {key:'available_records',label:'Available records',why:'Organises records you already have.',alternatives:['Messages or correspondence','A written account of what happened']},
        {key:'consultation_questions',label:'Questions for consultation',why:'Clarifies what professional advice you need.',alternatives:['List the facts you are unsure about and the outcome you want.']}],
      help:selection.value.resource_ids.map(id => ({resource_id:id,why_relevant:'A directory entry for information about legal assistance. Review its verification status before relying on contact details.'})),
      if_not_working:[{when:'You need advice on rights or a filing decision',then:'Ask a qualified legal professional to review the facts and documents.'}],
      uncertainties:[{text:selection.fallback ? 'AI guidance was unavailable; this is a preparation-only fallback.' : 'This preparation plan does not determine rights or predict an outcome.',impact:'Professional review may be needed.'},
        ...(!pack ? [{text:'Specific legal rules have not been established for this topic.',impact:'Use the preparation checklist and ask a qualified professional.'}] : []),
        ...(input.explain_lang === 'en' ? [] : [{text:'This preparation fallback is currently in English.',impact:'Translation is pending.'}])],
      safety_notes:unsafe ? ['Avoid direct contact when it is unsafe. Use the Safety sheet for urgent support.'] : [],deadlines:[],
    });
    const sources=allowed.filter(c => selection.value.claim_ids.includes(c.id)).map(c => ({claim_id:c.id,status:c.status,source_name:c.source.name,source_url:c.source.url ?? null,last_checked:c.last_checked}));
    const changeSummary=input.trigger==='update' ? 'Plan regenerated from the current confirmed facts.' : null;
    return this.store.commit(user,snapshot,input.request_id,'plan',selection.fallback,async tx => {
      const [row] = await tx.query<{revision:number}>(`insert into public.plan_revisions(case_id,revision,trigger,facts_hash,content,fallback_used,pack_version,sources,change_summary)
        select $1::uuid,coalesce(max(revision),0)+1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8::jsonb from public.plan_revisions where case_id=$1::uuid returning revision`,[input.case_id,input.trigger,hashFacts(facts),JSON.stringify(content),selection.fallback,pack?.pack_version ?? null,JSON.stringify(sources),JSON.stringify(changeSummary)]);
      await tx.query('update public.cases set current_plan_revision=$1 where id=$2::uuid returning id',[row.revision,input.case_id]);
      if (input.trigger==='update') await tx.query(`update public.case_updates set plan_revision_after=$1
        where id=(select id from public.case_updates where case_id=$2::uuid and plan_revision_after is null order by created_at desc,id desc limit 1) returning id`,[row.revision,input.case_id]);
      return planResponseSchema.parse({revision:row.revision,fallback_used:selection.fallback,content,
        sources,
        change_summary:changeSummary});
    });
  }
  async draft(user: string, input: {case_id:string;request_id:string;purpose:string;language:string;tone:string}) {
    return this.store.execute(user,input.case_id,input.request_id,'draft',snapshot => this.draftWithSnapshot(user,input,snapshot));
  }
  private async draftWithSnapshot(user:string,input:{case_id:string;request_id:string;purpose:string;language:string;tone:string},snapshot:Snapshot) {
    const facts = confirmedFacts(snapshot); derivedAmounts(facts);
    if (!['request','grievance','follow_up','consultation_summary'].includes(input.purpose)) throw new APIError('INVALID_PURPOSE',400);
    if (unsafeContact(snapshot) && input.purpose !== 'consultation_summary') throw new APIError('UNSAFE_DIRECT_CONTACT',422);
    const composition=await inferOrFallback(this.ai,draftCompositionSchema,{purpose:input.purpose,tone:input.tone,confirmed_facts:facts,allowed_fact_ids:facts.map(f => f.id)},() => ({fact_ids:facts.map(f => f.id),opening:input.purpose as 'request'|'grievance'|'follow_up'|'consultation_summary',tone:input.tone as 'polite'|'firm'}),v => {
      if (v.opening!==input.purpose || v.tone!==input.tone || v.fact_ids.length!==facts.length || new Set(v.fact_ids).size!==facts.length || v.fact_ids.some(id => !facts.some(f => f.id===id))) throw new Error('INVALID_DRAFT_COMPOSITION'); return v;
    });
    const ordered=composition.value.fact_ids.map(id => facts.find(f => f.id===id)!);
    const {body,placeholders}=renderDraft(snapshot,ordered,composition.value.opening,composition.value.tone);
    return this.store.commit(user,snapshot,input.request_id,'draft',composition.fallback,async tx => {
      const [{version}] = await tx.query<{version:number}>('select coalesce(max(version),0)+1 as version from public.drafts where case_id=$1::uuid and purpose=$2',[input.case_id,input.purpose]);
      await tx.query('update public.drafts set is_current=false where case_id=$1::uuid and purpose=$2 and is_current returning id',[input.case_id,input.purpose]);
      const id = randomUUID(), hash = hashFacts(facts);
      await tx.query(`insert into public.drafts(id,case_id,purpose,language,version,body,facts_hash,plan_revision) values($1::uuid,$2::uuid,$3,'en',$4,$5,$6,$7) returning id`,[id,input.case_id,input.purpose,version,body,hash,snapshot.case.current_plan_revision]);
      await tx.query('update public.cases set updated_at=now() where id=$1::uuid returning id',[input.case_id]);
      const response={draft:{id,version,body,facts_hash:hash},placeholders,save_token:1,fallback_used:composition.fallback,language:'en' as const,requested_language:input.language}; draftResponseSchema.parse(response); return response;
    });
  }
  async update(user: string, input: {case_id:string;request_id:string;outcome:string;note:string;document_id:string|null}) {
    return this.store.execute(user,input.case_id,input.request_id,'update',snapshot => this.updateWithSnapshot(user,input,snapshot));
  }
  private async updateWithSnapshot(user:string,input:{case_id:string;request_id:string;outcome:string;note:string;document_id:string|null},snapshot:Snapshot) {
    if (input.document_id) {
      const own = await this.store.db.query('select id from public.documents where case_id=$1::uuid and id=$2::uuid',[input.case_id,input.document_id]);
      if (!own.length) throw new APIError('DOCUMENT_NOT_FOUND',404);
    }
    const result = await inferOrFallback(this.ai,updateInferenceSchema,{note:input.note,outcome:input.outcome,confirmed_facts:snapshot.facts.filter(f => f.status === 'confirmed')},() => ({interpretation:'Your update has been recorded. Confirm any changed facts before generating a new plan.',facts:[],questions:[]}),v => {
      if (legalLint([v.interpretation,...v.questions].join('\n')).length) throw new Error('UNSOURCED_UPDATE_TEXT');
      return {...v,facts:validateProposals(v.facts,input.note)};
    });
    return this.store.commit(user,snapshot,input.request_id,'update',result.fallback,async tx => {
      const proposed = await this.store.proposals(tx,input.case_id,result.value.facts);
      await tx.query(`insert into public.case_updates(case_id,outcome,note,document_id) values($1::uuid,$2,$3,$4::uuid) returning id`,[input.case_id,input.outcome,input.note,input.document_id]);
      const safety=emergency(input.note);
      const [c] = await tx.query<{rev:number}>(`update public.cases set updated_at=now(),urgency=case when $2 then 'urgent' else urgency end,status=case when $3='resolved' then 'resolved' when $3='situation_changed' then 'open' else status end where id=$1::uuid returning rev`,[input.case_id,safety.urgent,input.outcome]);
      return {...updateResponseSchema.parse({interpretation:result.value.interpretation,questions:result.value.questions,proposed_changes:proposed.map(f => ({key:f.key,from:snapshot.facts.find(old => old.key === f.key && old.status === 'confirmed')?.value ?? null,to:f.value,source:'ai_inferred'}))}),facts:proposed,case_rev:c.rev,fallback_used:result.fallback};
    });
  }
}
