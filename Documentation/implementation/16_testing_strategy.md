## Purpose
Define the complete test matrix and concrete tooling for the system.

## Inputs / dependencies
- All previous plan files

## Requirements from source docs
- Cover unit, integration, API contract, migration, auth, RLS, web UI, Android where practical, e2e, notification, failure, and regression tests.

## Decisions / assumptions
- Use Vitest for unit/integration, Playwright for web e2e, SQL/static checks for migrations, and JUnit/Compose testing scaffolds for Android.
- Mock OpenAI and push notifications in automated tests.

## Files to create or modify
- `packages/test-utils/*`
- test config files
- e2e fixtures and docs

## Detailed tasks
- Document test layers and ownership.
- Add fixtures, factories, and deterministic mock services.
- Define pass/fail gates for CI.

## Testing tasks
- verify each listed test command exists and is runnable or explicitly marked blocked
- add tests before implementation changes whenever a new feature is planned
- run the full test suite after implementation work and keep fixing code until the suite is green

## Exit criteria
- Repo contains a clear, executable testing strategy and supporting tooling.

## Risks / failure modes
- Full Android instrumentation and local Supabase execution may be blocked in this environment.

## Notes for the next step
Add integration and end-to-end coverage for critical flows.
