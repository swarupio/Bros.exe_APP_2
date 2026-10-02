# Repository Guidelines

## Project Structure

This is the Kayda Sathi pnpm workspace. `apps/mobile` is the Next.js App Router web app; it produces `out/` for the web deploy and the later Capacitor Android wrapper. `apps/api` holds the Fastify API and server-only integrations. `packages/shared` owns Zod contracts and pure helpers shared by the app and API. `packages/knowledge` contains legal-knowledge packs, resource and emergency data, validation scripts, and safety checks. `supabase/migrations` is the database and RLS source of truth. `Kayda_Sathi_Final_PRD.md` contains the full product requirements.

## Commands

Use Node 22.11 or newer and the pnpm version declared in the root `package.json`.

- `pnpm install` installs the workspace.
- `pnpm dev:web` runs the Next.js development server.
- `pnpm dev:api` runs the local API.
- `pnpm build` builds each workspace that provides a build script.
- `pnpm typecheck` type-checks workspace packages that provide the script.
- `pnpm test` runs workspace test scripts.
- `pnpm validate:knowledge` checks knowledge/resource JSON and verification metadata.
- `pnpm check:safety` exercises emergency matching, including negation examples.

Keep environment credentials in ignored `.env` files; commit only placeholder `.env.example` values. Never put provider or Supabase service-role secrets in the Next.js client.

## Code and Content Conventions

Use TypeScript for app and API code. Keep shared request/response validation in `packages/shared` rather than duplicating the contract. Keep content data in JSON. A legal claim or resource stays `seed` until a human checks its source; `verified` requires a reviewer, date, and source URL. Never show a `draft` entry.

## Testing and Pull Requests

Add or run the smallest relevant check with each behavior change. Before integrating, run typecheck/build for changed TypeScript workspaces, `pnpm validate:knowledge`, and `pnpm check:safety` when their data or logic changes. Describe the PRD requirements implemented, checks/results, remaining limitations, and any shared-contract or migration changes. API authorization, database migrations, shared contracts, and legal-content changes need another teammate’s review. Keep `main` buildable and report unmet P0 gates explicitly.

## Commits

Use an imperative Conventional Commit with a requirement/task ID, for example `feat(PLN-1): add validated plan contract`. Keep changes focused; do not commit secrets, generated `out/` files, or debug APKs.
