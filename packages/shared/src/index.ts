import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const amountSchema = z.object({ inr: z.number().int().nonnegative() }).strict();
export const supportedLanguageSchema = z.enum(["en", "hi", "mr"]);

export const factSchema = z.object({
  id: uuidSchema.optional(), key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(80), label: z.string().trim().min(1).max(160),
  kind: z.enum(["amount", "date", "party", "place", "bool", "enum", "text"]), value: z.unknown(),
  raw_text: z.string().max(3000).optional(), status: z.enum(["proposed", "confirmed", "disputed", "unknown"]),
  source: z.enum(["user", "document", "calculated", "ai_inferred"]).optional(),
}).strict();

export const intakeRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema, ui_lang: supportedLanguageSchema.default("en"),
}).strict();
export const intakeResponseSchema = z.object({
  case_id: uuidSchema, title: z.string().trim().min(1).max(120), issue_tags: z.array(z.string().max(80)).max(10), pack_id: z.string().nullable(),
  urgency: z.enum(["none", "elevated", "urgent"]), safety_reasons: z.array(z.string()),
  user_role: z.enum(["affected_person", "other_side", "helper", "unknown"]), facts: z.array(factSchema).max(30),
  questions: z.array(z.object({
    id: z.string(), key: z.string(), text: z.string(), answer_type: z.enum(["text", "date", "amount", "choice", "boolean"]),
    options: z.array(z.string()).nullable(), why: z.string(),
  }).strict()).max(3), restatement: z.string().max(1000), fallback: z.boolean().optional(), case_rev:z.number().int().positive().optional(),
}).strict();

export const retrievalRequestSchema=z.object({case_id:uuidSchema,query:z.string().trim().min(1).max(1000).optional()}).strict();
export const retrievalResponseSchema=z.object({
  method:z.literal('lexical_bm25'),corpus_version:z.string(),case_rev:z.number().int().positive(),
  topics:z.array(z.object({pack_id:z.string(),score:z.number().nonnegative(),reasons:z.array(z.string())}).strict()),
  ambiguous:z.boolean(),location:z.object({state:z.string().nullable(),district:z.string().nullable(),city:z.string().nullable()}).strict(),
  hits:z.array(z.object({id:z.string(),kind:z.enum(['claim','checklist','resource']),pack_id:z.string().nullable(),text:z.string(),score:z.number().nonnegative(),
    status:z.enum(['seed','verified']),source_name:z.string(),source_url:z.string().url().nullable(),last_checked:z.string(),reasons:z.array(z.string()),
    coverage:z.enum(['topic','national','state','district','city']),phone:z.string().nullable()}).strict()),
  questions:z.array(z.object({key:z.string(),text:z.string()}).strict()),warnings:z.array(z.string()),urgent:z.boolean(),
}).strict();
export type RetrievalResponse=z.infer<typeof retrievalResponseSchema>;

export const planContentSchema = z.object({
  understood: z.object({ summary: z.string(), confirmed_fact_ids: z.array(uuidSchema), unknown_keys: z.array(z.string()) }).strict(),
  next_step: z.object({ title: z.string(), why: z.string(), kind: z.enum(["prepare", "contact", "file", "call", "consult"]), resource_id: z.string().nullable(), draft_purpose: z.string().nullable() }).strict(),
  what_may_apply: z.array(z.object({ claim_id: z.string(), text: z.string(), applies_if: z.string().nullable() }).strict()),
  steps: z.array(z.object({ order: z.number().int().positive(), title: z.string(), detail: z.string(), kind: z.enum(["practice", "resource", "draft"]), resource_id: z.string().nullable() }).strict()),
  documents: z.array(z.object({ key: z.string(), label: z.string(), why: z.string(), alternatives: z.array(z.string()) }).strict()),
  help: z.array(z.object({ resource_id: z.string(), why_relevant: z.string() }).strict()),
  if_not_working: z.array(z.object({ when: z.string(), then: z.string() }).strict()),
  uncertainties: z.array(z.object({ text: z.string(), impact: z.string() }).strict()), safety_notes: z.array(z.string()),
  retrieval:retrievalResponseSchema.optional(),
  deadlines: z.array(z.object({ claim_id: z.string(), due: z.string(), label: z.string() }).strict()),
}).strict();
export const planRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema, trigger: z.enum(["initial", "update"]),
  explain_lang: supportedLanguageSchema.default("en"),
}).strict();
export const planResponseSchema = z.object({
  revision: z.number().int().positive(), fallback_used: z.boolean(), content: planContentSchema, change_summary: z.string().nullable(),
  sources: z.array(z.object({ claim_id:z.string(),status:z.enum(['seed','verified']),source_name:z.string(),source_url:z.string().url().nullable(),last_checked:z.string() }).strict()).optional(),
  retrieval:retrievalResponseSchema.optional(),
}).strict();

