# Kayda Sathi — Team Workboard & Build Plan

Primary coordination sheet for **Aditya, Swarup, and Gururaj**. The PRD is the product requirements source; this workboard turns it into the team's implementation and integration plan. Keep this file updated in each coordination commit and when work is claimed, blocked, handed off, or merged.

## Delivery Goal & Decisions

Deliver the five-hour P0: **sign in → describe → confirm facts → get an evidence-based plan → create/edit a draft → report an update → get a new plan revision → reopen the case on a second device**. Finish the web app first; Aditya bundles its static assets with Capacitor last.

The team has confirmed these PRD overrides: frontend is **Next.js + Capacitor** instead of Vite; Apple/SwiftUI is a **visual direction**, not an iOS target; Aditya owns integration/content/safety/native packaging, Swarup owns backend/shared contracts/AI/database, and Gururaj owns frontend. Anthropic is the AI provider. Keep the P1 work behind the P0 gate.

The AI assists with issue classification, proposed fact extraction, adaptive questions, preparation plans, drafts, and update interpretation. It does not train a model, invent legal rules, decide the truth of a user's facts, make legal outcome predictions, or replace source validation. Unknown legal topics use general preparation and referral guidance. **Current user-approved override:** Fast Track chat and voice transcription use Groq, with `GROQ_API_KEY` held only by the API server. This does not yet replace the planned provider for future plan/draft workflows.

The complete source PRD, including requirements, architecture, schemas, endpoint payloads, acceptance criteria, and test cases, is [`Kayda_Sathi_Final_PRD.md`](Kayda_Sathi_Final_PRD.md). This plan records the agreed adaptations and executable division of work; PRD details remain applicable unless an override is listed above or the implementation contract below is more specific.

## Team Ownership & Current Work

One primary owner per task; statuses reflect actual work. Ownership areas are soft reservations. Only the active-lock table represents a currently claimed file lock.

| Owner | Owns | Current tasks | Next handoff |
|---|---|---|---|
| **Aditya** | Workspace, integration, knowledge resources/validator, safety, QA/CI, deployment, Capacitor/Android | A-001 workspace and A-002/A-003 knowledge/safety foundation: review | Complete human source review; connect the frontend to the API; then prepare the phone build |
| **Swarup** | Fastify API, Supabase/RLS/migrations, Zod/shared contracts, Anthropic workflows and output validation | S-001–S-005 backend implementation available; S-006 environment checks added | Configure server-only database/provider/storage credentials, apply reviewed migration to Supabase, then complete live-model and frontend handoffs |
| **Gururaj** | Next.js mobile-first web app, visual system, end-user screens and responsive/accessibility behavior | G-001 static Next.js shell: review | Integrate live API after S-001 and S-002 |

## Task Plan & Dependencies

Target times are hours after the hackathon build timer starts; they are checkpoints, not evidence a task is complete. `T+0:30` freezes the interface contracts. Frontend can integrate fixtures before backend endpoints are live. No task bypasses a dependency simply because its target time has arrived.

