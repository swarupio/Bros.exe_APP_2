import assert from "node:assert/strict";
import {
  draftRequestSchema, factSchema, healthResponseSchema, intakeRequestSchema,
  intakeResponseSchema, planRequestSchema,
} from "@kayda-sathi/shared";
import { mockIntake } from "./fixtures.js";
import { createApp } from "./server.js";

const caseId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const response = mockIntake(caseId);
assert.equal(mockIntake(caseId).facts[0]?.status, "proposed");
assert.equal(mockIntake(caseId).fallback, true);
assert.throws(() => mockIntake("not-a-uuid"));
assert.ok(response.questions.length <= 3);
assert.equal(response.user_role, "affected_person");
assert.equal(response.urgency, "none");
assert.equal(intakeRequestSchema.safeParse({ case_id: caseId, request_id: requestId, ui_lang: "mr" }).success, true);
assert.equal(intakeRequestSchema.safeParse({ case_id: caseId, request_id: requestId, ui_lang: "hinglish" }).success, false);
assert.equal(planRequestSchema.safeParse({ case_id: caseId, request_id: requestId, trigger: "initial", explain_lang: "hi" }).success, true);
assert.equal(planRequestSchema.safeParse({ case_id: caseId, request_id: requestId, trigger: "initial", explain_lang: "hinglish" }).success, false);
assert.equal(draftRequestSchema.safeParse({ case_id: caseId, request_id: requestId, purpose: "request", language: "en", tone: "firm" }).success, true);
assert.equal(draftRequestSchema.safeParse({ case_id: caseId, request_id: requestId, purpose: "request", language: "hinglish", tone: "neutral" }).success, false);
assert.equal(draftRequestSchema.safeParse({ case_id: caseId, request_id: requestId, purpose: "request", language: "en", tone: "neutral" }).success, false);
for (const user_role of ["affected_person", "other_side", "helper", "unknown"]) {
  assert.equal(intakeResponseSchema.safeParse({ ...response, user_role }).success, true);
}
assert.equal(intakeResponseSchema.safeParse({ ...response, user_role: "other_party" }).success, false);
for (const kind of ["amount", "date", "party", "place", "bool", "enum", "text"]) {
  assert.equal(factSchema.safeParse({ key: "x", label: "X", kind, value: null, status: "proposed" }).success, true);
}
for (const kind of ["boolean", "person", "location"]) {
  assert.equal(factSchema.safeParse({ key: "x", label: "X", kind, value: null, status: "proposed" }).success, false);
}
for (const urgency of ["emergency", "low"]) {
  assert.equal(intakeResponseSchema.safeParse({ ...response, urgency }).success, false);
}
assert.equal(intakeResponseSchema.safeParse({ ...response, questions: [...response.questions, ...response.questions, ...response.questions, ...response.questions] }).success, false);
healthResponseSchema.parse({ status: "ok", kb_version: "1.0.0", mock_ai: true });

const app = createApp({ mockAI: true });
try {
  const response = await app.inject("/api/v1/health");
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().mock_ai, true);
} finally {
  await app.close();
}

console.log("API/shared contract self-check passed");
