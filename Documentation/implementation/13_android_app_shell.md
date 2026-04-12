## Purpose
Scaffold the native Android app structure and base networking/session layers.

## Inputs / dependencies
- [Documentation/implementation/12_web_task_editing.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/12_web_task_editing.md)

## Requirements from source docs
- Native Android app for capture and push notifications
- Calls the same hosted API base URL as the web app

## Decisions / assumptions
- Use Kotlin, Jetpack Compose, Retrofit/OkHttp, Kotlinx Serialization, and WorkManager where appropriate.
- Authentication wiring will be documented with placeholders if Supabase Android setup cannot be verified locally.

## Files to create or modify
- `apps/android/*`

## Detailed tasks
- Create Gradle settings and app module files.
- Add Compose app shell, API models, and repository interfaces.
- Add config placeholders for API base URL and auth token handling.

## Testing tasks
- Gradle unit test scaffold
- static review of project structure if local Android build tooling is unavailable

## Exit criteria
- Android project opens cleanly in Android Studio and contains coherent app architecture.

## Risks / failure modes
- Full Android compilation may be blocked by unavailable SDK components.

## Notes for the next step
Implement capture-focused flows and optional home-screen shortcuts/widgets.
