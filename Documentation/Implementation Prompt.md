You are implementing a complete household task system from the reviewed source documents in the `Documentation/` directory:

1. `Documentation/api_contract.md`
2. `Documentation/database_schema.md`
3. `Documentation/deployment_step_by_step.md`
4. `Documentation/BuildPrepInstallList.md` if it exists

These documents are the working source of truth after the architecture review pass. Read them carefully and derive the implementation from them.

Your job is to transform those source documents into a full implementation plan, then execute that plan step by step until the application is complete.

High-level product shape:
- Android app for capture and push notifications
- Responsive web app for task management
- Single backend API surface deployed on Vercel
- Supabase for auth, database, and RLS
- Strong testing, debugging, and repair loops throughout

Execution defaults:
- Prefer a Vercel-native web/backend architecture
- Prefer a Next.js App Router web application for the web surface unless a stronger documented reason emerges
- Prefer native Android with Kotlin and Gradle for the mobile app
- Prefer TypeScript for web/backend code and shared contracts
- Use the available Build Web Apps and Vercel skills for the web, deployment, and database-planning portions when appropriate
- Use Android-native build workflows for the mobile app, and use emulator-based Android QA tooling when verification work begins

Your execution style must be disciplined, incremental, and context-efficient.

# Core process requirements

## 1. Start by reading the source markdown files
Extract and organize:
- architecture decisions
- system boundaries
- API requirements
- schema and RLS requirements
- deployment requirements
- app responsibilities
- assumptions
- missing implementation details that must be resolved during build

Do not change the reviewed source docs during normal implementation work. Treat them as stabilized requirements inputs unless the user explicitly asks for another architecture-review pass.

## 2. Create a detailed implementation plan before writing production code
You must create a plan directory of small markdown files so the context window stays tight.

Create a structure like this:

- `Documentation/implementation/00_overview.md`
- `Documentation/implementation/01_repo_structure.md`
- `Documentation/implementation/02_environment_and_tooling.md`
- `Documentation/implementation/03_vercel_and_supabase_bootstrap.md`
- `Documentation/implementation/04_database_migrations_and_rls.md`
- `Documentation/implementation/05_backend_foundations.md`
- `Documentation/implementation/06_backend_auth.md`
- `Documentation/implementation/07_backend_task_endpoints.md`
- `Documentation/implementation/08_capture_pipeline.md`
- `Documentation/implementation/09_push_notifications.md`
- `Documentation/implementation/10_web_app_shell.md`
- `Documentation/implementation/11_web_views_today_backlog_upcoming_archived.md`
- `Documentation/implementation/12_web_task_editing.md`
- `Documentation/implementation/13_android_app_shell.md`
- `Documentation/implementation/14_android_widget_and_capture_flows.md`
- `Documentation/implementation/15_android_notifications.md`
- `Documentation/implementation/16_testing_strategy.md`
- `Documentation/implementation/17_integration_and_e2e.md`
- `Documentation/implementation/18_debugging_and_repair_workflow.md`
- `Documentation/implementation/19_deployment_and_secrets.md`
- `Documentation/implementation/20_final_validation.md`

You may refine the names or split further, but keep the files small and focused. Prefer more small files over fewer large ones.

## 3. Each implementation markdown file must follow the same structure
For every implementation step file, include these sections:

- Purpose
- Inputs / dependencies
- Requirements from source docs
- Decisions / assumptions
- Files to create or modify
- Detailed tasks
- Testing tasks
- Exit criteria
- Risks / failure modes
- Notes for the next step

Keep each file compact but specific enough that an engineer or agent could execute it directly.

## 4. Build in strict execution order
After generating the implementation plan files, traverse them one by one in order.

For each step:
1. Read the current implementation markdown file
2. Execute only that step's scope
3. Run the required tests for that step
4. Fix any errors found
5. Update the step file with a short completion note if useful
6. Move to the next step only when exit criteria are satisfied

Do not jump ahead unless required by dependencies.

## 5. Maintain a progress tracker
Create and maintain:
- `Documentation/implementation/STATUS.md`

This file must contain:
- step list
- current status for each step: `not started`, `in progress`, `blocked`, `done`
- blockers
- major decisions made
- outstanding issues
- latest test status

Update it continuously.

# Engineering requirements

## 6. Set up environments and tooling up front
Very early in the plan, define and then implement:
- monorepo or repo structure
- package managers
- runtime versions
- Android tooling
- web tooling
- backend tooling
- Supabase local/dev tooling
- Vercel project linkage and environment management
- linting
- formatting
- type checking
- test runners
- environment variable management
- secrets handling conventions
- migration strategy
- CI-friendly commands

Be explicit. Do not leave environment setup vague.

