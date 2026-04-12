# Deployment Execution Plan (Step-by-Step)

This document defines the intended deployment model for ToDobile after the architecture review.

This project should deploy its web app and backend API surface on Vercel, use Supabase for auth and database concerns, and keep Android delivery as a separate mobile release workflow.

---

# 0. Goals

- Fully automated preview deploys for pull requests
- Fully automated production deploys from `main`
- Zero manual steps during normal web/backend deployment
- Safe handling of secrets across Vercel, Supabase, and GitHub
- Deterministic, repeatable deployment
- Fast rollback for web/backend releases

---

# 1. System Overview

## Components

- Web app deployed on Vercel
- Backend API surface deployed on Vercel
- Supabase project for auth, Postgres, storage, and RLS
- GitHub repository as the CI source of truth
- Native Android app built separately from the web/backend deploy path

## Deployment Strategy

- GitHub for source control and pull request workflow
- Vercel Git integration for preview and production deployments
- Supabase CLI migrations stored in the repo and applied deliberately
- No VPS, SSH, Docker Compose, or reverse proxy in the primary architecture

---

# 2. Repository Setup

## Step 2.1 Create Repository

- Create GitHub repository
- Set to **private** by default unless there is a deliberate reason to open-source it

## Step 2.2 Branch Rules

- Protect `main`
- Require:
  - PR before merge
  - CI checks passing
  - Vercel preview ready before merge when applicable

---

# 3. Vercel Project Setup

## Step 3.1 Create or Link Project

- Create a Vercel project for the web app / API surface
- Link the GitHub repository to the Vercel project
- Keep Preview and Production environments enabled

## Step 3.2 Environment Variables

Store runtime secrets in Vercel, not in GitHub Actions logs and not in committed files.

Expected environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `OPENAI_API_KEY`
- Android push-related secrets if the backend is responsible for sending them
- Any additional app-specific secrets introduced during implementation

## Step 3.3 Vercel Project Metadata

Keep these values available for automation:

- `VERCEL_PROJECT_ID`
- `VERCEL_ORG_ID`
- `VERCEL_TOKEN` if GitHub Actions needs to call the Vercel CLI directly

---

# 4. Supabase Setup

## Step 4.1 Create Project

- Provision the Supabase project before backend implementation begins
- Enable Auth
- Create the database using repo-managed SQL migrations

## Step 4.2 Migration Strategy

- Store all schema changes in the repository
- Apply migrations through the Supabase CLI
- Treat schema migrations as versioned artifacts reviewed in PRs

## Step 4.3 Environment Separation

- Maintain at least:
  - local development
  - preview / staging-like environment as needed
  - production

---

# 5. Local and CI Tooling Expectations

## Step 5.1 Required CLIs

- Node.js package manager tooling
- Vercel CLI
- Supabase CLI
- Android Studio / Gradle for the mobile app

## Step 5.2 Local Env Files

- `.env.local` for local web/backend development
- local Android configuration kept outside version control
- never commit populated secret files

---

# 6. CI Workflow (Pull Requests)

## File: `.github/workflows/ci.yml`

Steps should include:

1. checkout
2. install dependencies
3. lint
4. typecheck
5. run unit and integration tests
6. validate database migration state
7. build the web app / backend deploy target

CI must fail on any error.

---

# 7. Preview Deployments

## Preferred path

- Use Vercel Git integration so every pull request gets a preview deployment automatically

## Expectations

- Preview URL attached to the PR
- Web app loads successfully
- API health endpoint responds successfully in preview
- Environment variables for preview are configured in Vercel

---

# 8. Production Deployments

## Trigger

- Merge to `main`

## Preferred deployment path

- Vercel automatically builds and deploys Production from `main`

## Optional GitHub-driven deployment path

If explicit CLI-driven deployment is needed later, use:

1. `vercel pull`
2. `vercel build`
3. `vercel deploy --prebuilt --prod`

This should only be introduced if the native Git integration path is insufficient.

---

# 9. Database Migration Rules

- Stored in repo
- Reviewed in PRs
- Applied with Supabase tooling
- Must be backward compatible when possible
- Must include RLS and index changes when required by feature work

---

# 10. Secrets Handling

## Rules

- Never commit secrets
- Never print secrets in CI logs
- Vercel stores application runtime secrets
- Supabase stores project-level database and auth configuration
- GitHub stores only automation secrets that are actually required for workflows

---

# 11. Logging and Monitoring

- Use structured application logs to stdout/stderr
- Inspect runtime behavior with Vercel deployment and runtime logs
- Use Supabase logs for database and auth debugging
- Add health checks and error tracking during implementation

---

# 12. Failure Handling

If a deployment fails:

1. block promotion of the broken release
2. inspect Vercel build or runtime logs
3. inspect Supabase migration and database logs if relevant
4. fix the root cause
5. redeploy and re-verify

---

# 13. Rollback

## Web/backend rollback

- Use Vercel rollback / redeploy of the last known good deployment

## Database rollback

- Prefer forward-fix migrations
- Use destructive rollback only with explicit review and backups

---

# 14. Android Delivery Boundary

- Android builds are not deployed through Vercel
- The Android app should consume the same hosted API base URL as the web app
- Mobile distribution should use the Android-native release pipeline selected during implementation

---

# 15. Security

- Supabase JWTs verified by the backend API surface
- RLS enforced in Supabase
- Principle of least privilege for service credentials
- No open SSH surface required for normal deployment

---

# 16. Validation Checklist

Before production:

- [ ] CI passes
- [ ] Preview deploy works for PRs
- [ ] Production deploy works from `main`
- [ ] Health check passes
- [ ] Required env vars exist in Vercel and Supabase
- [ ] Secrets are not exposed
- [ ] Logs are readable
- [ ] Rollback path is documented and tested

---

# 17. Future Enhancements

- dedicated preview database strategy
- automated smoke tests against preview URLs
- better observability and alerting
- staged mobile release automation

---

# End State

A merge to `main` triggers:

1. CI validation
2. production deployment on Vercel
3. health verification

The web app and backend API surface go live without any VPS-specific manual steps.
