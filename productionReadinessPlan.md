# Production Readiness Plan

This plan covers the remaining production-readiness items we can implement directly in this repo, excluding:

- Verify OpenAI transcription cost, latency, and failure handling are acceptable for real user traffic.
- Finish production push/device registration and mobile release prep.

## Goal

Harden the Android voice capture flow and its backend integration so the system is safer and closer to production use, while keeping local debug development practical.

## Step 1: Separate debug and release network configuration

Status: completed

### Tasks

- Split Android API base URL config into debug and release values.
- Keep cleartext HTTP allowed only in debug.
- Add Android config validation that blocks insecure or missing release config.

### Completion criteria

- Debug builds can still talk to the local dev server.
- Release builds require a valid HTTPS API base URL.

### Validation

- Debug Android compile passes.
- Release Android compile passes.

## Step 2: Harden Android app config loading

Status: completed

### Tasks

- Expand `AppConfig` to model environment-specific rules.
- Surface clearer missing or invalid config errors to the user.
- Document local Android config keys for debug and release in the project.

### Completion criteria

- The app fails clearly when config is bad.
- Local setup is explicit and repeatable.

### Validation

- Compile passes.
- Missing/invalid config states are represented in code.

## Step 3: Improve Android auth and upload UX

Status: completed

### Tasks

- Tighten sign-in validation and error messaging.
- Make session-expiry and unauthenticated upload failures clearer.
- Add a retry path after upload failure.
- Show a more explicit success state after task creation.

### Completion criteria

- Auth and upload failures do not strand the user.
- Success and failure states are visible and actionable.

### Validation

- Android compile passes.
- Manual emulator testing path is clear.

## Step 4: Improve recorder robustness

Status: completed for the current single-screen recorder flow

### Tasks

- Prevent invalid interactions while recording or uploading.
- Guard against very short or invalid recordings.
- Improve cleanup around recorder/player lifecycle transitions.
- Keep single-file overwrite behavior intact.

### Completion criteria

- The recorder behaves predictably through record, stop, replay, and retry flows.

### Validation

- Android compile passes.

## Step 5: Add backend safeguards for production voice uploads

Status: completed

### Tasks

- Validate allowed voice MIME types.
- Reject oversized audio payloads.
- Improve route-level error details for invalid uploads.
- Add structured server logging around voice capture failures without exposing secrets.

### Completion criteria

- The backend rejects obviously bad uploads early.
- Failures are easier to diagnose in production logs.

### Validation

- Targeted server tests pass.

## Step 6: Add targeted automated tests for the hardened flow

Status: completed

### Tasks

- Extend route/service tests for new voice-upload validation.
- Keep Android compile validation in place.

### Completion criteria

- Regression coverage exists for the new backend safeguards.

### Validation

- Targeted Vitest suite passes.
- Android debug and release compile checks pass.

## Step 7: Summarize remaining production tasks outside this repo-level implementation

Status: completed

### Tasks

- Document the remaining non-code or infrastructure-heavy items still needed before full production use.

### Completion criteria

- We end with a clear punch list rather than pretending the system is fully production-ready.

## Validation Summary

- `./gradlew :app:compileDebugKotlin :app:compileReleaseKotlin`: passing
- `pnpm vitest run apps/web/src/app/api/v1/routes.test.ts apps/web/src/lib/server/services.test.ts apps/web/src/lib/server/task-capture.test.ts`: passing

## Remaining Production Work Outside This Repo-Level Pass

- Add durable/background upload handling with retries across app backgrounding or process death.
- Provision and verify the real production HTTPS API base URL for Android release builds.
- Add release signing, distribution, and store-facing mobile packaging work.
- Add production-grade observability dashboards and alerting around voice-capture failures.
- Add infrastructure-backed rate limiting and abuse protection at the deployed API edge.
- Add end-to-end production environment validation against the hosted Android app and hosted web API.
