# FurniCraft Sales Pipeline: Product Documentation

## 1. Business context

FurniCraft is the fictional business using HighLevel. It supplies office chairs, office desks, conference tables, storage cabinets, and reception desks in bulk to other businesses. HighLevel is the CRM platform in which the FurniCraft sales team manages those prospective orders.

An **opportunity** is one potential sale being tracked through the sales process. The opportunity record separates:

| Term | Meaning in this app | Example |
| --- | --- | --- |
| Customer company | The business that may buy from FurniCraft | Indigo Networks |
| Opportunity | The particular potential order being tracked | Indigo Networks' office chair enquiry |
| Product and quantity | What the customer is considering buying and how many units | Office chairs · 115 units |
| Deal value | The estimated total value of that potential order, in Indian rupees | ₹1,22,000 |
| Opportunity owner | The FurniCraft sales representative responsible for follow-up | Aisha Khan |
| Stage | The current point in the sales process | New Lead |

The intended pipeline is **New Lead → Contacted → Demo Done → Proposal Sent → Negotiation → Won or Lost**. The UI's arrow controls follow the forward route through Won. Lost is selected from the stage dropdown and is treated as a terminal outcome; the previous arrow from Lost returns to Negotiation.

The seeded first row demonstrates the requested example: Indigo Networks, Office chairs, 115 units, ₹1,22,000, Aisha Khan, New Lead. The example is explicitly pinned in `src/services/opportunityGenerator.ts`.

### Data and assignment differences to know

- The generator defaults to 50,000 records, five furniture product types, INR values, and seven named owners. The current request describes a 20-representative team, so owner count is a real gap: `OWNERS` in `src/services/opportunityGenerator.ts` contains seven, not 20.
- The 50,000 opportunity count is present, but company names are generated from 20 fictional base names with numeric suffixes rather than 50,000 distinct real-world-style company names.
- The domain type still calls quantity `licenceCount` for compatibility with the original assignment model. The table labels it as units. `opportunityName` is the product name, not a unique free-form opportunity title.
- “Demo Done” is retained from the pipeline stage contract even though a furniture supplier might more naturally call that stage “Requirements confirmed” or “Quote prepared.”

## 2. User personas

### Sales representatives

They need to find a customer quickly, understand the product, deal value, owner, stage, and last activity, then update the stage without losing their place. The searchable table, inline stage dropdown/arrows, active-row border, next-record focus behavior, and row-level retry support that daily review loop.

### Sales managers

They need a view of pipeline volume, value, won/lost outcomes, stale opportunities, and stage distribution. `PipelineOverview.vue` calculates these values from the loaded opportunity store. Managers can filter by owner and toggle between pipeline-wide and selected-owner metrics.

### Users handling many opportunities

They need to select records that are not all mounted on screen, update a large group, see progress, and recover individual failures. The ID-based selection model, virtualized rows, 500-record batches, persistent partial-failure panel, retry, and version-checked undo support that workflow.

## 3. User problems and product responses

| User problem | Why it matters | Feature in this app | How it helps |
| --- | --- | --- | --- |
| A rep cannot find one opportunity among 50,000 | Search by memory is too slow | Immediate company/product search and filters | Narrows the in-memory result set by text, stage, owner, value, or stale activity |
| A stage dropdown takes several actions for a common adjacent move | Repetitive work slows review | Previous/next arrows beside the stage dropdown | Moves along the main workflow with one click; dropdown remains for direct corrections and Lost |
| Updating a row changes its sort position | The rep can lose their review sequence | Brief green moved-row highlight and focus advance based on the old order | Shows where the saved row went and moves focus to the former next opportunity |
| Teammate edits keep reordering the table | Reps lose the active record | Explicit Sync updates and active-row anchor | Remote demo edits wait until manual sync; a Go to active row control restores the anchor |
| One save fails after the UI has shown the new value | The rep may assume the change was saved | Optimistic save state, reconciliation, retry | Shows saving/error/conflict state and restores the latest server record where available |
| Two people edit the same opportunity | One person's newer edit can be lost | `version` and `expectedVersion` checks in the fake API | A stale write is rejected and its latest record is returned as a conflict |
| One item fails in a bulk operation | Repeating the entire operation wastes time and can duplicate outcomes | Per-record results and failed-ID retry | Successful rows remain saved; retry targets only IDs reported failed |
| A large selection takes time | User needs feedback and a way to stop before later batches | Progress bar, canceling state, 500-record batches | Reports batch progress and reconciles records not sent after cancellation |
| Long sessions need reduced visual glare | Theme preference should be easy to find | Light/dark toggle in the header | Follows system preference until the user chooses and then stores that choice in local storage |

## 4. Feature guide

### Pipeline overview and stage board

