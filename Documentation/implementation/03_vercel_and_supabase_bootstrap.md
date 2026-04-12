## Purpose
Define project linkage, environment key expectations, and local bootstrap commands for Vercel and Supabase.

## Inputs / dependencies
- [Documentation/implementation/02_environment_and_tooling.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/02_environment_and_tooling.md)
- [deployment_step_by_step.md](/Users/zacharycohn/Documents/ToDobile/Documentation/deployment_step_by_step.md)

## Requirements from source docs
- Vercel hosts the web app and backend API surface.
- Supabase owns auth, database, and RLS.
- Runtime secrets must stay in Vercel, not in source control.

## Decisions / assumptions
- Use `supabase/config.toml` and repo-managed SQL migrations.
- Provide local scripts for `supabase start`, `supabase db reset`, and optional seed loading.
- Keep `.vercel/project.json` out of source control.

## Files to create or modify
- `supabase/config.toml`
- `apps/web/.env.example` or root `.env.example`
- bootstrap documentation in `Documentation/README.md`

## Detailed tasks
- Define required env keys from deployment docs.
- Add helper scripts and documentation for Vercel linking and env pulling.
- Prepare app code to tolerate missing remote credentials in local test mode.

## Testing tasks
- `supabase --version`
- validate env templates include required key names

## Exit criteria
- The repo clearly indicates how to link Vercel, authenticate CLIs, and prepare local env files.

## Risks / failure modes
- Actual project linking cannot complete without authenticated remote accounts.

## Notes for the next step
Implement SQL migrations, triggers, indexes, seed data, and RLS verification.
