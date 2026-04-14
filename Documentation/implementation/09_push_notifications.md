## Purpose
Track deferred background-notification work without keeping inactive server endpoints in the production codepath.

## Inputs / dependencies
- [Documentation/implementation/08_capture_pipeline.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/08_capture_pipeline.md)

## Requirements from source docs
- Revisit mobile/background notifications only when there is a concrete product requirement.
- Keep core task capture and realtime synchronization independent from push delivery.

## Decisions / assumptions
- Push integration is intentionally deferred.
- When it returns, it should use a real provider end to end rather than placeholder abstractions.

## Files to create or modify
- future Android/background notification integration points

## Detailed tasks
- Choose a production push provider only when background alerts are in scope.
- Reintroduce device registration and delivery flows together at that time.

## Testing tasks
- add delivery and registration tests only when a real provider is introduced

## Exit criteria
- Push is either still explicitly deferred or implemented with a real provider and no placeholder code.

## Risks / failure modes
- Reintroducing push too early can recreate dead code and unnecessary operational surface area.

## Notes for the next step
Build the web app shell and authentication-aware layout.
