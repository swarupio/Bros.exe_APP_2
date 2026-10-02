# Contextual retrieval (RAG-1)

The initial retrieval layer uses BM25 lexical ranking and deterministic topic, role, geography and source-status filters. It runs over the small, curated JSON corpus in the API; there is no embedding provider, vector database or extra database credential. Supabase/Prisma remains the private case store. JSON stays the content source of truth. This is a bounded retrieval-assisted preparation workflow, not unrestricted legal question answering.

## Request and result

Authenticated `POST /api/v1/knowledge/retrieve` accepts `{ "case_id": "<UUID>", "query": "What can help with my deposit problem?" }`. Query is optional and bounded to 1,000 characters. Ownership is checked before any case context is read. Retrieval also works before fact confirmation to offer topic hints and questions; plan/draft generation still requires confirmed facts. No retrieval query is stored or logged.

The shared `retrievalRequestSchema` and `retrievalResponseSchema` define the contract. Results contain ranked topics, ambiguity, matched snippets/resources, source URL/name/status/date, match reasons, explicit coverage, missing-context questions, safety flag, corpus versions and case revision. Scores measure lexical relevance, not correctness or legal eligibility. Seed entries stay visibly unverified and their phone numbers remain suppressed. `ALLOW_SEED_CLAIMS=false` also excludes seed retrieval entries/checklists. Draft entries and review dates older than 365 days or in the future are excluded.

Plans automatically retrieve context from the current snapshot, supply only the bounded matches to the model, reject unknown source IDs and render canonical source text. Provider failure uses retrieved preparation-only practice entries. The full retrieval snapshot is saved in `plan_revisions.content.retrieval` and returned in the plan response, preserving the context of older revisions. Multi-topic matches prompt the user to choose a focus and exclude legal claims until ambiguity is resolved; preparation checklists may span the matched topics.

## Location and nearby assistance

Add and explicitly confirm ordinary fact fields `state`, `district`, `city`, `user_role` and `desired_outcome` through the existing fact-review API. Location values should use the same canonical names as directory coverage. Narrative mentions, party names, proposed facts and GPS/IP guesses never establish jurisdiction. Retired facts are absent from the snapshot. Exact normalized coverage matching requires every location level specified by the entry; it cannot leak a similarly named district in another state. This establishes administrative coverage, not physical distance or service availability.

Directory JSON entries can provide `scope: "state" | "district" | "city"`, `coverage: { "state": "…", "district": "…", "city": "…" }`, optional `roles` and `pack_ids`. A non-national entry must have a state and the field matching its scope. Empty `pack_ids: []` means general help; a nonempty list restricts topics. Unclassified new resources are excluded. Existing topic associations and multilingual matching aliases live in `packages/knowledge/retrieval.json`. Safety-only resources appear only when the case or query indicates danger. Claims may also have `coverage` and `roles`; these are hard filters, not relevance boosts.

The current directory contains only national seed entries. No real nearby office has been added or verified. Results explicitly report this gap; national entries are not labeled nearby. Aditya must review local source URLs, location/topic/role coverage, contact details and verification metadata before local results can be offered as verified. Existing legal JSON and status values are unchanged.

## Limits and extension

English/Hindi/Marathi/Hinglish topic aliases cover the three current packs. Arbitrary paraphrases, spelling errors and transliteration variants are not semantic understanding; unfamiliar problems return general preparation. Broad words such as “service”, “refund” and “deposit” alone do not establish a category. Clarification answers must become confirmed facts before influencing jurisdiction or role filters. General text already confirmed as a fact may influence topic ranking and outcome relevance, but never creates a legal claim.

When the reviewed corpus grows, the same retrieval contract can be backed by Supabase keyword/full-text search and indexed metadata filters. Supabase documents [full-text search](https://supabase.com/docs/guides/database/full-text-search) and [multilingual PGroonga](https://supabase.com/docs/guides/database/extensions/pgroonga). Evaluate multilingual recall before changing the current tokenizer or adding semantic retrieval. Private user narratives must not become a shared search corpus.

Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm validate:knowledge`, and `pnpm check:safety`. Retrieval tests cover multilingual aliases, generic-word negatives, ambiguity, source/status/date gates, safety, confirmed location and role, jurisdiction isolation and authenticated API ownership. Hosted services and frontend integration remain pending; the demo UI does not yet render live retrieval results.
