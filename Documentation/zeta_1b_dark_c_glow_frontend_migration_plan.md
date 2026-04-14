# Zeta 1B Dark C Glow Frontend Migration Plan

## Execution Status

- [x] Step 1 test coverage updated first
- [x] Step 2 frontend view model introduced
- [x] Step 3 owner chips replaced the old partner toggle
- [x] Step 4 queue presentation helpers added
- [x] Step 5 top shell rebuilt in the new hierarchy
- [x] Step 6 grouped columns replaced with a unified queue
- [x] Step 7 overflow actions implemented
- [x] Step 8 local row reordering implemented
- [x] Step 9 creation overlay implemented
- [x] Step 10 signed-out state ported
- [x] Step 11 supporting states reintroduced in the new design
- [x] Step 12 stylesheet rewritten around the new visual system
- [x] Step 13 responsiveness tuned for the narrow centered shell
- [x] Step 14 final validation rerun after all edits
- [ ] Step 15 manual frontend verification
- [x] Step 16 stopped short of backend/product changes

## Progress Notes

- Added pure queue/view helpers in `apps/web/src/components/task-dashboard-view.ts` and covered them with dedicated tests in `apps/web/src/components/task-dashboard-view.test.ts`.
- Expanded `apps/web/src/components/task-dashboard-app.test.tsx` to cover the new sign-in shell, tab semantics, owner chip defaults, scheduled filtering, archived view behavior, overlay creation flows, OpenAI debug visibility, queue completion, overflow actions, and realtime refresh.
- Rebuilt `apps/web/src/components/task-dashboard-app.tsx` around the `Open / Scheduled / Closed` model while keeping the existing backend APIs unchanged.
- Moved task creation behind a modal overlay and preserved text capture, voice capture, manual creation, toast behavior, and OpenAI debug disclosure.
- Replaced the old grouped board and light theme in `apps/web/src/app/globals.css` with the dark `zeta-1b-dark-c-glow` visual system and queue layout.
- Completed Step 14 with a green validation loop:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm db:test`
- Step 15 remains open from inside this session because a headless Chromium smoke test against the local dev server was blocked by sandbox-level macOS browser launch permissions (`bootstrap_check_in ... Permission denied`).

## Scope

This plan covers a frontend-only migration from the current web UI to the `zeta-1b-dark-c-glow` interface direction.

Constraints:

- Do not add or remove product features.
- Do not make backend or database changes as part of this migration.
- Preserve all current backend integrations and task behavior.
- Favor speed and efficiency over almost everything else.

The implementation should preserve the current functionality while changing the presentation, information hierarchy, and interaction model.

## Confirmed Product Decisions

These decisions are locked for the migration:

1. Bottom navigation semantics:
   - `Open` = all active tasks
   - `Scheduled` = all active tasks with a future `scheduledDate` or future `deadlineDate`
   - `Closed` = archived tasks

2. Owner chips:
   - Use multi-select chips
   - No explicit `All` chip
   - Default selected chips:
     - the current user
     - `Somebody`

3. Row drag handle:
   - Reordering will be implemented

4. Task creation surface:
   - Use a modal/overlay
   - Do not create a separate app route for task creation

## Migration Goals

- Replace the current wide board layout with a narrow, dense, dark queue interface.
- Make review and completion the primary experience.
- Push capture and manual entry behind a secondary action.
- Preserve text capture, voice capture, manual task creation, task status updates, search, filters, realtime updates, auth, and debug tooling.
- Derive `Open` and `Scheduled` in the frontend from existing task data rather than changing API semantics again.
- Keep the UI fast to scan, low-friction, and obvious.

## Current Frontend Summary

The current frontend in [task-dashboard-app.tsx](/Users/zacharycohn/Documents/ToDobile/apps/web/src/components/task-dashboard-app.tsx) has these characteristics:

- signed-out state uses a light hero-style login panel
- signed-in state uses:
  - a wide page shell
  - top toolbar with `backlog` and `archived`
  - `includePartner` toggle
  - search input
  - grouped task columns by assignee
  - task cards with always-visible `Complete`, `Reopen`, and `Delete` buttons
  - capture and manual task forms pinned in visible panels below the task list
  - a toast and inline error/loading states
  - OpenAI debug inside the capture panel

The current stylesheet in [globals.css](/Users/zacharycohn/Documents/ToDobile/apps/web/src/app/globals.css) is a light editorial design system and does not map naturally onto the selected prototype.

## Target Frontend Summary

The selected prototype in:

- [index.html](/Users/zacharycohn/Documents/ToDobile/prototypes/zeta-1b-dark-c-glow/index.html)
- [signed-out.html](/Users/zacharycohn/Documents/ToDobile/prototypes/zeta-1b-dark-c-glow/signed-out.html)
- [task-creation.html](/Users/zacharycohn/Documents/ToDobile/prototypes/zeta-1b-dark-c-glow/task-creation.html)
- [styles.css](/Users/zacharycohn/Documents/ToDobile/prototypes/zeta-1b-dark-c-glow/styles.css)

introduces:

- narrow centered single-column shell
- dark glossy surface system
- dense queue rows instead of assignee-grouped columns
- summary pills at the top
- colored owner chips
- bottom navigation
- checkbox-first task completion
- overflow-style secondary row actions
- separate creation state
- stronger visual urgency through due-soon and late glow treatments

## Gap Analysis

### Structural changes

- Replace grouped columns with one unified list.
- Replace the wide toolbar with:
  - summary pills
  - owner chips
  - compact search/filter placement
- Replace always-visible creation panels with an `Add` launcher and overlay composer.

### Interaction changes

- Replace visible action buttons with:
  - checkbox for primary completion
  - overflow menu for reopen and delete
- Add row reordering behavior.
- Replace `includePartner` toggle with chip-based visibility control.

### State model changes in the frontend

- Replace current top-level `view` rendering with three frontend views:
  - `open`
  - `scheduled`
  - `closed`
- Continue calling the backend with:
  - `view=backlog` for `open` and `scheduled`
  - `view=archived` for `closed`
- Perform frontend-only slicing for `scheduled`.

### Styling changes

- Replace the light palette and serif-led page design with the dark prototype system.
- Rebuild spacing, shape, borders, shadows, and typography to match the target.
- Add glow styling carefully so urgency is visible without becoming noisy.

### State coverage gaps to account for

The prototype does not fully depict:

- realtime loading states
- empty states
- error states
- toast state
- drag/reorder feedback
- keyboard focus treatments
- overflow menu states
- search-active states
- OpenAI debug state
- auth pending/sign-out pending states

These must be designed and implemented during migration rather than left implicit.

## Implementation Principles

- Keep the screen optimized for quick scanning and fast task clearing.
- Keep the most common action path obvious:
  - open app
  - scan queue
  - complete or adjust tasks
- Use progressive disclosure:
  - primary action visible
  - secondary actions behind menus or overlays
- Preserve accessibility:
  - keyboard navigation
  - visible focus states
  - non-color urgency indicators
  - proper button labeling
- Prefer clarity over ornamental fidelity when the prototype and real behavior are in tension.

## Step-by-Step Migration Plan

### 1. Lock test coverage before implementation

Update or add frontend tests first so the migration is anchored by behavior, not appearance only.

Files:

- [task-dashboard-app.test.tsx](/Users/zacharycohn/Documents/ToDobile/apps/web/src/components/task-dashboard-app.test.tsx)
- add additional focused component tests if needed

Add coverage for:

- signed-out state still renders correctly
- signed-in state renders top-level nav:
  - `Open`
  - `Scheduled`
  - `Closed`
- owner chips render with dynamic current-user default selection plus `Somebody`
- `Scheduled` view only shows active tasks with future `scheduledDate` or future `deadlineDate`
- `Open` view shows all active tasks
- `Closed` view uses archived tasks
- clicking checkbox completes an active task
- overflow menu exposes secondary actions
- `Add` opens the creation overlay
- text capture still works from the overlay
- voice capture still works from the overlay
- manual task creation still works from the overlay
- OpenAI debug remains available inside the overlay
- toast still appears after task creation
- empty and error states still render

If row reordering is implemented with its own helper or hook, add dedicated unit tests for:

- reorder intent updates visual order locally
- reorder state survives filter/view recalculation appropriately
- unsupported cases fail gracefully

### 2. Introduce the new frontend view model

Refactor the signed-in UI state in [task-dashboard-app.tsx](/Users/zacharycohn/Documents/ToDobile/apps/web/src/components/task-dashboard-app.tsx).

Replace the current view model:

- `backlog`
- `archived`

with frontend-only UI tabs:

- `open`
- `scheduled`
- `closed`

Behavior:

- `open`
  - fetch `view=backlog`
  - show all active tasks

- `scheduled`
  - fetch `view=backlog`
  - filter client-side to active tasks with:
    - future `scheduledDate`, or
    - future `deadlineDate`

- `closed`
  - fetch `view=archived`
  - show archived tasks

Implementation notes:

- keep this as presentation logic only
- do not alter the backend contract
- use a shared helper so date-based filtering is deterministic and testable

### 3. Replace includePartner with multi-select owner chips

Refactor current household visibility controls.

Current behavior:

- one checkbox toggle: `Include partner tasks`

Target behavior:

- multi-select chips representing:
  - current user
  - partner
  - `Somebody`

Rules:

- default selected:
  - current user
  - `Somebody`
- unselected owners are hidden from the list
- this should be client-side filtering only unless the existing API params happen to map neatly

Recommendation:

- implement chip state as an array or set of selected assignees
- keep it independent from backend query semantics
- continue using the fetched household data and filter in memory for this UI layer

### 4. Add derived helpers for queue presentation

Create presentation helpers for the new queue.

Suggested responsibilities:

- determine visible tasks from:
  - fetched tasks
  - selected tab
  - owner chips
  - search text
- compute summary counts:
  - open
  - scheduled
  - closed
  - late
- compute urgency treatment:
  - `late`
  - `due-soon`
  - neutral
- format metadata lines for rows

Suggested extraction:

- keep pure helpers in a colocated utility file if the component gets too large
- make the date logic easy to unit test

### 5. Rebuild the top shell in the new visual hierarchy

Refactor the signed-in main layout to match the prototype structure:

- top header with date and sign-out
- summary pills
- owner chip row
- secondary `Add` action
- single queue list
- bottom nav

Requirements:

- preserve the narrow centered layout on desktop
- do not literally render a fake device frame if it harms usability
- keep the shell responsive and strong on both laptop and mobile

Implementation note:

- preserve a single dominant content area
- keep the queue above the fold as much as possible
- de-emphasize everything not required for review/completion

### 6. Replace grouped columns with a unified queue row component

Remove the grouped-by-assignee board and replace it with one list component.

Each row should include:

- reorder handle
- completion checkbox
- category pill
- task title
- owner label
- compact timing/status line
- optional URL link treatment
- overflow action trigger

Behavior:

- active rows should be compact and easy to scan
- archived rows can use muted treatment
- owner coloring should remain legible and not rely on color alone

Recommendation:

- extract a reusable task row component once the layout stabilizes
- avoid splitting into too many components before the first integration pass

### 7. Implement overflow actions

Replace the visible `Complete / Reopen / Delete` button row with contextual actions.

Primary action:

- checkbox for completing active tasks

Secondary actions in menu:

- `Reopen`
- `Delete`

Rules:

- actions shown should match task status
- preserve current backend behavior exactly
- menu should be keyboard accessible and dismiss predictably

### 8. Implement row reordering

Add the reorder feature using the row grabber/handle.

Important note:

- the current backend does not store ordering
- this means reordering must remain a frontend-only ordering layer unless a future backend change is introduced

Recommended implementation for this migration:

- implement local, session-scoped ordering in the frontend
- allow users to drag rows within the current visible list
- maintain a local order map keyed by task id
- merge that order map with live task updates when possible

Design constraints:

- reordering should not break realtime updates
- reordering should not interfere with filtering
- drag affordance must not conflict with checkbox or menu actions

Add explicit visual states for:

- dragging
- drop target
- keyboard focus

If this proves too unstable during implementation, pause and surface the tradeoff before forcing it through.

### 9. Build the creation overlay

Move capture and manual creation behind an overlay launched by the `Add` button.

Overlay contents:

- text capture input
- voice capture control
- manual task fields
- submission actions
- OpenAI debug disclosure

Requirements:

- keep feature parity with the current app
- preserve the same create/capture handlers and backend calls
- support closing without losing the main queue context
- restore focus correctly when closed

Recommendation:

- begin with one overlay component that contains both capture and manual entry
- if needed, organize the overlay internally using sections or tabs
- keep the default state optimized for the fastest likely path

### 10. Port the signed-out state

Refactor the login state to match the prototype’s condensed dark panel.

Requirements:

- keep email/password sign-in behavior unchanged
- preserve auth pending and error states
- keep it visually consistent with the signed-in shell

### 11. Reintroduce supporting states in the new design system

Explicitly design and implement the states the prototype only hints at.

Required states:

- global loading
- queue loading
- auth loading
- empty queue
- no results from filters/search
- inline error banner
- toast success state
- recording state
- microphone unsupported state
- realtime subscription failure state
- OpenAI debug disclosure state

Each should match the new dark system and remain easy to scan.

### 12. Rewrite the stylesheet around the new visual system

Refactor [globals.css](/Users/zacharycohn/Documents/ToDobile/apps/web/src/app/globals.css) to adopt the new design language.

Tasks:

- define new dark theme tokens
- replace the current light palette
- add queue-specific row styles
- add owner chip variants
- add summary pill styles
- add glow states for urgency
- add overlay styles
- add overflow menu styles
- add drag-and-drop styles
- add accessible focus styles

Important:

- do not keep layering new styles on top of the old system indefinitely
- this should be treated as a full visual-system replacement, not a minor theme patch

### 13. Tighten responsiveness

Validate the new layout across:

- small phones
- larger phones
- tablets
- laptop widths
- desktop widths

Rules:

- queue remains the primary focal area
- controls stay reachable
- overlay remains usable on mobile
- no prototype-only framing should make desktop feel awkward or fake

### 14. Run the full test suite and fix regressions

After implementation:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:test`

