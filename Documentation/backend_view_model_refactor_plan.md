# Implementation Plan

## Execution Status

- [x] Step 1 audit completed
- [x] Step 2 tests updated first
- [x] Step 3 contract refactor completed
- [x] Step 4 service-layer parsing verified
- [x] Step 5 repository filtering implemented
- [x] Step 6 backend documentation updated
- [x] Step 7 full test suite run
- [x] Step 8 failures fixed until green
- [x] Step 9 manual API sanity checks completed
- [x] Step 10 stop before frontend implementation

## Progress Notes

- Completed Step 2 by updating the existing service and route tests and adding direct repository coverage in `apps/web/src/lib/server/supabase.test.ts`.
- Completed Step 3 by reducing the shared contract view enum to `backlog | archived`, defaulting to `backlog`, and normalizing boolean query parsing.
- Completed Step 4 by moving `listTasks()` to schema-backed validation with `safeParse()` and explicit `validation_failed` errors for invalid query shapes.
- Completed Step 5 by implementing real repository filtering for `backlog` and `archived`, plus support for archived type, assignee, category, search, date-presence filters, and mapped sorting.
- Completed Step 6 by updating the API contract documentation so date-driven slices are documented as frontend-derived rather than backend views.
- Completed Step 7 by running `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm db:test`.
- Completed Step 8 by fixing the remaining invalid-view route test assumption and rerunning the full suite until all checks passed.
- Completed Step 9 with a manual local API smoke test:
  - `GET /api/v1/tasks?view=backlog` -> `200`
  - `GET /api/v1/tasks?view=archived` -> `200`
  - `GET /api/v1/tasks?view=backlog&hasScheduledDate=true` -> `200`
  - `GET /api/v1/tasks?view=backlog&hasDeadline=true` -> `200`
  - `GET /api/v1/tasks?view=today` -> `400 validation_failed`
- Completed Step 10 by finishing the backend refactor and stopping short of any new frontend redesign implementation.

## Audit Notes

- The four-view model currently appears in the shared contract, backend tests, backend docs, and the existing frontend type usage.
- The current backend repository implementation in `supabase.ts` does not actually implement the richer `today` and `upcoming` semantics yet, which supports simplifying the contract.
- The most important missing coverage for this refactor is direct repository filtering behavior, so a new `supabase.test.ts` file should be added before implementation changes.

### 1. Audit the current backend surface area
Identify every backend place that still treats `today` and `upcoming` as first-class views.

Files to inspect and update:
- [index.ts](/Users/zacharycohn/Documents/ToDobile/packages/contracts/src/index.ts)
- [services.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/lib/server/services.ts)
- [supabase.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/lib/server/supabase.ts)
- [routes.test.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/app/api/v1/routes.test.ts)
- [services.test.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/lib/server/services.test.ts)
- [api_contract.md](/Users/zacharycohn/Documents/ToDobile/Documentation/api_contract.md)

Goal:
- confirm what is contract-level
- confirm what is currently implemented
- separate “query model” from “frontend presentation model”

### 2. Write the new tests first
Add and update tests before changing implementation.

#### 2a. Update contract/query tests
In [services.test.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/lib/server/services.test.ts):
- replace any `view=today` or `view=upcoming` expectations
- add tests that confirm only `backlog` and `archived` are accepted
- add tests that confirm date-related query params still pass through correctly:
  - `hasDeadline`
  - `hasScheduledDate`
  - `status`
  - `sort`
  - `order`
  - `search`

#### 2b. Update route tests
In [routes.test.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/app/api/v1/routes.test.ts):
- replace old URL examples that use `today` or `upcoming`
- add coverage for:
  - `view=backlog`
  - `view=archived`
  - invalid view values returning validation errors
- add at least one test proving date-based filtering can coexist with `view=backlog`

#### 2c. Add repository-level tests
This is the most important missing backend coverage for this refactor.

Create or expand direct tests for the task repository behavior in [supabase.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/lib/server/supabase.ts), ideally in a new file such as:
- `apps/web/src/lib/server/supabase.test.ts`

