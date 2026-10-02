import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const amountSchema = z.object({ inr: z.number().int().nonnegative() }).strict();
export const supportedLanguageSchema = z.enum(["en", "hi", "mr"]);

export const factSchema = z.object({
  id: uuidSchema.optional(), key: z.string().min(1), label: z.string().min(1),
  kind: z.enum(["amount", "date", "party", "place", "bool", "enum", "text"]), value: z.unknown(),
  raw_text: z.string().optional(), status: z.enum(["proposed", "confirmed", "disputed", "unknown"]),
  source: z.enum(["user", "document", "calculated", "ai_inferred"]).optional(),
}).strict();

export const intakeRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema, ui_lang: supportedLanguageSchema.default("en"),
}).strict();
export const intakeResponseSchema = z.object({
  case_id: uuidSchema, title: z.string(), issue_tags: z.array(z.string()), pack_id: z.string().nullable(),
  urgency: z.enum(["none", "elevated", "urgent"]), safety_reasons: z.array(z.string()),
  user_role: z.enum(["affected_person", "other_side", "helper", "unknown"]), facts: z.array(factSchema),
  questions: z.array(z.object({
    id: z.string(), key: z.string(), text: z.string(), answer_type: z.enum(["text", "date", "amount", "choice", "boolean"]),
    options: z.array(z.string()).nullable(), why: z.string(),
  }).strict()).max(3), restatement: z.string(), fallback: z.boolean().optional(),
}).strict();

const planContentSchema = z.object({
  understood: z.object({ summary: z.string(), confirmed_fact_ids: z.array(uuidSchema), unknown_keys: z.array(z.string()) }).strict(),
  next_step: z.object({ title: z.string(), why: z.string(), kind: z.enum(["prepare", "contact", "file", "call", "consult"]), resource_id: z.string().nullable(), draft_purpose: z.string().nullable() }).strict(),
  what_may_apply: z.array(z.object({ claim_id: z.string(), text: z.string(), applies_if: z.string().nullable() }).strict()),
  steps: z.array(z.object({ order: z.number().int().positive(), title: z.string(), detail: z.string(), kind: z.enum(["practice", "resource", "draft"]), resource_id: z.string().nullable() }).strict()),
  documents: z.array(z.object({ key: z.string(), label: z.string(), why: z.string(), alternatives: z.array(z.string()) }).strict()),
  help: z.array(z.object({ resource_id: z.string(), why_relevant: z.string() }).strict()),
  if_not_working: z.array(z.object({ when: z.string(), then: z.string() }).strict()),
  uncertainties: z.array(z.object({ text: z.string(), impact: z.string() }).strict()), safety_notes: z.array(z.string()),
  deadlines: z.array(z.object({ claim_id: z.string(), due: z.string(), label: z.string() }).strict()),
}).strict();
export const planRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema, trigger: z.enum(["initial", "update"]),
  explain_lang: supportedLanguageSchema.default("en"),
}).strict();
export const planResponseSchema = z.object({
  revision: z.number().int().positive(), fallback_used: z.boolean(), content: planContentSchema, change_summary: z.string().nullable(),
}).strict();

export const draftSchema = z.object({ id: uuidSchema, version: z.number().int().positive(), body: z.string(), facts_hash: z.string() }).strict();
export const draftRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema, purpose: z.enum(["request", "grievance", "follow_up", "consultation_summary"]), language: supportedLanguageSchema, tone: z.enum(["polite", "firm"]),
}).strict();
export const draftResponseSchema = z.object({ draft: draftSchema, placeholders: z.array(z.string()) }).strict();

export const updateRequestSchema = z.object({
  case_id: uuidSchema, request_id: uuidSchema,
  outcome: z.enum(["no_response", "reply_received", "partially_resolved", "asked_for_information", "situation_changed", "resolved"]),
  note: z.string().max(500), document_id: uuidSchema.nullable(),
}).strict();
export const updateResponseSchema = z.object({
  interpretation: z.string(), proposed_changes: z.array(z.object({ key: z.string(), from: z.unknown().nullable(), to: z.unknown(), source: z.string() }).strict()),
  questions: z.array(z.string()),
}).strict();

export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).strict() }).strict();
export const healthResponseSchema = z.object({ status: z.literal("ok"), kb_version: z.string(), mock_ai: z.boolean() }).strict();

export type Fact = z.infer<typeof factSchema>;
export type IntakeResponse = z.infer<typeof intakeResponseSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type DraftResponse = z.infer<typeof draftResponseSchema>;
