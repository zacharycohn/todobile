## Purpose
Implement manual task creation, editing, completion, restore, and delete flows in the web app.

## Inputs / dependencies
- [Documentation/implementation/11_web_views_today_backlog_upcoming_archived.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/11_web_views_today_backlog_upcoming_archived.md)

## Requirements from source docs
- Manual creation is required for normal web task management.
- Task updates must support mutable fields and consistent status transitions.

## Decisions / assumptions
- Use modal or sheet editing patterns with optimistic updates backed by server validation.
- Keep source metadata on manual creation as `web_manual`.

## Files to create or modify
- task editor components
- mutation hooks/actions
- form validators

## Detailed tasks
- Build create/edit forms with category, assignee, dates, and URL inputs.
- Add complete/reopen/delete affordances.
- Surface validation and API errors clearly.

## Testing tasks
- component and integration tests for forms and mutations

## Exit criteria
- Web users can manage the full task lifecycle without leaving the app shell.

## Risks / failure modes
- Status transitions may diverge between UI affordances and backend rules.

## Notes for the next step
Scaffold the Android app shell and shared API client.
