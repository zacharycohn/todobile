## Purpose
Implement the primary list views backed by the task listing API.

## Inputs / dependencies
- [Documentation/implementation/10_web_app_shell.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/10_web_app_shell.md)

## Requirements from source docs
- `today`, `backlog`, `upcoming`, and `archived` views
- filters for assignee, category, search, and archived type

## Decisions / assumptions
- Use server-fetched initial data plus client-side refresh/mutation hooks.
- Keep list semantics mirrored with backend query builder tests.

## Files to create or modify
- view pages and list components
- query-state utilities

## Detailed tasks
- Build each view route or tab.
- Wire filtering controls to query params.
- Handle pagination and archived variants.

## Testing tasks
- UI tests for view switching and filter behavior

## Exit criteria
- All required views render correctly and reflect backend list semantics.

## Risks / failure modes
- Search/filter state may desync from URL without a shared query model.

## Notes for the next step
Add creation, editing, and status mutation flows.