Test cases to cover:
- `backlog` returns only `active` tasks
- `archived` returns only `completed` and/or `deleted` tasks
- `archivedType=completed` only returns completed
- `archivedType=deleted` only returns deleted
- `archivedType=all` returns both
- `hasDeadline=true` only returns tasks with `deadlineDate`
- `hasScheduledDate=true` only returns tasks with `scheduledDate`
- `status=active/completed/deleted` works explicitly
- `search` filters by `details`
- `category` filters correctly
- `assignee` filters correctly
- sort behavior still works

#### 2d. Add regression tests for date semantics
Add tests that prove date fields remain data, not views:
- active task with `scheduledDate=today` is still a `backlog` task
- active task with future `scheduledDate` is still a `backlog` task
- active task with past `deadlineDate` is still a `backlog` task
- only `status` controls whether it is `backlog` vs `archived`

That locks in the new philosophy.

### 3. Refactor the shared contract
Update [index.ts](/Users/zacharycohn/Documents/ToDobile/packages/contracts/src/index.ts).

Changes:
- change `view` enum from:
  - `today | backlog | upcoming | archived`
  to:
  - `backlog | archived`
- change the default from `today` to `backlog`
- keep `archivedType`
- keep date/search/assignee/category/status filters, because those still matter
- decide whether `includePartner` stays for now
  Recommendation: keep it until frontend refactor time, unless you want to remove it in this same backend pass

Result:
- the contract represents only true backend buckets
- date-based interpretations move out of the contract’s view model

### 4. Refactor service-layer parsing
Update [services.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/lib/server/services.ts) if needed.

Goal:
- make sure `listTasks()` simply validates and forwards the new query shape
- no service-level assumptions about `today` or `upcoming`

This should mostly be a schema-driven change once the contract is updated.

### 5. Refactor repository filtering in the backend
Update [supabase.ts](/Users/zacharycohn/Documents/ToDobile/apps/web/src/lib/server/supabase.ts).

This is the real implementation step.

#### 5a. Implement real `view` semantics
For `backlog`:
- return only `status = active`

For `archived`:
- return non-active tasks
- apply `archivedType`:
  - `completed`
  - `deleted`
  - `all`

#### 5b. Implement the other existing filters properly
While touching this code, make the filtering match the contract:
- `category`
- `assignee`
- `status`
- `hasDeadline`
- `hasScheduledDate`
- `search`
- `sort`
- `order`
- `limit`
- `cursor` if supported now, or explicitly leave as pass-through/not implemented and test/document that honestly

#### 5c. Do not encode “today” or “upcoming” logic here
The repository should not:
- split active tasks based on current date
- infer special buckets from `scheduledDate` or `deadlineDate`

Dates remain task attributes only.

### 6. Update backend documentation
Update:
- [api_contract.md](/Users/zacharycohn/Documents/ToDobile/Documentation/api_contract.md)

Change:
- remove `today` and `upcoming` from the documented API query model
- document that:
  - `backlog` = active tasks
  - `archived` = completed/deleted tasks
- explain that “today,” “upcoming,” and “late” are frontend-derived slices based on `scheduledDate` and `deadlineDate`

Optional but recommended:
- update any implementation docs under [Documentation/implementation](/Users/zacharycohn/Documents/ToDobile/Documentation/implementation) that still describe the four-view model

### 7. Run the full test suite
After implementation:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:test`

### 8. Fix failures until green
If anything fails:
- update tests if they still assume the old model and that assumption is no longer valid
- otherwise fix implementation
- rerun full suite until everything passes

### 9. Sanity-check the API behavior manually
After tests pass, do a manual backend smoke check:
- `GET /api/v1/tasks?view=backlog`
- `GET /api/v1/tasks?view=archived`
- `GET /api/v1/tasks?view=backlog&hasScheduledDate=true`
- `GET /api/v1/tasks?view=backlog&hasDeadline=true`
- invalid `view=today` should now fail validation

### 10. Stop before frontend implementation
Once the backend refactor is complete:
- summarize the API changes
- note frontend impacts
- wait for your approval before changing the frontend

## Recommended Scope Decision
I recommend this backend refactor include:
- removing `today` and `upcoming` from the contract
- implementing real `backlog`/`archived` filtering
- keeping `includePartner` unchanged for now

Reason:
- it keeps this pass focused on the view-model simplification
- it avoids mixing in the owner-filter redesign until we start the frontend work

If you want, I can now start with Step 1 and Step 2: audit plus test updates first.