## 7. Recommend a concrete stack if the source docs do not fully specify it
Choose practical defaults that fit the requirements, and record those decisions in the planning docs.

Prefer a stack that is:
- common
- well-supported
- easy to test
- fast to iterate

If not otherwise constrained, a reasonable default is:
- TypeScript across backend and web
- Next.js App Router on Vercel for the web and API surface
- native Android with Kotlin
- Supabase
- route handlers or a clearly defined Vercel-compatible backend surface

Select the stack deliberately and document why.

## 8. Respect the source docs over convenience
If a shortcut would conflict with the source markdown files, do not take it.
If a requirement is ambiguous, document the assumption in the relevant implementation step file before proceeding.

# Testing requirements

## 9. Create a comprehensive testing plan early
One dedicated markdown file must define the testing strategy in detail.

The testing plan must include:
- unit tests
- integration tests
- API contract tests
- database migration tests
- auth tests
- RLS validation tests
- Android app tests where practical
- web UI tests where practical
- end-to-end tests
- notification flow tests where practical
- failure-path tests
- regression testing guidance

The testing plan must also define:
- required tools/frameworks
- test data strategy
- local test environment setup
- mock/stub strategy for OpenAI and push notifications
- required coverage for critical paths
- pass/fail criteria

## 10. Prioritize automatic testability
Design the implementation so the agent can automatically test and debug as much as possible.

That means:
- clear commands to run tests
- mock external dependencies where needed
- deterministic fixtures
- isolated modules
- seeded test data
- contract tests against the API docs
- schema validation tests against the DB model
- failure simulation for OpenAI and notifications

## 11. Build debugging and repair into the workflow
Create a dedicated markdown file for debugging and repair process.

The workflow must instruct the agent to:
- reproduce failures reliably
- identify failing layer: environment, database, backend, web, Android, integration
- inspect logs and traces
- fix root causes rather than patch symptoms
- rerun the narrowest relevant tests first
- then rerun broader regression tests
- record notable fixes in STATUS.md

When something fails, the agent should not just stop. It should attempt to diagnose, fix, and verify.

# Implementation requirements

## 12. Build foundational layers before feature layers
Order should roughly be:
1. repo structure and tooling
2. environment setup
3. Vercel/Supabase bootstrap
4. database and RLS
5. backend foundations
6. backend task APIs
7. testing harness
8. web app
9. Android app
10. integration
11. final validation

## 13. Keep feature implementation aligned to the API and DB plans
The agent must implement the backend directly against:
- the API contract markdown
- the database schema markdown
- the deployment plan for environment and release decisions

If the code requires clarifying derived logic, derive it from those documents and record the assumption in the relevant step file.

## 14. Preserve strong boundaries
Implement clear separation between:
- Android capture app
- web management app
- backend API surface
- Supabase auth/database
- external integrations like OpenAI and push notifications

Avoid leaking business logic into the wrong layer.

# File and documentation requirements

## 15. Produce useful implementation artifacts
In addition to application code, generate:
- the implementation step markdown files
- STATUS.md
- setup instructions
- local development instructions
- test commands
- seed scripts
- migration scripts
- troubleshooting notes
- final validation checklist

## 16. Keep markdown files small
No implementation markdown file should become a giant dump.
Split large steps into substeps if needed.

Good:
- `07a_backend_task_query_logic.md`
- `07b_backend_task_mutations.md`
- `07c_backend_capture_endpoints.md`

## 17. Keep each step independently executable
A future agent should be able to open one step file and know what to do next without rereading the entire project.

# Execution behavior

## 18. Be explicit before acting
Before executing the plan, first generate all planning markdown files.
Then review them for completeness and dependency order.
Then begin execution.

## 19. Verify continuously
After each step:
- run the step's tests
- fix failures
- update STATUS.md
- confirm exit criteria

## 20. Finish with a final validation pass
At the end, perform a full-system validation against the reviewed source markdown files.

Create:
- `Documentation/implementation/20_final_validation.md`

This final validation must include:
- requirement-by-requirement checklist against `Documentation/api_contract.md`
- requirement-by-requirement checklist against `Documentation/database_schema.md`
- deployment/environment checklist against `Documentation/deployment_step_by_step.md`
- test summary
- unresolved issues
- technical debt intentionally deferred
- clear statement of what is complete and what is not

# Output expectations

Your first actions should be:

1. Read the source markdown files
2. Create the `Documentation/implementation/` directory
3. Generate all planning markdown files
4. Generate `Documentation/implementation/STATUS.md`
5. Review the plan for missing dependencies or gaps
6. Only then begin implementation step 1

As you work, keep all planning and status documents current.

Do not ask for confirmation. Proceed methodically.

The end state is:
- planning markdown files created
- code implemented
- tests implemented
- failures debugged and fixed
- final validation completed
- application in a runnable state
