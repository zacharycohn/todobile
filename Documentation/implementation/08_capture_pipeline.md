## Purpose
Implement text and voice capture routes that convert one input into exactly one task.

## Inputs / dependencies
- [Documentation/implementation/07_backend_task_endpoints.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/07_backend_task_endpoints.md)

## Requirements from source docs
- `POST /captures/text`
- `POST /captures/voice`
- Each capture must create exactly one validated task or fail without inserting one

## Decisions / assumptions
- Isolate AI parsing behind a provider interface so tests can stub OpenAI cleanly.
- Voice upload parsing will accept multipart form data and use temp buffers only in memory for tests.

## Files to create or modify
- capture route handlers
- AI parser abstraction
- capture tests and fixtures

## Detailed tasks
- Implement structured extraction schemas.
- Enforce one-task output and validate enum/date/url fields.
- Persist task and return the normal task envelope on success.

## Testing tasks
- unit tests for parser validation
- route tests for success, malformed AI output, and provider failure

## Exit criteria
- Capture routes are deterministic under mocked AI responses and never create partial records on failure.

## Risks / failure modes
- Multipart handling can break on Edge runtimes; use Node runtime route handlers where needed.

## Notes for the next step
Integrate device registration and push notification delivery hooks.