| ID | Owner | Priority | Deliverable & acceptance check | Depends on / handoff | Status |
|---|---|---|---|---|---|
| A-001 | Aditya | P0 | Root pnpm workspace, scripts, contributor commands and ignore rules; web/API dependencies still need workspace install when registry access returns. | Independent; root configuration is ready for review. | **review** |
| S-001 | Swarup | P0 | Shared request/response contracts now include readiness issues and workflow metadata; nine validated synthetic conflict/general/sourced/fallback/draft/update/timeout/stale fixtures are exported. Stable input/404/oversize/auth errors and typechecks pass. | Required shared-contract/auth review and frontend consumption pending; handoff in `docs/BACKEND_HANDOFF.md`. | **review** |
| G-001 | Gururaj | P0 | Responsive Apple-inspired Next.js shell with intake/review/case surfaces; `/case/review` and `/review`; 48px targets and readable supporting text. Production static export and `npm run typecheck` passed. Browser-only sample data is identified as a local demo, with no account/sync claim or unreviewed tap-to-call numbers. | Integrate S-001 after contract freeze; case IDs and demo records are not connected to persistence yet. | **review** |
| A-002 | Aditya | P0 | Three preparation-only seed packs (rent deposit, consumer, cyber fraud), emergency/resource JSON, content validator and official-source check log. `verified` is reserved for claims a human reviewed; source-checked seed remains unverified. | Schema/IDs await S-001 handoff; human review of contact numbers remains open. | **active** |
| S-002 | Swarup | P0 | Two Supabase migrations, ten Prisma mappings and checksum migration runner. Revision-checked fact writes, retained fact versions, coherent workspace reads, upload parent lock and retryable storage cleanup followed by child-row purge are tested locally. | Hosted Supabase/Storage concurrency, Prisma connectivity and teammate security review pending. | **review** |
| G-002 | Gururaj | P0 | Login/logout, My Cases, create case, editable text description, loading/error/empty/offline states. | G-001; live persistence after S-002. | ready |
| A-003 | Aditya | P0 | Emergency phrase match + negation guard, positive/negative self-check, pre-login Safety sheet; phone numbers stay hidden until human source verification. | Matcher and 12-positive/8-negative self-check are ready; G-001 owns the sheet, which reports source review pending. | **active** |
| S-003 | Swarup | P0 | Structured intake with proposed provenance/role, max-three questions, ambiguous-date rejection, manual fallback and explicit confirmation. Differing proposals block generation; shared code derives amounts/hashes. In-flight and pre-inference duplicate tests pass. | Code ready for review; live Anthropic/Supabase validation pending credentials. | **review** |
| S-004 | Swarup | P0 | Allowlisted claim/resource selections, canonical pack text and retained verification snapshots, safe-contact gate even without intake, resolved-case guidance and useful general checklists. Schema/lint, immutable revision, duplicate and stale checks pass. | Code ready for review; live model/source review and frontend source rendering pending. English preparation prose remains a documented limit. | **review** |
| G-003 | Gururaj | P0 | Fact review with provenance, edit/confirm/unknown, material conflict resolution, max-three adaptive questions, strict confirmed-fact gate. | G-002; consume S-001 fixtures while waiting for S-003. | ready |
| G-004 | Gururaj | P0 | Case workspace and sourced next step, checklist with “I don't have this” alternatives, visible verified/unverified sources. | G-003; S-004 for live plan. | ready |
| S-005 | Swarup | P0 | Model-assisted composition from confirmed IDs using trusted English templates, purpose/tone/role/outcome wording and unknown placeholders. Readiness covers empty text, stale facts, missing fields/attachments, mismatched amounts and unsafe wording. New update threats, sent freeze, history/version preservation, request reservation and metadata-only latency/error/stale tracking are tested. | Code ready for review; live provider and G-005 integration pending. Free-form model tone review and translation remain P1. | **review** |
| G-005 | Gururaj | P0 | Draft editor, autosave/recoverable save error, readiness checks, stale banner, copy/share; text update and explicit fact-diff confirmation. | G-004; S-005 for live behavior. | ready |
| A-004 | Aditya | P0 | Run integrated cross-feature and security regression checks; document pass/fail evidence; safe demo data + rehearsal guide. | A-002/A-003; continuous fixture checks against S-001 and G-001. | ready |
| A-005 | Aditya | P0 | P0 gate on real phone: full live journey, explicit confirmed facts, reviewable plan/draft, update-generated revision, second-device reopen. | A-003/G-005/S-005 live integrations. Target 3:15. | ready |
| A-006 | Aditya | P0 | Set `webDir` to Next.js `out`; Capacitor Android sync, install and smoke test on a real device; hand off installed debug APK. | P0 gate and frozen web shell. Build target 4:20. | ready |
| S-006 | Swarup | P0 | Real HTTP smoke, provider schema compatibility, one retry inside deadline budget, four-call concurrency cap, 128 KiB body guard and 40-case deterministic evaluation runner/report. Workspace build/typechecks/tests plus knowledge/safety pass locally. Node engine corrected for Prisma 7. | DATABASE_URL, ANTHROPIC_API_KEY and storage secret missing; live evaluation/hosted isolation/phone release gate pending. `eval:live` is ready to run once configured. | **active** |

| G-006 | Gururaj | P0 | WebView/device responsive and keyboard/accessibility pass; critical frontend fixes and live deployed-web fallback. | G-005 and A-006 feedback. | ready |
| A-007 | Aditya | P0 | Two-phone rehearsal, release/known-limits note, demo recording fallback, final workboard status. | A-005/A-006/S-006/G-006; before hour 5. | ready |

