## Purpose
Implement device token registration and outbound notification abstraction for task creation/failure alerts.

## Inputs / dependencies
- [Documentation/implementation/08_capture_pipeline.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/08_capture_pipeline.md)

## Requirements from source docs
- `POST /devices/push-token`
- Notify assignee on task creation
- Notify originating device on capture failure when possible

## Decisions / assumptions
- Provide a provider-agnostic notification service with a logging fallback.
- Token upsert prefers `(user_id, device_id)` when `deviceId` is supplied, otherwise `push_token`.

## Files to create or modify
- device route handler
- notification service
- notification tests

## Detailed tasks
- Implement device upsert logic and validation.
- Send best-effort notifications after manual and capture task creation.
- Record provider failures in logs without failing the originating request unless explicitly required.

## Testing tasks
- route tests for idempotent device registration
- service tests for notification fan-out behavior

## Exit criteria
- Device registration works and notification calls are observable in tests.

## Risks / failure modes
- Push provider credentials are unavailable in local development.

## Notes for the next step
Build the web app shell and authentication-aware layout.
