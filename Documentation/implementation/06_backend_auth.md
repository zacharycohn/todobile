## Purpose
Implement authenticated user bootstrap and profile-family resolution.

## Inputs / dependencies
- [Documentation/implementation/05_backend_foundations.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/05_backend_foundations.md)

## Requirements from source docs
- `GET /me` returns user, family, and app-specific profile fields.
- Missing profile should map to `profile_not_found`.

## Decisions / assumptions
- Read profile plus family name in one query or view-equivalent join.
- Use bearer token extraction from the `Authorization` header.

## Files to create or modify
- `/api/v1/me` route
- auth utility tests

## Detailed tasks
- Implement current-user resolution helpers.
- Add `GET /api/v1/me`.
- Cover unauthorized and missing-profile paths.

## Testing tasks
- route tests for success, unauthorized, and missing profile

## Exit criteria
- Authenticated clients can bootstrap app identity and family scope.

## Risks / failure modes
- Incorrect token parsing can cause false `unauthorized` responses.

## Notes for the next step
Implement task CRUD and queryable list views.