## Gated Backlog

At `T+3:15`, stop optional work if P0 has not passed. Feature freeze is `T+3:45`. Only the integrated voice slice may be attempted during the optional window:

| ID | Owner | Work | Dependency / decision |
|---|---|---|---|
| P1-001 | Swarup / integration | Groq Whisper STT endpoint with file/timeout validation and no audio persistence. | Fast Track endpoint exists; provider key and runtime/API self-check still required. |
| P1-002 | Aditya | Browser recorder, clear provider disclosure, size/duration limits, editable transcript confirmation. | Recorder and transcript insertion exist; duration cap and native Android microphone verification remain. |
| P1-003 | Gururaj / integration | Wire confirmed speech transcript into Fast Track and Normal Mode text intake. | Both screens are wired; full device verification remains. |

Other P1 backlog: document analysis/upload and provenance; Hindi/Marathi UI; PDF export; account data deletion; cross-device edit-conflict dialogue; event timeline; feedback. Assign each task to its owner above before anyone starts it. P2/post-hackathon: TTS, reminders, shared-phone protections, password reset, family access, state-specific packs, advanced offline case storage. Do not represent deferred features as implemented.

## Architecture & Frozen Interfaces

### Workspace and runtime

Use pnpm workspaces: `apps/mobile` (Next.js App Router; browser/web first), `apps/api` (independent Node 22 + Fastify service), `packages/shared` (Zod contracts and pure helpers), `packages/knowledge` (JSON packs/resources/emergency terms and validator), and planned `supabase/migrations`. API secrets never enter the browser bundle. Supabase browser CRUD uses RLS; Fastify authenticates bearer JWTs and owns privileged AI writes and case/account deletion.

Next.js uses `output: 'export'` from its first build. Authenticated screens and runtime case data fetch after page load; do not depend on Next.js route handlers, server actions, middleware, cookies, or a Next.js runtime server. Use fixed pages with query parameters for runtime IDs: `/login`, `/cases`, `/cases/new`, `/case?caseId=…`, `/case/review?caseId=…`, `/case/draft?caseId=…&draftId=…`, `/settings`. Put components that consume `useSearchParams` behind Suspense. Current local demo routes are `/`, `/cases/new`, `/review`, `/case`, and `/case/review`. A production export must succeed before Capacitor wrapping. Capacitor `webDir` is `out`; retain browser operation as the deployed demo fallback.

### Contracts and trust rules

Freeze Zod contracts by `T+0:30` for Fact, PlanContent, Draft, intake/update result, Resources, and stable API errors. Every AI request uses an idempotency UUID. Include fixtures for intake, a conflicting amount, unsupported/general mode, validated plan, invalid-plan fallback, draft placeholders, update fact diff, timeout and stale case.

P0 endpoints follow the PRD under `/api/v1`: unauthenticated health/resources; authenticated intake, plan, draft, update and delete. Validate each input and AI output. The server reloads case/facts from Supabase; never trusts client-supplied legal context. Only confirmed facts feed plans and drafts. The model may propose, the user confirms; derived amounts and hashes are computed in code. Show only existing non-draft pack claim IDs and known directory resource IDs. Render P0 legal assertion text from the source pack; arbitrary model prose does not become safe because it cites an ID. Retry validation once, then return preparation-only fallback with uncertainty. No user narrative, prompt, or response body in logs.

Every write after inference must compare the case revision and deleted state **atomically with the write**. A late result after case changes/deletion must not insert facts, plans, or drafts. Requests are idempotent. Plans are immutable revisions. Draft `version` tracks regeneration; a separate concurrency token prevents one device silently overwriting another. Failed saves preserve unsaved text. Case deletion marks hidden/deleted first; storage cleanup failure is surfaced and retryable.

AI/ML is Anthropic-backed structured inference only: issue classification, extraction of *proposed* facts, relevant follow-up questions, sourced/preparation plan, factual draft, update interpretation. Verify that the selected account model supports schema output during provider smoke test. No custom training, vector DB, model-as-legal-authority, predicted case outcomes, or autonomous filing in P0.

### Apple-inspired visual direction