If failures appear:

- fix the code
- rerun the full suite
- repeat until green

### 15. Manual frontend verification

After tests pass, manually verify:

- sign in
- sign out
- open/scheduled/closed tab switching
- owner chip filtering defaults
- search behavior
- task completion
- reopen/delete from overflow
- task creation overlay open/close
- text capture
- voice capture
- manual task creation
- OpenAI debug disclosure
- toast behavior
- realtime updates still appear correctly
- drag and reorder interactions

### 16. Stop and review before further product changes

Once the migration is complete:

- summarize any compromises between the prototype and live app behavior
- identify any friction found during reorder implementation
- wait for review before changing backend behavior or adding new product features

## Risks To Watch

- The new `Scheduled` tab depends on careful date logic and timezone handling.
- Owner-chip filtering is replacing a simpler toggle, so the default selection state needs to feel obviously correct.
- Reordering is the highest-risk part of the migration because it introduces interaction complexity without backend persistence.
- The dense glossy style can become visually noisy if urgency glow is overused.
- Moving creation into an overlay improves focus, but only if the overlay stays fast and uncluttered.

## Recommended Implementation Order

1. Update tests first
2. Introduce frontend view helpers and tab semantics
3. Implement owner-chip filtering
4. Rebuild layout shell and queue structure
5. Replace row actions with checkbox plus overflow
6. Build creation overlay
7. Port signed-out state
8. Rewrite styling system
9. Implement drag reorder
10. Run validation and manual QA

## Notes For Implementation

- Keep this migration frontend-only.
- Do not change API endpoints or task schemas.
- Prefer helper extraction when date logic or queue filtering starts to clutter the component.
- If reorder persistence becomes important, treat that as a separate future backend project rather than sneaking it into this migration.
