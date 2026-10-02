# Swarup S-001–S-006 backend handoff

## Configuration

The supplied Supabase URL and publishable key are configured in ignored `apps/mobile/.env.local` and `apps/api/.env`. Supabase Auth's settings endpoint responded HTTP 200 with email enabled. No account was created or remote schema changed in this pass.

Required server-only values: `DATABASE_URL` (Supabase Session pooler), `ANTHROPIC_API_KEY`, and `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY` for storage cleanup. `pnpm --filter @kayda-sathi/api check:env` reports missing variable names without printing values. A publishable key cannot provide privileged database access. `MOCK_AI=true` explicitly disables provider calls; fallback outputs also identify themselves when provider access is absent or fails.

Use Node 22.12 LTS or 24+ (Prisma 7 excludes Node 22.11 and 23). Run `pnpm install`, `pnpm --filter @kayda-sathi/api db:generate`, `pnpm --filter @kayda-sathi/api db:apply`, then `pnpm dev:api`. Keep migration security review separate from application of the schema. See `supabase/README.md` for Prisma role/connection setup. The browser client and authenticated fetch helper are in `apps/mobile/lib/supabase.ts`; the current demo screens have not been connected to them.

## Frontend contract

All routes use `/api/v1`. Public: `GET /health`, `GET /resources`. Authenticated routes require the Supabase access token as a Bearer token, verified server-side through `auth.getUser`.

| Route | Input / result |
|---|---|
| `POST /cases` | `original_account` (20–3000 chars), optional `title`; returns `id`, `rev`, `title` |
| `GET /cases` | Owned nondeleted cases |
| `GET /cases/:id` | Coherent case/facts/plans/drafts snapshot, retired `fact_history`, updates and confirmed-facts hash |
| `POST /cases/:id/facts` | `expected_rev`, `fact` with key/label/kind/value; adds a proposed user fact for manual fallback review |
| `POST /cases/:id/facts/confirm` | `expected_rev`, facts including IDs and explicit confirmed/unknown/disputed status; returns new `rev` |
| `POST /ai/intake` | Shared intake request; returns proposals, max-three questions, `case_rev`, `fallback` |
| `POST /ai/plan` | Shared plan request; returns immutable revision, preparation plan, selected source metadata and fallback flag |
| `POST /ai/draft` | Shared draft request; returns new draft version, placeholder list, `save_token`, fallback/language metadata |
| `PATCH /drafts/:id` | `expected_token`, `body`, optional `status`; returns incremented `save_token` |
| `POST /ai/draft/check` | `case_id`, `draft_id`; returns placeholders, `stale`, `ready` and actionable `issues` |
| `POST /ai/update` | Shared update request; returns interpretation, proposed fact diff, IDs for review and `case_rev` |
| `DELETE /cases/:id` | Hides case, cleans evidence recursively, then hard-deletes case/children; repeating retries failures |

Every inference request has a fresh `request_id` UUID. The database reserves it before any provider call; duplicate requests return 409 without another inference call. Do not reuse a UUID for different operations, including failed requests. `STALE_CASE` means reload and review changed facts. `DRAFT_CONFLICT` means preserve unsaved text and reload the server version before deciding what to save. Never silently overwrite it. Confirming a choice for a key retires competing candidates; selecting unknown must supply `value:null`. Editing a confirmed value creates a new fact version so old plan references retain the original value. Refetch after confirmation. Browser fact mutations must use the revision-checked API; direct Supabase writes are disabled by migration 002. Amount values use `{inr:50000}` and dates use `{date:"2026-10-02"}`. Other kinds use strings except bool, which uses a boolean.

Updates record the event and propose changed facts. They do not auto-confirm changes or overwrite a plan/draft. After explicit review, call `/ai/plan` with `trigger:"update"`; old revisions and edited draft text remain available.

## Safety and validation

Plans and drafts require confirmed facts, reject unresolved materially different proposals and derive amounts/hash in code. AI-generated intake/update facts require exact input provenance, always remain proposed, and are schema-validated. Ambiguous `kal` dates are rejected for clarification. Structured output is retried at most once within a total time budget (20 seconds intake/update/draft; 40 seconds plan); refusal, truncation, invalid schema, unsupported claim or provider timeout uses a useful fallback. The provider schema omits unsupported constraints while local Zod validation keeps them. Plan inference only selects approved claim/resource IDs; assertion text comes from the source pack. Verified metadata is checked at runtime, and source snapshots persist with the plan. Unreviewed phone numbers are suppressed. Safety matching preserves Devanagari vowel marks and negation; explicitly framed fictional scenarios do not trigger current-user danger. Threats in updates immediately suppress direct-contact drafts. General plans include a neutral evidence checklist and explicitly state that specific legal rules have not been established.

Draft composition now uses constrained model inference to order confirmed fact IDs and select the requested purpose/tone; trusted English templates render the text. The model cannot insert free-form legal prose or invent facts. Provider failure uses deterministic ordering and reports `fallback_used:true`. Unknown fields remain visible placeholders; confirmed role/outcome inform the wording. Readiness checks empty text, placeholders, changed facts, ledger amount mismatches, missing recipient/outcome, referenced missing attachments and unsafe wording. These checks assist review; they are not a legal-validity score or a claim of exhaustive semantic understanding. English output reports the requested versus actual language; translation and an optional free-form model tone review remain P1.

`src/fixtures.ts` exports nine validated synthetic P0 scenarios for frontend handoff, including conflicts, general/sourced/fallback plans, draft placeholders, update diffs, timeout and stale errors. `pnpm --filter @kayda-sathi/api eval` runs the 40-case deterministic suite and writes `tools/eval/report.md`; it is explicitly not a live-model measurement. `eval:live` requires the Anthropic key and writes a separate live report; fallback samples fail its live gate. `check:runtime` exercises real local HTTP startup and authentication rejection.

Database request metadata contains status/error code/latency but no narrative, prompt or response body. Pending, error, stale and fallback states are tracked. Request logging is disabled and errors expose stable codes rather than provider/database detail. CORS uses `ALLOWED_ORIGINS`, request bodies are bounded at 128 KiB (enough for a 20,000-character draft), and API requests are rate-limited. At most four provider calls are active per API process. Hosted concurrency and token-usage measurement remain unverified.

## Remaining P0 gates

Context retrieval (RAG-1): authenticated `POST /knowledge/retrieve` accepts `{case_id,query?}` and returns the shared ranked retrieval response. Plans now automatically use and persist its source-filtered context. See [CONTEXT_RETRIEVAL.md](CONTEXT_RETRIEVAL.md) for confirmed location fields, directory metadata, seed handling, missing-context questions and UI integration. The current directory has no reviewed local offices; national results explicitly do not claim proximity. No embedding service or additional database migration is required.

Hosted schema deployment and live Prisma connectivity need server database credentials. Live Anthropic structured-output smoke/evaluation needs the provider key. Storage cleanup needs its secret key and hosted race checks. Required teammate review of authorization/contracts/migrations is pending. Frontend auth/integration, phone testing and second-device reopen remain team handoffs. P1 voice/document work remains gated on P0.
