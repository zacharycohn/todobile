## Purpose
Create the responsive web shell, navigation, and authenticated data bootstrap.

## Inputs / dependencies
- [Documentation/implementation/09_push_notifications.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/09_push_notifications.md)

## Requirements from source docs
- Responsive web app for household task management
- Same API surface as Android

## Decisions / assumptions
- Use Next.js App Router with a light, optimistic client shell over server-backed route handlers.
- Use Supabase Auth client-side for session acquisition and API bearer tokens.

## Files to create or modify
- `apps/web/src/app/*`
- layout, auth pages, shared UI components

## Detailed tasks
- Create root layout, providers, and session bootstrap.
- Implement sign-in screen and protected app shell.
- Add reusable task list scaffolding, filters, and empty states.

## Testing tasks
- component tests for layout and auth guards

## Exit criteria
- A signed-in user can reach the app shell and load profile/bootstrap data.

## Risks / failure modes
- Auth redirect loops if token/session hydration is inconsistent.

## Notes for the next step
Implement the main Today, Backlog, Upcoming, and Archived views.