export const draftSchema = z.object({ id: uuidSchema, version: z.number().int().positive(), body: z.string(), facts_hash: z.string() }).strict();
export const draftRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema, purpose: z.enum(["request", "grievance", "follow_up", "consultation_summary"]), language: supportedLanguageSchema, tone: z.enum(["polite", "firm"]),
}).strict();
export const draftResponseSchema = z.object({ draft: draftSchema, placeholders: z.array(z.string()), save_token:z.number().int().positive().optional(), fallback_used:z.boolean().optional(), language:supportedLanguageSchema.optional(), requested_language:supportedLanguageSchema.optional() }).strict();

export const updateRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema,
  outcome: z.enum(["no_response", "reply_received", "partially_resolved", "asked_for_information", "situation_changed", "resolved"]),
  note: z.string().max(500), document_id: uuidSchema.nullable(),
}).strict();
export const updateResponseSchema = z.object({
  interpretation: z.string(), proposed_changes: z.array(z.object({ key: z.string(), from: z.unknown().nullable(), to: z.unknown(), source: z.string() }).strict()),
  questions: z.array(z.string()).max(3), facts:z.array(factSchema).optional(),case_rev:z.number().int().positive().optional(),fallback_used:z.boolean().optional(),
}).strict();

export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).strict() }).strict();
export const healthResponseSchema = z.object({ status: z.literal("ok"), kb_version: z.string(), mock_ai: z.boolean() }).strict();

export type Fact = z.infer<typeof factSchema>;
export type IntakeResponse = z.infer<typeof intakeResponseSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type DraftResponse = z.infer<typeof draftResponseSchema>;

export const caseCreateSchema = z.object({ original_account: z.string().min(20).max(3000).refine(s => s.trim().length>=20), title: z.string().trim().min(1).max(120).default('New case') }).strict();
export const factReviewSchema = z.object({ expected_rev: z.number().int().positive(), facts: z.array(factSchema.extend({ id: uuidSchema, status:z.enum(['confirmed','unknown','disputed']) })).min(1).max(50) }).strict().superRefine((input,ctx) => {
  if (new Set(input.facts.map(f => f.key)).size!==input.facts.length) ctx.addIssue({code:'custom',message:'Choose one resolution per fact key',path:['facts']});
});
export const draftSaveSchema = z.object({ expected_token: z.number().int().positive(), body: z.string().max(20000), status: z.enum(['draft_prepared','user_reports_sent']).default('draft_prepared') }).strict();
export const draftCheckSchema = z.object({ case_id: uuidSchema, draft_id: uuidSchema }).strict();
export const proposedUpdateSchema = z.object({ interpretation: z.string().max(1000), facts: z.array(factSchema).max(30), questions: z.array(z.string().max(300)).max(3) }).strict();
export type PlanContent = z.infer<typeof planContentSchema>;
export const factCreateSchema=z.object({expected_rev:z.number().int().positive(),fact:factSchema.omit({id:true,status:true,source:true})}).strict();
export const draftCompositionSchema=z.object({fact_ids:z.array(uuidSchema).max(50),opening:z.enum(['request','grievance','follow_up','consultation_summary']),tone:z.enum(['polite','firm'])}).strict();
export const readinessIssueSchema=z.object({code:z.enum(['EMPTY_DRAFT','PLACEHOLDERS','STALE_FACTS','AMOUNT_MISMATCH','MISSING_OUTCOME','MISSING_RECIPIENT','MISSING_ATTACHMENT','UNSAFE_WORDING']),message:z.string()}).strict();
export const readinessResponseSchema=z.object({placeholders:z.array(z.string()),stale:z.boolean(),ready:z.boolean(),issues:z.array(readinessIssueSchema)}).strict();
export const inferenceFactSchema=factSchema.extend({value:z.union([z.string().max(1000),amountSchema,z.object({date:z.iso.date()}).strict(),z.boolean(),z.null()])});
export const intakeInferenceSchema=intakeResponseSchema.omit({case_rev:true,fallback:true}).extend({facts:z.array(inferenceFactSchema).max(30)});
export const updateInferenceSchema=proposedUpdateSchema.extend({facts:z.array(inferenceFactSchema).max(30)});

export function validFactValue(fact: Pick<Fact,'kind'|'value'|'status'>): boolean {
  if (fact.status==='unknown') return fact.value===null;
  switch (fact.kind) {
    case 'amount': return amountSchema.safeParse(fact.value).success;
    case 'bool': return typeof fact.value==='boolean';
    case 'date': return z.object({date:z.iso.date()}).strict().safeParse(fact.value).success;
    default: return typeof fact.value==='string' && fact.value.length>0 && fact.value.length<=1000;
  }
}