Gururaj builds a polished, calm case-assistance UI inspired by Apple’s hierarchy and restrained use of motion, adapted to Android and mobile web. It is not a SwiftUI/iOS application. [`DESIGN.md`](DESIGN.md) is the UI source of truth; individual screen references are saved in `docs/design/screens/`. Avoid speculative motion dependencies.

| Design area | Decision |
|---|---|
| Page | Soft neutral `#F5F5F7` background; high-contrast readable content on clean white surfaces. No large gradients or decorative hero art. |
| Type | Platform/system sans stack, no downloaded Apple font; clear title/section/body/caption hierarchy; Noto Sans Devanagari fallback when localized. |
| Color | Near-black body text, quiet gray secondary labels, a restrained blue primary accent; use text/icon as well as color for every status. Unverified is never styled as verified. |
| Layout | One prominent next step near the top; consistent 4/8px spacing; approximately 20px phone gutters; readable max-width on wider screens. Vertical, thumb-friendly forms. |
| Components | Grouped white sections, restrained divider treatment, moderate 12–16px radii, subtle or no shadows; consistent labelled controls, clear focus and pressed state. |
| Motion | Short and purposeful fades/transforms only; honor reduced motion. No animation is the sole status cue. |
| Accessibility | 48px min control targets, strong WCAG AA body-text contrast, keyboard-visible focus, useful screen-reader labels, 200% zoom without clipping. |

