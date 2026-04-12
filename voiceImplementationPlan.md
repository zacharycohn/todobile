# Voice Upload Implementation Plan

This plan adds real Supabase authentication to the Android app and connects the existing Android recorder to the existing web voice-capture endpoint.

## Goal

When a signed-in Android user finishes a recording, the app should upload the recording to the web server with a real Supabase bearer token. The web server should continue using the existing `/api/v1/captures/voice` route, which already sends the audio to OpenAI transcription and then feeds the transcript into the existing task extraction flow.

## Constraints

- Do not use placeholder auth tokens.
- Use real Supabase auth in the Android app.
- Keep the Android recording model simple: one local file at a time.
- Validate each step before moving to the next one.

## Step 1: Confirm the existing backend integration surface

Status: completed

### Tasks

- Verify the current voice route accepts authenticated multipart uploads.
- Verify the current server auth expects a Supabase bearer token.
- Verify the current server voice pipeline already calls OpenAI transcription and task extraction.

### Completion criteria

- Confirmed `/api/v1/captures/voice` is the route Android should call.
- Confirmed Android only needs to provide a valid bearer token plus audio multipart body.

### Validation

- Inspect:
  - `apps/web/src/app/api/v1/captures/voice/route.ts`
  - `apps/web/src/lib/server/auth.ts`
  - `apps/web/src/lib/server/task-capture.ts`

## Step 2: Add Android configuration for real Supabase and API endpoints

Status: completed

### Tasks

- Add Android build config fields or resource-backed config values for:
  - Supabase URL
  - Supabase anon key
  - API base URL
- Load these values from Gradle properties or environment-backed local config rather than hardcoded placeholders in source.
- Keep the app unable to proceed if config is missing, with a clear error state.

### Completion criteria

- Android code can read all required runtime config values from a single config layer.
- There is a documented local setup path for supplying real values in Android Studio.

### Validation

- Build config compiles.
- The app can render a clear “missing config” state if required values are absent.

## Step 3: Add Supabase Kotlin auth to the Android app

Status: completed in code, pending manual sign-in verification with real local credentials

### Tasks

- Add the official Supabase Kotlin auth dependency.
- Initialize a single shared Supabase client with Auth installed.
- Implement email/password sign-in in Android.
- Implement session restore on app launch.
- Implement sign-out support.
- Expose current access token retrieval for API requests.

### Completion criteria

- User can sign in with real Supabase credentials.
- Session survives app restarts if supported by the SDK defaults.
- App can retrieve the current access token for authenticated API calls.

### Validation

- Compile successfully.
- Manual sign-in succeeds against the real Supabase project.
- Authenticated session is observable in app state.

## Step 4: Add a minimal Android authenticated app shell

Status: completed in code, pending manual sign-in/sign-out verification in emulator

### Tasks

- Replace the recorder-only screen with a minimal authenticated shell:
  - signed-out state: email/password form + sign-in button
  - signed-in state: recorder UI + sign-out action
- Show clear loading and auth error messages.
- Avoid mixing upload logic directly into UI where possible.

### Completion criteria

- Signed-out users cannot access upload actions.
- Signed-in users can reach the recorder screen.

### Validation

- Manual sign-in and sign-out flow works in emulator.
- UI state changes correctly between signed-out and signed-in modes.

## Step 5: Add Android voice upload client

Status: completed

### Tasks

- Create a small authenticated API client for `POST /api/v1/captures/voice`.
- Upload the recorded `.m4a` file as multipart form data.
- Include:
  - `Authorization: Bearer <supabase access token>`
  - `audio`
  - `source`
  - `mimeType`
- Parse success and failure envelopes from the server.

### Completion criteria

- Android can send a real authenticated multipart voice request to the web app.
- Android can surface server success and error results.

### Validation

- Compile successfully.
- Manual upload request returns either a created task or a meaningful server error.

## Step 6: Connect recorder stop action to upload flow

Status: completed

### Tasks

- After recording stops, trigger upload of the latest local file.
- Prevent duplicate uploads while one is already in progress.
- Keep playback working for the most recently recorded local file.
- Ensure a new recording overwrites the previous local file.

### Completion criteria

- One tap starts recording, second tap stops and begins upload.
- Playback still works for the local file after recording.
- New recording replaces prior local audio.

### Validation

- Manual emulator test:
  - sign in
  - record
  - stop
  - observe upload
  - confirm no duplicate upload starts
  - record again and confirm overwrite behavior

## Step 7: Add user-facing upload status and result states

Status: completed

### Tasks

- Add visible status states:
  - idle
  - recording
  - uploading
  - upload succeeded
  - upload failed
- Show the returned task details at a minimal level on success.
- Preserve a usable retry path after failure.

### Completion criteria

- User can tell what the app is currently doing.
- Upload success/failure is no longer silent.

### Validation

- Manual test of both success and failure paths.

## Step 8: Tighten backend integration only where needed

Status: completed

### Tasks

- Review whether backend should honor incoming `source` from Android or continue forcing `android_widget_voice`.
- Update route/service/tests only if required for correctness.
- Keep the existing OpenAI transcription + extraction pipeline intact.

### Completion criteria

- Backend contract matches what Android sends.
- No unnecessary backend redesign is introduced.

### Validation

- Existing or updated server tests pass for voice capture behavior.

## Step 9: Validate end-to-end

Status: partially completed

### Tasks

- Run targeted project checks that are feasible locally.
- Manually verify the full flow:
  - sign in on Android
  - record audio
  - stop recording
  - upload to web API
  - server sends to OpenAI
  - server creates task
- Document any environment-dependent gaps that still require the user’s machine or secrets.

### Completion criteria

- We have a clear statement of what is verified in code and what is manually verified in the emulator.

### Validation

- Android build succeeds.
- Server-side affected tests pass if runnable in this environment.
- Manual emulator flow is ready for you to run end-to-end if local credentials are present.

### Current validation result

- `./gradlew :app:compileDebugKotlin`: passing
- `pnpm vitest run apps/web/src/app/api/v1/routes.test.ts apps/web/src/lib/server/services.test.ts apps/web/src/lib/server/task-capture.test.ts`: passing
- Remaining manual verification:
  - add real Android Supabase/API config values to `apps/android/local.properties`
  - sign in on emulator
  - record audio
  - confirm upload succeeds and task is created by the web backend
