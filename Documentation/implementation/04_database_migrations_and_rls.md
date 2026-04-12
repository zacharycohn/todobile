## Purpose
Create the Supabase database foundation exactly matching the reviewed schema and policies.

## Inputs / dependencies
- [database_schema.md](/Users/zacharycohn/Documents/ToDobile/Documentation/database_schema.md)
- [Documentation/implementation/03_vercel_and_supabase_bootstrap.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/03_vercel_and_supabase_bootstrap.md)

## Requirements from source docs
- Create extensions, enums, helper functions, tables, indexes, triggers, and RLS policies.
- Preserve task status/timestamp consistency.
- Support device token registration and task search/filtering efficiently.

## Decisions / assumptions
- Use a single initial migration plus seed SQL for a starter family and profiles.
- Add SQL tests or script-based checks for RLS expectations where local auth simulation is possible.

## Files to create or modify
- `supabase/migrations/*.sql`
- `supabase/seed.sql`
- DB verification tests/scripts

## Detailed tasks
- Translate schema doc into migration SQL.
- Add seed data for local development.
- Add validation scripts that assert required tables, policies, and constraints exist.

## Testing tasks
- `pnpm db:lint`
- `pnpm db:test`

## Exit criteria
- Migration SQL faithfully reflects the reviewed schema and passes static validation.

## Risks / failure modes
- Full local migration execution depends on Docker/Supabase local services.

## Notes for the next step
Build shared contracts and backend utilities around auth, validation, and envelopes.