References: [Apple layout and hierarchy](https://developer.apple.com/design/human-interface-guidelines/layout), [typography](https://developer.apple.com/design/human-interface-guidelines/typography), [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports), [Capacitor config](https://capacitorjs.com/docs/config).

## Locks & Integration Handoffs

Locks coordinate people; Git does not enforce them. A **reservation** gives the default area owner first review. A lock becomes active only when a row below names the exact scope, owner, claim time and release condition. Do not lock the entire workboard.

| Active scope | Task / owner | Since (IST) | Waiting for | Release condition |
|---|---|---|---|---|
| No active file locks | — | — | — | Initial foundation reviewed; re-claim exact paths here before parallel edits |

| Handoff | Producer | Consumer | Needed by | Waiting / state |
|---|---|---|---|---|
| Zod schemas, endpoint errors and JSON fixtures | Swarup / S-001 | Gururaj / G-001 | T+0:30 | Initial code available; pending explicit contract freeze and frontend integration |
| Pack/resource JSON schema and IDs | Swarup / S-001 | Aditya / A-002; Gururaj / G-004 | T+0:30 | Initial seed IDs available; pending schema handoff and human source review |
| Query paths, auth state and UI fixture behaviors | Gururaj / G-001 | Swarup / S-001; Aditya integration | T+0:30 | Static demo routes shared; authenticated/live behavior pending |
| Verified user-facing help content | Aditya / A-002 | Gururaj / A-003; Swarup / S-004 | Before plan/safety integration | Human verification pending |

## Merge Queue & Operating Rules

Target integration order: root workspace / S-001 contracts / G-001 static export (independent early work) → schema freeze and knowledge types → migrations + RLS → auth / cases / intake / Safety → fact review → plan + source display → draft + update → integration and P0 gate → optional voice → freeze → Capacitor build → release.

- Read latest `main` before claiming; branches are `feat/a-001-workspace`, `feat/s-001-contracts`, `feat/g-001-web-shell`, `feat/a-002-knowledge`, etc. Keep each commit/PR focused and use requirement IDs in imperative Conventional Commit subjects (`feat(PLN-1): add plan response schema`).
- Shared package changes require Swarup’s review; Knowledge changes require Aditya’s review; API authorization, revision guard, migration, and validator changes require a second person. Frontend changes require a browser smoke check by Gururaj or a teammate.
- Resolve conflicts with the reserved owner. Rebase each short-lived branch against `main` before integration. Keep `main` buildable. No production deploy, secret, or demo user narrative in Git.
- Record the exact missing artifact, responsible person, and next action for every blocker. A dependent feature may use agreed mock fixtures; record separately when its real-data integration is still blocked.
- At every milestone, update statuses, accepted evidence, branch/commit link, active locks and release conditions. Drop stale locks through explicit handoff, never assumption.

## Build, Test & Acceptance Gates

Use actual root scripts listed in `package.json`; do not copy unimplemented PRD commands as though they exist. At integration checkpoints build/lint/typecheck changed work and run its smallest meaningful tests. `MOCK_AI` exercises the same auth/schema/ownership pipeline and is clearly identified to the demo audience.

**T+0:30 foundation:** workspace installs; shared contract and fixtures validate; production Next export succeeds; health returns JSON. **T+1:45:** real text-intake → human fact confirmation → real plan works on one phone. **T+2:30:** case and revision reopen on a second device. **T+3:15 P0 gate:** new-case-to-update demo works with live services on a real phone; until it passes do not start P1. **T+3:45 freeze:** unfinished P1 hidden. **T+5:00 release:** install APK on two devices, rehearse twice, web fallback reachable.

Required product/safety checks: no plan/draft without confirmed facts; conflicting consequential facts require user choice or unknown; general mode contains no invented legal claim; seed claims show unverified status; draft placeholders/readiness/staleness work; updating facts never overwrites an earlier plan or user-edited draft; deletion/in-flight inference cannot recreate data; two test users cannot read each other's rows or files; positive emergency checks and negation examples run; typed intake remains usable after mic denial; no narrative appears in logs or bundled secret. PRD eval targets apply when the eval runner and real provider are available; report measured numbers and identify any unmet target.

## Current Check-In

RAG-1 contextual retrieval: vectorless BM25 and deterministic topic/role/location/source filters now narrow the curated corpus using the case narrative, question and confirmed facts. An authenticated ownership-checked retrieval endpoint returns canonical snippets, explanations, source status, missing-context questions and explicitly labeled national/local coverage. Plans use allowlisted retrieved IDs and persist retrieval snapshots. No local office data or legal verification status was invented; current national-only directory and frontend/live-service limitations are documented in `docs/CONTEXT_RETRIEVAL.md`. Shared-contract/API and multilingual alias/directory metadata changes need teammate/Aditya review. No migration or embedding credentials required.

Swaroop remaining-task audit: implemented missing P0 draft/readiness/evaluation work and fixed pre-inference duplicates, unresolved proposed conflicts, update safety, mutable old fact references, cleanup that left DB rows behind, malformed JSON/oversize/unknown-route errors, overly broad topic substring matches and Hindi vowel-mark loss in the emergency matcher. Migration 002 and API review are ready for a teammate; Aditya also needs to review the emergency normalizer fix (no legal JSON/status changes). Forty offline fixtures pass; this does not claim live-model accuracy. Emergency checks now cover 12 positive and 11 negative/negation examples. English output and conservative deterministic lints are documented. Hosted credentials/review/real-phone gates remain open; P1-001 Sarvam STT is still gated and has not been started.

Supabase + Prisma continuation: supplied public config saved only in ignored env files. Workspace install, Prisma generation/validation, workspace typechecks, SQL/RLS tests, authenticated fallback journey, structured-output stub tests, in-flight revision race, source-status preservation, draft staleness/versioning, knowledge/emergency checks and production static build pass locally. The API uses Prisma transactions against Supabase Postgres; migrations can run with the Node runner or Supabase SQL Editor, without psql. `check:env` currently reports missing server-only DATABASE_URL, ANTHROPIC_API_KEY and SUPABASE_SECRET_KEY. No hosted schema or user accounts were changed. Current demo screens remain local-only until Gururaj integrates the auth/API helpers. Required teammate review and live phone/second-device/provider gates remain open; P1 remains gated.

Earlier foundation check-in (superseded by the continuation above): S-002 SQL was authored before local database validation and workspace dependencies were available. No P0 completion claim was made.

Earlier foundation/design check-in (superseded by the checks above): The Git remote's starting `main` had only the original workboard. This foundation adds workspace manifests, a statically exported Next.js local demo, an initial Fastify health/API contract slice, knowledge packs, data checks, [`DESIGN.md`](DESIGN.md), and ten separate portrait screen references. Frontend typecheck/static build and knowledge/emergency self-checks pass. Registry access failed in this environment, so the API self-check, API typecheck, and full pnpm workspace build have not run. Auth-backed persistence, live AI, and P0 integration remain incomplete; passing the shell build is not the P0 gate. Keep the local PRD and contributor guide with the implementation push so teammates have its source requirements and build commands.

