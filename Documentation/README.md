# ToDobile

ToDobile is a household task system with three surfaces:

- A Vercel-hosted Next.js web app and API under `/api/v1`
- A Supabase-backed auth/database layer with versioned SQL migrations and RLS
- A native Android client for fast capture and notifications

## Workspace layout

- `apps/web`: Next.js App Router web app and API routes
- `apps/android`: native Kotlin Android scaffold
- `packages/contracts`: shared API contracts and validation schemas
- `packages/test-utils`: shared test helpers
- `supabase`: Supabase config, migrations, and seed SQL
- `Documentation`: markdown docs, planning material, and project notes
- `Documentation/implementation`: execution plan and live status tracker

## Tooling

- Node.js `22.x`
- `pnpm@10`
- Vercel CLI
- Supabase CLI
- Android Studio for Android builds and emulator QA

## Getting started

1. Copy `.env.example` to `.env.local`.
2. Fill in the required Vercel/Supabase/OpenAI keys.
3. Install dependencies with `pnpm install`.
4. Run `pnpm db:lint`.
5. Run `pnpm dev`.

## Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm db:lint`
- `pnpm db:test`

## Vercel and Supabase bootstrap

1. Authenticate `vercel` and `supabase`.
2. Link the repo to the target Vercel project with `vercel link`.
3. Pull env vars with `vercel env pull .env.local --yes`.
4. Apply Supabase migrations through the CLI in the target environment.
5. Keep `.vercel/project.json` and all populated env files out of version control.

## Debugging and repair workflow

When something fails:

1. Reproduce the failure with the smallest matching command.
2. Identify the layer first: environment, database, backend, web, Android, or integration.
3. Inspect the closest logs or test output.
4. Fix the root cause, not the symptom.
5. Re-run the narrowest relevant test first.
6. Re-run broader regression checks before calling the issue done.
7. Record notable blockers or repair decisions in `Documentation/implementation/STATUS.md`.

## Development workflow

When adding a new feature:

1. Update or add tests for the planned behavior before writing the implementation.
2. Build the feature to satisfy those tests.
3. Run the full test suite after the implementation is complete.
4. If any test fails, keep iterating on the code until the full suite passes.

## Deployment

- Pull requests should run CI and receive Vercel preview deployments.
- Production web/backend deploys should come from merges to `main`.
- Database changes should ship as reviewed forward migrations.
- Roll back web/backend by promoting the last known good Vercel deployment; prefer forward fixes for the database.
