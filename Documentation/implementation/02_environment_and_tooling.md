## Purpose
Establish runtime versions, local env conventions, developer tooling, and CI-friendly scripts early.

## Inputs / dependencies
- [Documentation/implementation/01_repo_structure.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/01_repo_structure.md)
- [BuildPrepInstallList.md](/Users/zacharycohn/Documents/ToDobile/Documentation/BuildPrepInstallList.md)

## Requirements from source docs
- Use Node.js LTS and a chosen package manager, preferably `pnpm`.
- Define local env files, secrets handling, and required CLIs.
- Android Studio / Gradle support must be documented.

## Decisions / assumptions
- Target Node `22.x`, `pnpm@10`, TypeScript `5.x`, Vitest, Playwright, ESLint, Prettier.
- Commit `.env.example` only; real secrets live in Vercel or local untracked files.
- Use Turborepo to orchestrate lint, typecheck, build, and tests.

## Files to create or modify
- `.gitignore`
- `.npmrc`
- `.nvmrc`
- `.env.example`
- `tsconfig.base.json`
- ESLint/Prettier config files
- `Documentation/README.md`

## Detailed tasks
- Add root scripts for `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `db:*`.
- Document required CLIs and setup order in the README.
- Add workspace-wide ignore rules for secrets, Android artifacts, and Node outputs.

## Testing tasks
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`

## Exit criteria
- A new contributor can understand required versions, setup order, and commands from repo files.

## Risks / failure modes
- Local machine may be missing Android CLI tools even if Android Studio exists.

## Notes for the next step
Create the Vercel/Supabase bootstrap files and environment placeholders.
