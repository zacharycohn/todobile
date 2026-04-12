## Purpose
Implement Android capture entry points for text and voice task creation.

## Inputs / dependencies
- [Documentation/implementation/13_android_app_shell.md](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation/13_android_app_shell.md)

## Requirements from source docs
- Support `android_widget_text`, `android_widget_voice`, and `android_app_manual` capture sources.
- Android is the primary quick-capture surface.

## Decisions / assumptions
- Provide both in-app quick capture and a widget/pinned shortcut scaffold.
- Voice upload may be staged behind runtime permission checks.

## Files to create or modify
- widget/shortcut classes
- capture screens/view models
- API service integration

## Detailed tasks
- Add text capture form and voice recording flow scaffold.
- Send source metadata correctly.
- Display success/failure feedback and created task details.

## Testing tasks
- unit tests for capture view models
- instrumentation placeholders for manual QA scripts

## Exit criteria
- Android capture flows are implemented or clearly stubbed where device-only verification is required.

## Risks / failure modes
- Widget APIs vary by launcher and emulator image.

## Notes for the next step
Add device token registration and notification handling in Android.
