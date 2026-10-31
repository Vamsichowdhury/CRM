# Design decisions and trade-offs

This document explains the choices visible in the current FurniCraft Sales Pipeline implementation. The application is an interview assignment prototype: its fake API is an in-memory model, not a production backend. File paths below are relative to the repository root.

## Product and interface

### 1. Table-first workspace instead of Kanban

- **Decision / problem:** Use one searchable, sortable, filterable virtual table as the main work surface. The assignment has 50,000 opportunities; a Kanban board would create seven large stage columns and make cross-stage search, comparison, bulk selection, and keyboard review awkward.
- **Why / benefits:** Salespeople can scan company, product, quantity, value, owner, stage, activity, and save state together. Stage arrows provide quick adjacent moves while a dropdown still supports direct stage selection. The stage strip above the table provides a lightweight pipeline overview and can filter the table.
- **Alternatives:** A full Kanban board; a separate board and table mode; a paged table. A board can make stage movement intuitive but does not solve large-list scanning. Two modes add navigation and duplicate interaction rules. Pagination limits DOM work but interrupts continuous review and requires page-aware bulk selection.
- **Trade-offs / production change:** The table is dense and less spatial than Kanban; one row has many controls. A production product should validate task workflows with sales users and may offer a saved Kanban view backed by server queries. Current implementation: `src/components/OpportunityTable.vue`, `OpportunityTableRow.vue`, `PipelineOverview.vue`, `utils/stageNavigation.ts`.

### 2. Explicit stage controls rather than drag-and-drop

- **Decision:** Inline stage select plus previous/next arrows. Arrows follow a quick progression that omits terminal Won/Lost from the linear route; direct dropdown can choose any stage.
- **Reason / benefits:** Controls are visible, keyboard operable, and precise in a dense table. The arrow flow avoids drag precision and makes the action explicit. After a save, focus moves to the next record in the review order captured before resorting; a briefly green border indicates the moved row.
- **Alternatives:** Drag-and-drop, only a dropdown, or keyboard shortcuts only. Drag/drop is harder to use with a virtualized table and keyboard; dropdown-only costs more interaction; keyboard-only is undiscoverable.
- **Trade-offs:** More controls in the row and arrows require users to learn their meaning. `stageNavigation.ts`, `OpportunityTableRow.vue`, and `OpportunityTable.vue` implement this. The default sort is updatedAt descending, so saved rows can move.

### 3. Visible synchronization state

- **Decision:** Simulated teammate edits change fake server state and mark pending IDs; user explicitly clicks **Sync updates** to fetch the latest full snapshot. The active row remains highlighted and a **Go to active row** control restores its location.
- **Reason:** This demonstrates collaboration without continuously changing row order while the user reviews a record. The user sees that remote data is waiting and chooses when to reconcile.
- **Alternatives:** Polling, WebSockets, or refreshing after each teammate write. Those are suitable production transport choices, but cannot be meaningfully demonstrated across users in this single-browser fake API. A whole-snapshot sync is simple for the assignment but expensive.
- **Trade-offs:** It is not real cross-device collaboration; sync reloads all 50,000 records. `syncActions.ts`, `OpportunityTable.vue`, and `OpportunityTableCaption.vue` implement the simulation.

## Frontend architecture

### 4. Vue 3 Composition API and TypeScript

- **Decision:** Vue 3 Composition API with `<script setup>` and TypeScript.
- **Why:** The project is component-oriented; Composition API makes related state/actions explicit and easy to extract. Types constrain stage values, update requests, and API result handling.
- **Alternatives:** Options API or JavaScript. Options API remains viable but can spread related logic across component options. JavaScript is quicker initially but permits invalid stage strings and weakens refactor safety.
- **Trade-offs:** TypeScript types do not validate data at runtime; types can become broad or stale. Use runtime schema validation at an external API boundary in production. `src/types/opportunity.ts` and Vue files are representative.

### 5. Pinia, with separate stores by responsibility

- **Decision:** Pinia stores for opportunity state, row selection, and simulation settings. The opportunity store is a public facade composed from focused record, sync, and bulk action modules.
- **Why:** State is shared by the overview, toolbar, bulk bar, rows, and simulation panel. Centralizing data and actions prevents separate components from writing inconsistent copies. Selection and simulation have distinct lifecycles and can change without rebuilding business records.
- **Alternatives:** Component-local state or one giant store. Local state makes cross-component actions and consistent error handling difficult; a monolithic store was harder to read. Extracted modules keep the Pinia facade but reduce file size.
- **Trade-offs:** More files and module context; several action modules receive a context object. `src/stores/opportunities.ts`, `opportunities/recordActions.ts`, `syncActions.ts`, `bulkActions.ts`, `selection.ts`, `simulation.ts`.

### 6. Service boundary and data types

- **Decision:** UI calls store actions; store actions call `fakeApi`; shared records and request shapes live in `src/types/opportunity.ts`.
- **Why:** Components should express user intent, not network rules. A service boundary isolates simulated delay, failure, and version checks from rendering.
- **Alternatives:** API calls in each row component or a full repository/client abstraction. Component calls duplicate error and reconciliation logic. A larger abstraction is unnecessary while there is one fake service.
- **Trade-offs:** `fakeApi` is a module singleton, so tests and stores share its state unless reset. Production should inject a real HTTP client and validate response data.

## Performance decisions

### 7. TanStack Vue Virtual, not rendering all records

