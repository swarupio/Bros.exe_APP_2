import assert from "node:assert/strict";
import {
  draftRequestSchema, factSchema, fastChatRequestSchema, fastTranscriptionRequestSchema, healthResponseSchema, intakeRequestSchema,
  intakeResponseSchema, planRequestSchema,
} from "@kayda-sathi/shared";
import { mockIntake, contractFixtures } from "./fixtures.js";
import { createSupabaseTokenVerifier } from "./auth.js";
import { createApp } from "./server.js";

const caseId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const response = mockIntake(caseId);
const scenarios=contractFixtures(caseId);
assert.equal(Object.keys(scenarios).length,9);
assert.equal(scenarios.conflict.facts.length,2);
assert.equal(scenarios.general_plan.content.what_may_apply.length,0);
assert.equal(scenarios.sourced_plan.sources?.[0].status,'seed');
assert.equal(scenarios.update_diff.facts?.[0].status,'proposed');
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
assert.equal(draftRequestSchema.safeParse({ case_id: caseId, request_id: requestId, purpose: "legal_notice", language: "en", tone: "polite" }).success, false);
assert.equal(draftRequestSchema.safeParse({ case_id: caseId, request_id: requestId, purpose: "request", language: "hinglish", tone: "neutral" }).success, false);
assert.equal(draftRequestSchema.safeParse({ case_id: caseId, request_id: requestId, purpose: "request", language: "en", tone: "neutral" }).success, false);
assert.equal(fastChatRequestSchema.safeParse({ language: "hi", messages: [{ role: "user", content: "मुझे मदद चाहिए" }] }).success, true);
assert.equal(fastChatRequestSchema.safeParse({ language: "en", messages: [{ role: "assistant", content: "Hello" }] }).success, false);
assert.equal(fastTranscriptionRequestSchema.safeParse({ language: "mr", mime_type: "audio/webm", audio_base64: "YXVkaW8=" }).success, true);
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

let forwardedToken = "";
const verifySupabaseToken = createSupabaseTokenVerifier("https://project.example/", "publishable-test-key", async (input, init) => {
  assert.equal(String(input), "https://project.example/auth/v1/user");
  assert.equal(new Headers(init?.headers).get("apikey"), "publishable-test-key");
  forwardedToken = new Headers(init?.headers).get("authorization") ?? "";
  return new Response(JSON.stringify({ id: caseId }), { status: 200 });
});
assert.equal(await verifySupabaseToken("user-jwt"), caseId);
assert.equal(forwardedToken, "Bearer user-jwt");
assert.equal(await createSupabaseTokenVerifier("https://project.example", "key", async () => new Response("{}", { status: 401 }))("bad"), null);
await assert.rejects(createSupabaseTokenVerifier('https://project.example','key',async () => new Response('{}',{status:503}))('token'),/AUTH_UNAVAILABLE/);
await assert.rejects(createSupabaseTokenVerifier('https://project.example','key',async () => {throw new Error('offline');})('token'),/AUTH_UNAVAILABLE/);
assert.equal(await createSupabaseTokenVerifier('https://project.example','key',async () => new Response(JSON.stringify({id:'-'.repeat(36)})))('token'),null);

const previousOrigins = process.env.APP_ORIGINS;
process.env.APP_ORIGINS = "http://localhost:3000,https://localhost";
const app = createApp({ mockAI: true, groqApiKey: "" });
try {
  const response = await app.inject("/api/v1/health");
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().mock_ai, true);
  const androidOptions = await app.inject({ method: "OPTIONS", url: "/api/v1/fast", headers: { origin: "https://localhost" } });
  assert.equal(androidOptions.statusCode, 204);
  assert.equal(androidOptions.headers["access-control-allow-origin"], "https://localhost");
  const untrustedOrigin = await app.inject({ method: "OPTIONS", url: "/api/v1/fast", headers: { origin: "https://untrusted.example" } });
  assert.equal(untrustedOrigin.headers["access-control-allow-origin"], undefined);
  const unconfigured = await app.inject({ method: "POST", url: "/api/v1/fast", payload: { language: "en", messages: [{ role: "user", content: "I need help" }] } });
  assert.equal(unconfigured.statusCode, 503);
} finally {
  await app.close();
  if (previousOrigins === undefined) delete process.env.APP_ORIGINS;
  else process.env.APP_ORIGINS = previousOrigins;
}

const groqApp = createApp({ groqApiKey: "test-only", groqFetch: async (url, init) => {
  if (String(url).includes("/audio/transcriptions")) {
    assert.ok(init?.body instanceof FormData);
    return new Response(JSON.stringify({ text: "माझ्या बँकेत मदत हवी आहे", x_groq: { id: "provider-metadata" } }), { status: 200 });
  }
  assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions");
  const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
  assert.match(body.messages[0]?.content ?? "", /Marathi/);
  return new Response(JSON.stringify({ choices: [{ message: { content: "Keep the records together and contact the bank." } }] }), { status: 200 });
} });
try {
  const chat = await groqApp.inject({ method: "POST", url: "/api/v1/fast", payload: { language: "mr", messages: [{ role: "user", content: "मला मदत हवी आहे" }] } });
  assert.equal(chat.statusCode, 200);
  assert.equal(chat.json().reply, "Keep the records together and contact the bank.");
  const unicodeHistory=await groqApp.inject({method:'POST',url:'/api/v1/fast',payload:{language:'mr',messages:Array.from({length:10},(_,i) => ({role:i===9 ? 'user' : 'assistant',content:'म'.repeat(1200)}))}});
  assert.equal(unicodeHistory.statusCode,200);
  const transcript = await groqApp.inject({ method: "POST", url: "/api/v1/fast/transcribe", payload: { language: "mr", mime_type: "audio/webm", audio_base64: "YXVkaW8=" } });
  assert.equal(transcript.statusCode, 200);
  assert.match(transcript.json().text, /बँकेत/);
} finally {
  await groqApp.close();
}

console.log("API/shared contract self-check passed");
