import { intakeResponseSchema,planResponseSchema,draftResponseSchema,updateResponseSchema,apiErrorSchema } from "@kayda-sathi/shared";
import { packs } from './knowledge.js';

export function mockIntake(caseId: string) {
  return intakeResponseSchema.parse({
    case_id: caseId,
    title: "Rent deposit partly returned",
    issue_tags: ["housing", "deposit"],
    pack_id: "rent_deposit",
    urgency: "none",
    safety_reasons: [],
    user_role: "affected_person",
    facts: [{
      key: "amount_paid", label: "Deposit paid", kind: "amount", value: { inr: 50000 },
      raw_text: "pachaas hazaar", status: "proposed", source: "user",
    }],
    questions: [{
      id: "q1", key: "date_move_out", text: "When did you move out?", answer_type: "date",
      options: null, why: "Affects what to do next",
    }],
    restatement: "You paid ₹50,000 deposit and ₹15,000 has been returned.",
    fallback: true,
  });
}

/** Synthetic P0 handoff scenarios. No fixture represents a real user or live case. */
export function contractFixtures(caseId:string) {
  const id='00000000-0000-4000-8000-000000000010';
  const intake=mockIntake(caseId);
  const conflict=intakeResponseSchema.parse({...intake,facts:[{...intake.facts[0],id},{...intake.facts[0],id:'00000000-0000-4000-8000-000000000011',value:{inr:60000},source:'document',raw_text:'Agreement records 60000'}]});
  const general=planResponseSchema.parse({revision:1,fallback_used:true,change_summary:null,sources:[],content:{understood:{summary:'Preparation from confirmed facts only.',confirmed_fact_ids:[id],unknown_keys:[]},next_step:{title:'Prepare for consultation',why:'Specific rules have not been established.',kind:'prepare',resource_id:null,draft_purpose:'consultation_summary'},what_may_apply:[],steps:[{order:1,title:'Organise records',detail:'Write a timeline and questions.',kind:'practice',resource_id:null}],documents:[],help:[],if_not_working:[],uncertainties:[{text:'Specific legal rules have not been established.',impact:'Ask a qualified professional.'}],safety_notes:[],deadlines:[]}});
  const claim=packs.find(p => p.pack_id==='rent_deposit')!.claims.find(c => c.id==='RD-1')!;
  const sourced=planResponseSchema.parse({...general,fallback_used:false,sources:[{claim_id:claim.id,status:claim.status,source_name:claim.source.name,source_url:claim.source.url ?? null,last_checked:claim.last_checked}],content:{...general.content,what_may_apply:[{claim_id:claim.id,text:claim.text_en,applies_if:null}]}});
  const draft=draftResponseSchema.parse({draft:{id,version:1,body:'To [[FIELD: Recipient name]]\nDeposit paid: INR 50,000\nRequested response: [[FIELD: Requested response]]',facts_hash:'synthetic-fixture'},placeholders:['Recipient name','Requested response'],save_token:1,fallback_used:true,language:'en',requested_language:'en'});
  const update=updateResponseSchema.parse({interpretation:'A different amount was reported; confirm it before using it.',proposed_changes:[{key:'amount_paid',from:{inr:50000},to:{inr:60000},source:'ai_inferred'}],questions:[],facts:[{id,key:'amount_paid',label:'Deposit paid',kind:'amount',value:{inr:60000},raw_text:'60000',status:'proposed',source:'ai_inferred'}],case_rev:3,fallback_used:false});
  return {intake,conflict,general_plan:general,sourced_plan:sourced,invalid_plan_fallback:general,draft,update_diff:update,
    timeout:apiErrorSchema.parse({error:{code:'PROVIDER_TIMEOUT',message:'Use the preparation fallback',retryable:true}}),
    stale:apiErrorSchema.parse({error:{code:'STALE_CASE',message:'Reload the changed case',retryable:false}})};
}
