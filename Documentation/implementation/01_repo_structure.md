## Purpose
Define a repo layout that supports a shared API contract, web frontend, and Android client with minimal duplication.

## Inputs / dependencies
- [Documentation/implementation/00_overview.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/00_overview.md)

## Requirements from source docs
- Shared API base path `/api/v1`.
- Android and web clients must call the same hosted backend.
- CI must support lint, typecheck, tests, migration validation, and production build.

## Decisions / assumptions
- Repo layout:
  - `apps/web`
  - `apps/android`
  - `packages/contracts`
  - `packages/config`
  - `packages/test-utils`
  - `supabase`
- Shared TypeScript contracts mirror the API contract and reduce drift.

## Files to create or modify
- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- workspace folders and package manifests

## Detailed tasks
- Initialize workspace metadata and root scripts.
- Add shared TypeScript base config and lint/test configs.
- Add package boundaries for contracts and test helpers.

## Testing tasks
- `pnpm -r lint`
- `pnpm -r typecheck`
- `pnpm -r test`

## Exit criteria
- Monorepo structure exists and workspace commands resolve package graph correctly.

## Risks / failure modes
- Dependency installation may require network approval.

## Notes for the next step
Add environment management, code quality tooling, and local development conventions.
