## Purpose
Implement manual task creation, listing, updating, and status transitions.

## Inputs / dependencies
- [Documentation/implementation/06_backend_auth.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/06_backend_auth.md)
- [api_contract.md](/Users/zacharycohn/Documents/ToDobile/Documentation/api_contract.md)

## Requirements from source docs
- `GET /tasks`, `POST /tasks`, `PATCH /tasks/:taskId`
- Support view-based query params, family scoping, search, filtering, and cursor pagination
- Keep `completedAt` and `deletedAt` consistent with status

## Decisions / assumptions
- Add explicit status action endpoints for complete, reopen, and delete if needed by UI, while keeping `PATCH` compatible.
- Use stable encoded cursors based on `(updated_at, id)`.

## Files to create or modify
- task route handlers
- task query builders
- task repository tests

## Detailed tasks
- Build list-query translation from contract params.
- Implement manual create and update logic with validation.
- Add status transition helpers for active/completed/deleted states.

## Testing tasks
- contract tests for query parsing
- integration tests for task list/create/update/status behavior

## Exit criteria
- API task flows match the contract and filter rules.

## Risks / failure modes
- Archived/today/backlog/upcoming semantics can drift if not centralized in one query layer.

## Notes for the next step
Add AI capture routes and one-task-only validation.