1. **What it does:** Shows total opportunities, pipeline value, won, lost, and stale counts. Stage tiles show counts and percentages and act as stage filters.
2. **Why users need it:** A rep or manager can see pipeline shape before drilling into rows.
3. **How to use it:** Click a stage tile to filter the table; click it again to clear. When an owner is filtered, use the owner-statistics switch to show all-pipeline or selected-owner metrics.
4. **Internally:** `PipelineOverview.vue` derives metrics from `store.records`. It uses local component state for the owner-only toggle. The stage counts themselves are a Pinia computed value.
5. **Failure behavior:** There is no remote analytics request. Metrics reflect the current in-memory cache, including optimistic bulk stage values while a bulk request is still running, and then reflect reconciled batches.
6. **Benefits:** The cards and stage board are data-derived rather than hard-coded.
7. **Limitations:** Metrics are not server aggregates and scan the client dataset. The owner-only stage tile's visible count is owner-scoped, but its accessible label currently uses the global store stage count; this should be corrected. Attention is based on `lastActivityAt` older than 30 days, with no custom threshold.

### Opportunity table and virtualization

1. **What it does:** Shows customer, furniture order, deal value, owner, stage, last activity, updated date, and save state.
2. **Why users need it:** A dense comparison and review surface is more practical than 50,000 cards.
3. **How to use it:** Scroll the table, click sortable headings, inspect the row state, or use the row controls.
4. **Internally:** `OpportunityTable.vue` uses `@tanstack/vue-virtual` with a fixed 56 px estimate, eight-row overscan, and opportunity IDs as keys. `OpportunityTableRow.vue` renders the individual virtual row. The caption and sortable header are separate components.
5. **Failure behavior:** A row has saved/saving/error/conflict state and offers Retry when the state is error or conflict.
6. **Benefits:** The browser mounts the viewport and overscan rows, not all 50,000 DOM rows.
7. **Limitations:** All records are still held in memory. Row height is assumed fixed. There is no pagination or server-side query.

### Search, filters, and sorting

1. **What it does:** Searches customer company and product text; filters by stage, owner, min/max deal value, and inactivity over 30 days; sorts by company, value, last activity, or updated time.
2. **Why users need it:** Reps can narrow and prioritize work without scanning the entire dataset.
3. **How to use it:** Type in search, choose a stage/owner, set value boundaries, toggle stale-only, or click a sortable heading.
4. **Internally:** `OpportunityFilterToolbar.vue` updates `store.filters`. `filterOpportunities` applies all predicates in one pass; `sortOpportunities` sorts a copied array. Search is immediate; there is no debounce.
5. **Failure behavior:** These operations are local and have no network failure path. Invalid or inverted min/max ranges simply result in no matches; there is no validation message.
6. **Benefits:** Search includes both company and product. Owner choice supports text search and keyboard navigation.
7. **Limitations:** A keystroke can trigger a scan and sort of up to 50,000 records. Filters and sorting are not server-backed.

### Individual stage updates

1. **What it does:** Changes one opportunity's stage through a dropdown or previous/next arrow.
2. **Why users need it:** Stage updates are a core part of daily pipeline maintenance.
3. **How to use it:** Pick any stage from the dropdown or move one step with an arrow. The row also supports ArrowLeft/ArrowRight while its row or stage arrow has focus.
4. **Internally:** `OpportunityTableRow.vue` emits `stageChange`; `OpportunityTable.vue` calls `applyStageChange`; Pinia's `changeStage` action in `recordActions.ts` applies an optimistic local value and submits an expected version through `fakeApi.updateOpportunity`.
5. **Failure behavior:** A normal save error restores the latest server record when available and displays an error. A stale version becomes a conflict. Row Retry fetches current server data and replays the saved intended stage.
6. **Benefits:** Fast feedback plus visible failure states and review-order focus management.
7. **Limitations:** Only stage is editable in the interface. Although the API type allows owner and deal value changes, there are no controls for editing those fields. Conflict retry is explicit but ultimately replays the user's stored stage intention; there is no field-level merge UI.

### Bulk selection and stage updates

1. **What it does:** Updates the stage for selected opportunities, reports progress, and exposes recovery after partial results.
2. **Why users need it:** Managers and reps need to process many similar records efficiently.
3. **How to use it:** Tick row checkboxes or use Select all matching, choose a destination stage, then Apply to selected. During work, use Cancel. After partial failure, use Retry failed or Undo successful updates.
4. **Internally:** `selection.ts` stores IDs in Sets. `selectAllMatching` snapshots the filtered ID list and records unselected exceptions. `bulkActions.ts` marks rows optimistically, sends one array request per 500 IDs in sequence, installs results in a batch, and maintains an undo snapshot.
5. **Failure behavior:** Each result can succeed, fail, or conflict independently. Successful rows remain saved. Failed IDs stay visible in the alert and can be retried separately. Undo only submits records whose current version equals the saved post-bulk version.
6. **Benefits:** Partial success is retained; retry does not replay known successes; cancellation does not falsely roll back an already dispatched batch.
7. **Limitations:** The row-header checkbox selects virtualizer-returned rendered rows, which includes overscan rows, not every filtered result. Select all matching is the separate operation for all results. Bulk operations support stage only. A new bulk operation replaces the prior undo snapshot. Undo can itself fail randomly and has no dedicated retry workflow.

