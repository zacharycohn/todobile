## Purpose
Implement cross-layer tests that exercise key user journeys.

## Inputs / dependencies
- [Documentation/implementation/16_testing_strategy.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/16_testing_strategy.md)

## Requirements from source docs
- Validate critical flows across API, DB, web UI, and notifications where practical.

## Decisions / assumptions
- Focus first on health, auth bootstrap, manual create/edit, list views, and text capture with mocked AI.
- Keep e2e data deterministic with local fake auth or seeded fixtures.

## Files to create or modify
- integration tests
- Playwright specs

## Detailed tasks
- Add route-level integration tests for API flows.
- Add browser tests for web app critical paths.
- Add smoke validation for build output and route availability.

## Testing tasks
- `pnpm test`
- `pnpm test:e2e`

## Exit criteria
- The main user flows have automated regression protection.

## Risks / failure modes
- Browser or local server startup may require dependency install and environment setup first.

## Notes for the next step
Document debugging and repair workflow, then use it on any failures.
