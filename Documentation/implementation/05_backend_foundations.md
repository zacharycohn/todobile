## Purpose
Create the server-side building blocks used by all API routes.

## Inputs / dependencies
- [Documentation/implementation/04_database_migrations_and_rls.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/04_database_migrations_and_rls.md)
- [api_contract.md](/Users/zacharycohn/Documents/ToDobile/Documentation/api_contract.md)

## Requirements from source docs
- Base path `/api/v1`
- Standard success/error envelopes
- JWT auth on all endpoints except health

## Decisions / assumptions
- Centralize response helpers, error mapping, schema validators, and Supabase client factories.
- Verify JWTs against Supabase JWKS in production mode and allow deterministic test overrides in local tests.

## Files to create or modify
- `packages/contracts/*`
- `apps/web/src/lib/server/*`
- health route

## Detailed tasks
- Implement contract types and Zod schemas.
- Add API envelope helpers and typed route utilities.
- Add server config parsing and logging helpers.

## Testing tasks
- unit tests for envelope helpers and validators

## Exit criteria
- New routes can share validation, auth, serialization, and error handling consistently.

## Risks / failure modes
- Misaligned naming between DB columns and API fields can create drift.

## Notes for the next step
Implement authenticated user bootstrap and auth-aware database access.