### Optimistic saves, save state, and retry

1. **What it does:** Shows a stage change locally before the API simulation finishes.
2. **Why users need it:** The default request delay is 300–1500 ms, so waiting before showing every change feels slow.
3. **How to use it:** Change a stage and watch the row's Sync state. If it fails, use row Retry.
4. **Internally:** `saveStates` and `errors` are maps keyed by record ID. The local stage is installed first; authoritative success replaces it; failure restores `ApiError.latest` or attempts a fetch.
5. **Failure behavior:** The UI distinguishes `error` and `conflict`. Retry reads the server and replays the pending stage.
6. **Benefits:** Responsive updates and recovery paths.
7. **Limitations:** There is no request idempotency key. A timeout after a server commit but before the client receives the response is not modeled separately. Retry can submit the same intent again.

### Version conflicts and teammate updates

1. **What it does:** Simulates a teammate changing a stage on the authoritative fake server and prevents stale writes from silently overwriting that version.
2. **Why users need it:** Concurrent edits to the same deal must not erase one another.
3. **How to use it:** Activate a row, open Simulation controls, simulate a teammate edit, then attempt a local stage change before clicking Sync updates. The stale write becomes a conflict; sync lets the user see the latest stage before retrying.
4. **Internally:** Each record has a numeric `version`. Updates compare `expectedVersion` with server `version`, and successful changes increment it. `simulateTeammate` changes the server record and adds its ID to a pending-sync Set without updating the visible local record.
5. **Failure behavior:** Conflicts return the latest server record and are highlighted distinctly. Sync fetches a full snapshot and keeps in-flight local saves visible.
6. **Benefits:** The demo can reproduce a lost-update race with one page.
7. **Limitations:** This is not cross-browser or cross-device collaboration. Pending IDs do not contain an activity log or actor identity. Sync fetches all records rather than changes since a cursor.

### Simulation controls

1. **What it does:** Exposes offline mode, save-failure rate, request delay, and the same-deal teammate scenario.
2. **Why users need it:** Reviewers can reproduce failure and concurrency cases without a backend.
3. **How to use it:** Open Simulation controls. Defaults are 10% failure and 300–1500 ms delay; use offline or set the failure slider as needed.
4. **Internally:** `SimulationPanel.vue` binds to the simulation Pinia store. A watcher calls `fakeApi.configure`. The teammate scenario targets the active row (or a random record when called without one).
5. **Failure behavior:** API operations reject offline after the configured simulated wait. Individual writes have random failure; bulk writes make independent per-record random failure decisions.
6. **Benefits:** Repeatable manual demonstrations; tests can set delays and failure rate to zero or one.
7. **Limitations:** The UI only exposes the minimum delay slider; max delay remains 1500 ms. “Teammate updates are enabled” is informational, not a toggle. `getOpportunity` does not run network delay/offline simulation; `getOpportunities` does.

### Keyboard accessibility and visual feedback

1. **What it does:** Supports `/` to focus search, ArrowUp/Down to move between rows, ArrowLeft/Right to change stage, Space to select a focused row, and Escape to clear selection or blur search.
2. **Why users need it:** Keyboard operation reduces repeated mouse travel and supports accessibility.
3. **How to use it:** Focus a row and use the advertised shortcuts; click Help for a short reminder.
4. **Internally:** `OpportunityTable.vue` handles row navigation; `App.vue` handles global shortcuts; the filter component exposes search focus methods.
5. **Failure behavior:** Saves from keyboard shortcuts follow the same store path as buttons.
6. **Benefits:** Keyboard stage updates, visible active-row border, green post-save highlight, and live status labels.
7. **Limitations:** Existing tests do not exercise the shortcuts, owner list keyboard navigation, or screen reader output. The stage board's owner-only accessible count is inconsistent, as noted above.

### Theme

The header switch changes a root data attribute. The app follows `prefers-color-scheme` until a user toggle is stored in local storage. It does not provide a per-user server preference or a high-contrast theme.

### Undo

Undo is implemented for the most recent bulk change. The store saves each successful row's previous stage and post-save version. Undo restores only rows that still match that post-save version and reports restored/skipped counts. It is a best-effort compensating update, not a database transaction. The UI does not offer undo for a single-row update.

## 5. Current product limitations

- Seven owners exist in generated data; the stated scenario calls for 20 representatives.
- No authentication, permissions, persistence, backend, multi-tab sync, activity history, or real-time updates.
- Search has no debounce. Search, filtering, sorting, summaries, and sync work on the full in-memory dataset.
- There is no pagination, server query, or bulk owner/value editing.
- Some stage names are inherited from a generic sales demo and may not match furniture sales terminology.
- The fake API models only a subset of production network and server behavior.