- **Decision:** `useVirtualizer` renders the current viewport plus `overscan: 8`; estimated row size is 56 px.
- **Reason:** 50,000 mounted rows would create huge DOM/layout/paint work. Virtualization mounts only a small window while keeping a scroll-sized surface.
- **Alternatives:** Render all rows, pagination, or TanStack Table. Full rendering is excessive. Pagination reduces DOM but interrupts scanning and selection. TanStack Table is a headless table toolkit, not a replacement for row virtualization; current custom table needs only sorting/filtering logic already present.
- **Trade-offs:** Off-screen rows are not mounted, so selection must be ID-based and focus/scroll must be managed. Row-height estimates and measurement need care. No benchmark is recorded. `OpportunityTable.vue`.

### 8. Bulk batches of 500, sequentially

- **Decision:** The client sends one fake API call for each sequential batch of up to 500 IDs. The fake API returns per-record outcomes. Bulk array updates are installed once per response.
- **Why:** Avoid an unbounded burst of 10,000 requests, keep progress/cancel boundaries, and preserve independent outcomes.
- **Alternatives:** One enormous request, 500 parallel requests, or individual sequential requests. One giant request can exceed payload limits; many concurrent requests can overwhelm a real service; one per-record serial request is slow. The batch API models a more realistic production endpoint, though the current fake request has no server-side transaction.
- **Trade-offs:** Each batch waits for configured latency, so 10,000 records means 20 delayed batches and 50,000 means 100. This is not a concurrency pool. File: `src/stores/opportunities/bulkActions.ts`.

## Reliability decisions

### 9. Optimistic stage updates with reconciliation

- **Decision:** Show the chosen stage immediately, mark saving, then install the authoritative server response. On failure, restore the latest readable server record; mark conflict separately from ordinary error.
- **Why:** A 300–1500 ms simulated wait should not make a simple stage movement feel blocked.
- **Alternatives:** Pessimistically wait before changing the row. Safer/simple but slower-feeling. Blind rollback to the old local value is also unsafe if a teammate changed the record in the meantime.
- **Trade-offs:** Optimistic UI needs careful version checks, local revision tracking, and clear pending/error states. Retry and concurrency behavior are complex. `recordActions.changeStage` and `retry`.

### 10. Local revisions/queues plus server versions

- **Decision:** Serialize same-record writes in one browser with a promise queue; increment a local revision and ignore stale responses; send `expectedVersion` to the API. The fake server rejects stale versions and returns its authoritative record.
- **Why:** Local queue avoids requests racing for the same row; revision guards protect newer local intent; server versions prevent two clients from silently overwriting one another.
- **Alternatives:** Last-write-wins or locks. Last-write-wins loses edits; distributed locks add availability, expiry, and ownership complexity for a simple field update. Version checks are lightweight optimistic concurrency control.
- **Trade-offs:** A conflict requires review/retry and the version applies to the whole record, even when different fields might be edited independently. It is only simulated in one JavaScript process. `recordActions.ts`, `fakeApi.ts`.

### 11. Partial bulk success and retry failed IDs

- **Decision:** Each row result is independent; successes remain saved; failed/conflicting IDs retain status and can be retried without resubmitting successful IDs.
- **Why:** All-or-nothing semantics can be impractical for a large CRM action when some rows have stale versions or transient errors.
- **Alternatives:** Abort/rollback whole bulk transaction or silently skip failures. A real database transaction can provide atomicity, but 10,000-record UI operations may not fit one transaction; silent skipping damages trust.
- **Trade-offs:** The UI must explain partial outcomes and make retry/undo semantics precise. Current tests cover related retry paths but do not directly prove a mixed success/failure response within one batch.

### 12. Cancellation and best-effort undo

- **Decision:** Cancellation is observed between dispatched 500-row batches; the in-flight batch completes, then untouched optimistic rows reconcile from fake server state. Undo is a compensating version-checked write for successful rows.
- **Why:** Aborting a request after a server may already have committed creates an unknown outcome. Finishing the current batch and reconciling makes outcomes clearer.
- **Alternatives:** AbortController or rollback all local state immediately. Browser cancellation cannot guarantee server rollback; immediate rollback can lie about committed writes.
- **Trade-offs / gap:** Cancel is not instantaneous and the UI must communicate reconciliation. Undo can partially fail; current `undoBulk` clears its snapshot even after failed results, so failed undo rows are not offered another undo retry. It is not atomic. `bulkActions.ts`.

### 13. Separate client cache and authoritative fake server

- **Decision:** Fake API owns a `Map` of cloned records; Pinia owns a distinct local cache. Teammate writes only the fake server until manual sync.
- **Why:** Without separate state, simulated concurrency and stale-client conflicts cannot exist. Cloning prevents callers from mutating server objects by reference.
- **Alternatives:** Use Pinia as both client and server. Simpler, but cannot faithfully demonstrate remote changes or version conflicts.
- **Trade-offs:** Both full copies and snapshots cost memory; reset/reload behavior is demo-only and not durable. A production server must be authoritative across processes and clients.

## Production changes we would prioritize

1. Replace whole-dataset fetches with authenticated server-side query/cursor pagination, field-level search, and aggregate metrics.
2. Add runtime response validation, authorization, durable storage, idempotency keys, request tracing, rate limits, and structured logs.
3. Decide conflict UX for same and different fields; use server versions/ETags and show a review/merge interface.
4. Make undo retryable and report every restored/skipped/failed record; persist operation outcomes server-side for large jobs.
5. Add performance and accessibility audits, fix owner-scoped stage labels, and align sample owner count with 20-rep requirement.
6. Add deterministic mixed partial-failure, sync, retry, keyboard, and undo-failure tests.
