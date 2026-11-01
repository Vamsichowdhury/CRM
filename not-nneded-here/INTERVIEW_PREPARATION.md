# Interview preparation: FurniCraft Sales Pipeline

Use these as explanations, not lines to memorize. The most credible answer starts with the user problem, describes what the code actually does, then names a limitation. This is a frontend assignment with an in-memory fake API; do not describe it as a deployed multi-user CRM.

## A. Product thinking

### 1. What problem are we solving, who are the users, and what is an opportunity?

**Short answer:** FurniCraft's reps need to review and update many business-customer furniture enquiries without losing their place or trusting a failed save. An opportunity is one potential order, with a customer company, product/quantity, deal value, owner, stage, and activity dates.

**Detailed explanation and example:** Indigo Networks ordering 115 chairs for ₹1,22,000 is one opportunity; Indigo Networks is the prospect, not FurniCraft, and Aisha Khan is the assigned rep. Reps need find/update workflows; managers need stage/value/owner visibility; high-volume users need bulk actions and fast list navigation.

**Why this design / alternative / trade-off:** A focused operational workspace was chosen over a multi-page CRM to make the core workflow demonstrable. A full CRM would need contacts, accounts, tasks, permissions, and reporting that are outside this assignment. The current metrics are useful orientation, not financial reporting.

**Implementation:** `src/services/opportunityGenerator.ts`, `src/types/opportunity.ts`, `src/components/PipelineOverview.vue`, `OpportunityTable.vue`.

**Follow-up:** How would you validate this workflow? Interview reps and managers, instrument search-to-update time and failed-save recovery, and test representative high-volume tasks.

### 2. Why furniture, and why these metrics?

**Short answer:** The furniture scenario gives realistic B2B quantities and INR deal values, making each row understandable as a potential bulk order. Counts, pipeline value, wins/losses, inactivity, and stage shares help managers spot distribution and follow-up needs.

**Detailed explanation:** Products are chairs, desks, conference tables, cabinets, and reception desks. Quantity is shown as units; the stored field name `licenceCount` is a legacy artifact. The generator uses a deterministic seed and explicit first example so reviewers see familiar domain data.

**Why / alternatives / trade-offs:** A domain-specific example is easier to reason about than generic software licenses. A richer dashboard/chart could show weighted forecast, conversion rate, aging, and owner performance, but those require agreed definitions and should not be fabricated from demo data. Current metrics are computed client-side and stage value is unweighted.

**Implementation:** `opportunityGenerator.ts`, `PipelineOverview.vue`, `src/stores/opportunities.ts`.

**Follow-up:** Which metric would you add first? Stage aging by owner, if sales managers confirm it changes prioritization.

### 3. Why table-first instead of Kanban or multiple pages? What would you improve?

**Short answer:** A table supports comparison, search, sorting, and bulk selection across 50,000 records; arrows retain quick stage movement. A stage strip offers a compact board-like overview without rendering seven huge columns.

**Detailed explanation:** Kanban is strong for visual stage flow, but poor for scanning exact customer/value/owner data at this scale. Separate table and board modes duplicate state and navigation. The interface keeps filters, metrics, and operations in one focused workflow.

**Trade-offs and alternatives:** Table rows are dense and stage movement less spatial. Pagination or a Kanban view might work for different user tasks. I would test task completion with reps and consider a saved view that queries a stage column from the server rather than mounting all cards.

**Implementation:** `OpportunityTable.vue`, `PipelineOverview.vue`, `OpportunityTableRow.vue`.

**Follow-up:** What is the biggest UX debt? Dense controls and a mismatch in the owner-only stage board's accessible count label.

## B. Frontend architecture

### 4. Why Vue 3, Composition API, TypeScript, and Pinia?

**Short answer:** Vue's Composition API fits the component-based UI and lets related logic move into focused functions/files. TypeScript models stages and API requests; Pinia shares records and workflows across the table, toolbar, metrics, and bulk controls.

**Detailed explanation:** `DealStage` is a union derived from `DEAL_STAGES`; `UpdateRequest` requires an expected version; `Opportunity` is shared across service/store/components. Pinia owns state that multiple components need. We use three stores for opportunity domain, selection UI intent, and simulation controls.

**Alternatives and trade-offs:** JavaScript would be faster to start but less safe for constrained values. Component-local state duplicates business state. One giant store would be harder to read; separate stores/action modules mean more files and explicit context wiring. Types do not validate runtime API payloads.

**Implementation:** `src/types/opportunity.ts`, `src/stores/opportunities.ts`, `selection.ts`, `simulation.ts`.

**Follow-up:** How would you validate remote JSON? Add runtime schema validation at the service boundary before installing it into Pinia.

### 5. Why a service layer, separated stores, and focused components?

**Short answer:** UI components express user intent while stores coordinate shared state and `fakeApi` models persistence/network behavior. Focused files separate record saves, sync, bulk processing, and selection.

**Detailed explanation:** A row calls `changeStage`; it does not implement network delay, version checking, retries, and reconciliation. The opportunity facade composes `createRecordActions`, `createBulkActions`, and `createSyncActions`. The selection store stores IDs instead of decorating opportunity records with UI state.

**Alternatives and trade-offs:** API calls in components duplicate behavior and make testing awkward; one giant component/store becomes hard to navigate. Too many abstractions can also obscure flow, so these modules are feature-sized and share explicit context.

**Implementation:** `src/stores/opportunities.ts`, `src/stores/opportunities/*.ts`, `src/services/fakeApi.ts`, `src/components/`.

**Follow-up:** How do you avoid duplicated state? Server records have one client cache; selection and save metadata are separate transient maps; service remains authoritative for versions.

### 6. How does data flow through the app, and why computed state?

**Short answer:** App initializes the store; components read shared Pinia state and invoke actions; actions call the API service and install the result; computed values derive table rows and metrics.

**Detailed explanation:** Filter state changes recompute `visibleRecords`; that feeds the virtualizer. A stage action optimistically installs a record, then installs the server result or reconciled record. Derived data avoids separately maintained filtered arrays or hard-coded stage totals.

**Alternative / trade-off:** Manually synchronize multiple copies and metrics would risk drift. Computed state is clear, but a changed dependency can trigger O(N) filtering/metrics and sorting; it is not free or server-backed.

**Implementation:** `App.vue`, `opportunities.ts:visibleRecords`, `opportunityFilters.ts`, `syncActions.ts`.

**Follow-up:** How would you scale queries? Make filter/sort/pagination server parameters, and treat the client as a page cache rather than full source of truth.

## C. Performance

### 7. How do you handle 50,000 opportunities? What is virtualization, overscan, and a stable key?

**Short answer:** TanStack Vue Virtual mounts only the viewport rows plus eight overscan rows. A stable opportunity ID is the key, so identity follows the row when sorting reorders it.

**Detailed explanation:** 50,000 actual table rows would create many DOM elements, style/layout work, and event/accessibility nodes. The virtualizer uses an estimated row height of 56px and calculates which items occupy the scroll window. Overscan mounts nearby rows to reduce blank flashes during scrolling. Selection is by ID, because off-screen rows do not have mounted components.

**Alternatives / trade-offs:** Pagination lowers DOM work but interrupts continuous review; rendering all rows is too costly; TanStack Table supplies headless table state but is not a virtualizer and is not needed for current custom behavior. Virtualization does not make filtering, sorting, or memory usage constant-time.

**Implementation:** `src/components/OpportunityTable.vue`, `src/stores/selection.ts`.

**Follow-up:** What would one million records require? Server-side search/filter/order and cursor pagination, a bounded client cache, and load/perf measurements. Virtualize only the loaded page/window.

### 8. What costs remain, and how would you measure them?

**Short answer:** Search/filter is O(N), sort is O(k log k), sync clones the full dataset, and selected IDs consume memory. No browser performance improvement has been measured in this repository.

**Detailed explanation:** `shallowRef` avoids deeply proxying flat records; maps help lookup; sets help membership; bulk install updates in batches. These choices reduce specific costs but do not remove full scans or copies. Search is immediate, not debounced.

**Alternative / trade-off:** Debounce reduces repeated scans but introduces delay; a server query is better at larger scale. I would benchmark production build with 50k fixed-seed data and record mounted row count, long tasks, scripting/layout time, heap, search latency, bulk duration, and sync duration across repeated runs.

**Implementation:** `opportunities.ts`, `opportunityFilters.ts`, `OpportunityTable.vue`, `selection.ts`.

**Follow-up:** Why not claim 90% faster? There is no benchmark evidence; virtualization clearly bounds mounted rows, but quantify only after profiling.

## D. Optimistic updates and reliability

### 9. What is an optimistic update, why use it, and what happens on failure?

**Short answer:** An optimistic update shows the intended stage immediately, before the simulated save completes. On success we install the server record; on failure we reconcile the latest server version and expose error/retry state.

**Detailed explanation:** A 300–1500ms request delay would make every stage movement feel blocked. `changeStage` records retry intent, increments local revision, installs the stage, and marks saving. A failure attempts to fetch authoritative state; a conflict uses the server-provided latest record.

**Alternative / trade-off:** Pessimistic UI is simpler and avoids showing uncommitted state, but feels slower. Naive rollback to an old snapshot can overwrite a newer teammate edit, so reconciliation reads current state. Optimistic writes make races more complex and require pending/error display.

**Implementation:** `recordActions.ts:changeStage`, `retry`; `fakeApi.ts:updateOpportunity`.

**Follow-up:** What if the failure response is lost after server commit? Current fake API does not model ambiguous timeouts. Production needs idempotency keys and a status/read reconciliation endpoint.

### 10. What are stale responses, revisions, and retry?

**Short answer:** A stale response is an earlier request result arriving after newer local intent. The store uses a per-ID revision and queue so older local responses do not replace a newer stage; retry rereads server state before replaying intent.

**Detailed explanation:** Every local change increments `revisions[id]`. Same-row requests are chained in `queues`. A success is installed only if its captured revision remains current. Errors from stale revisions are ignored except a conflict, which still matters because it means server state is newer.

**Alternatives / trade-offs:** Abort old requests, or use last-response-wins. Abort may not undo a committed request, and last-response-wins can replace newer intent. Revisions are simple for one record but require tests for interleavings.

**Implementation:** `recordActions.ts`.

**Follow-up:** Are revisions server idempotency IDs? No. They only protect this client from stale local responses; the server receives `expectedVersion` but no operation identifier.

### 11. What happens offline, and how do you prevent duplicate submissions?

**Short answer:** Writes that use the simulated request path fail with a user-visible status and can be retried. Same-row stage writes are serialized, but there is no durable offline queue or idempotency key.

**Detailed explanation:** Offline mode affects `simulate()` calls, then store actions reconcile and expose errors. The retry is explicit. `getOpportunity()` bypasses simulation, which is an inconsistency to fix before claiming realistic offline transport behavior. Bulk UI shows busy/progress, but store-level repeated bulk invocation is not protected by a hard operation lock.

**Alternative / trade-off:** Queue writes offline and replay later, but that requires ordering/conflict UI and durable storage. Disabling controls is useful feedback but not enough to guarantee exactly-once execution.

**Implementation:** `fakeApi.ts`, `recordActions.ts`, `bulkActions.ts`, `BulkActionBar.vue`.

**Follow-up:** How to make safe retries? Give each logical operation a stable idempotency key and have the server return the original result for duplicate keys.

## E. Concurrency

### 12. Explain race conditions, lost updates, expectedVersion, and optimistic concurrency control.

**Short answer:** A lost update occurs when an older client overwrites a newer saved value. The client sends the version it read; the server accepts only if that version is still current, then increments it.

**Detailed explanation/example:** Starting at New Lead/version 1, A saves Contacted with expected 1 and server advances to version 2. B's stale Lost/expected 1 is rejected and receives version 2. This is optimistic concurrency control: no lock is held during editing; a stale write is detected on commit.

**Alternatives / trade-offs:** Last-write-wins is simpler but silently loses work. Distributed locks prevent overlapping writes but create lock expiry/availability/ownership concerns and are unnecessary for a single short field update. Whole-record version can reject separate-field edits that could otherwise merge.

**Implementation:** `UpdateRequest` in `src/types/opportunity.ts`, `FakeApi.updateOpportunity`, `recordActions.changeStage`.

**Follow-up:** How would a real backend enforce this? Atomically update with `WHERE id=? AND version=?`, increment version, and return 409/412 plus latest representation if no row matched.

### 13. Does this support real collaboration? Why not locks or last-write-wins?

**Short answer:** It models conflict behavior in one process but does not synchronize actual browsers or devices. A real shared backend must own the version check, and a collaboration channel can notify clients to refresh.

**Detailed explanation:** The fake API keeps a server Map separate from local Pinia. Teammate simulation mutates only that map, creating a stale local view. Manual sync fetches all records. Different-field merge is not supported because the record version is whole-record.

**Alternatives / production design:** WebSocket/SSE or polling can deliver invalidations/updates; database optimistic locking remains source of truth. Locks are useful for long collaborative editing sessions, but not necessary for quick stage edits. Last-write-wins is unacceptable when preserving edits is a requirement.

**Implementation:** `syncActions.ts`, `fakeApi.ts`, `SimulationPanel.vue`.

**Follow-up:** How would you support simultaneous different-field edits? Use field-level versions or compare changed fields against base, merge non-overlapping changes, and surface conflicts for overlapping fields.

## F. Bulk operations

### 14. Why a concurrency-limited queue/batches? What is partial success?

**Short answer:** The store sends sequential batches up to 500 rather than flooding the service with thousands of requests. Each record can succeed or fail independently, so partial success preserves completed work and identifies only the remaining failures.

**Detailed explanation:** 1,000 rows become two batch calls; 10,000 become 20. A batch incurs one simulated delay and has per-record version/failure results. The client shows progress after each response. Sequential individual requests would wait 1,000 network round trips; 500 concurrent calls could overload a real server; one massive request may exceed payload and execution limits.

**Trade-offs:** “Concurrency-limited queue” is often used broadly, but this code is specifically serial batched requests with up to 500 records per request, not a worker pool with N concurrent requests. A production service could accept an async job and return an operation ID.

**Implementation:** `bulkActions.ts:bulkChangeStage`, `FakeApi.bulkUpdateOpportunities`.

**Follow-up:** How to manage 10,000 in production? Server-side job, durable per-row outcome, progress polling/events, retry by operation ID, and limits/authorization.

### 15. How do retry, cancellation, selection, and undo work?

**Short answer:** Retry resubmits only failed IDs; cancellation stops before the next batch and reconciles untouched optimistic rows; selection is ID-based; undo conditionally restores successful rows only if their version has not changed.

**Detailed explanation:** Selection survives virtual unmounts. “Select all matching” stores a snapshot of matching IDs and exclusions, not a database query expression. Cancel cannot retract a dispatched batch, so that batch settles first. Undo is a compensating stage write, not rollback of a transaction.

**Trade-offs/gaps:** All-matching materializes IDs in browser memory and bulk payloads. Undo has a serious recovery gap: the snapshot is cleared even when some undo records fail, so those failures cannot be retried as undo. Cancellation semantics are best effort and no request abort occurs.

**Implementation:** `selection.ts`, `bulkActions.ts:cancelBulk`, `undoBulk`, `BulkActionBar.vue`.

**Follow-up:** How would server-side select-all work? Send a query/filter token plus excluded IDs; server resolves eligible records at a defined snapshot/version and returns an operation job.

## G. Collaboration and H. testing

### 16. How do teammate updates avoid jumping, and what is the limitation?

**Short answer:** Teammate edits remain only in simulated server state until the user explicitly syncs. The local table therefore does not continuously reorder; the active row ID and Go to active row control help restore context after sync.

**Detailed explanation:** `syncLatest` fetches a full snapshot, preserves rows locally marked saving, rebuilds the cache, and clears pending markers only if no later simulated teammate update changed the generation. This is a single-process demo, not a cross-tab feed.

**Alternative / trade-off:** Polling or WebSocket updates would be more current but can reorder a user's list unexpectedly; production can show an update banner and let users apply updates or update only non-active rows. Full snapshot is expensive.

**Implementation:** `syncActions.ts`, `OpportunityTable.vue`, `OpportunityTableCaption.vue`.

**Follow-up:** How to build this in production? Shared API versioning plus server events (WebSocket/SSE), scoped invalidations, and explicit merge/refresh behavior.

### 17. Why Vitest and Vue Test Utils? What should be tested?

**Short answer:** Vitest matches the Vite toolchain; Vue Test Utils mounts components in jsdom. The most important tests protect state transitions and server-version rules rather than merely snapshots.

**Detailed explanation:** Current tests cover generator determinism/50k count, filtering/sorting, stage navigation, review order, selection, API versions/offline, optimistic save/retry, bulk cancellation, 10k stats, and a small App surface. Injected random/wait functions make API tests controllable.

**Alternatives / trade-offs:** Unit tests are fast but cannot prove browser layout, accessibility, or all composed flows. E2E tests with Playwright would complement them. 100% coverage is not a quality goal; deterministic high-risk behavior is.

**Implementation:** `src/**/*.spec.ts`, `vitest` in `vite.config.ts`.

**Follow-up:** What tests would you add first? Mixed per-row bulk results, failed undo retry, overlapping sync, teammate conflict through store, row keyboard selection/navigation, and reset during pending operation.

## I. Trade-offs and ownership

### 18. Hardest problem, confident decision, and what would you change?

**Short answer:** The hardest problem is preserving a trustworthy user view while writes can fail, arrive out of order, or conflict. I am most confident in separating client cache from fake server and using expected versions; I would improve undo recovery and deterministic bulk tests first.

**Detailed explanation:** A naive optimistic rollback can erase a newer teammate edit, while a naive bulk loop can block or lose successes. The implementation tracks per-row states, versions, and failed IDs. But undo currently drops recovery state after an unsuccessful attempt, and mixed outcome tests are insufficient.

**Alternative / trade-off:** Simplify to pessimistic saves and no collaboration simulation, but that would fail to demonstrate assignment reliability concerns. The current simulation provides value at the cost of more state complexity.

**Implementation:** `recordActions.ts`, `bulkActions.ts`, FakeApi tests/store tests.

**Follow-up:** What did you leave out? Durable backend, auth, activity history, real collaboration, server query/paging, request idempotency, and production observability.

### 19. What would you do with two more days? What if asked to add a feature live?

**Short answer:** First fix correctness/coverage gaps, especially undo failure retry, mixed partial outcomes, 20 owners, and sync conflict tests. For a new interview feature, clarify the user outcome, make a thin end-to-end change, and protect it with a focused test.

**Detailed explanation:** I would avoid broad refactoring until a failure case is reproducible. Then add deterministic API fixtures, store behavior, accessible UI state, and an implementation-map update. For a live request, state assumptions and identify which state/service boundary owns it.

**Alternative / trade-off:** Spend two days polishing visuals or adding charting. That may look good but does not address the highest correctness risks. UX polish still matters after core tests.

**Implementation:** `src/stores/opportunities/bulkActions.ts`, store/API specs, generator.

**Follow-up:** How do you handle scope? Deliver a thin vertical slice and call out deferred cases clearly.

## J. Senior-level follow-ups

Each answer begins with the simple meaning, then connects to current code and a production response.

### 20. Request ordering and idempotency

**Short answer:** Ordering is the order writes are accepted; idempotency means repeating the same logical request does not apply it twice. Same-record local saves are queued, but no idempotency key exists.

**Detailed explanation:** `queues` serialize one browser's writes for one ID; `revisions` protect displayed state; expected versions reject stale writes. If the server commits but the response times out, retry may apply the request again and increment version again. For stage assignment that might be value-idempotent, but side effects/audit entries may duplicate.

**Production choice/trade-off:** Send a stable operation key and have the server persist result by key. It costs storage and retention logic but makes retries safe. Add file: `recordActions.ts`, `fakeApi.ts`.

**Follow-up:** Is setting a stage inherently idempotent? The field value is, but notifications, logs, and downstream events may not be.

### 21. Stale cache, eventual consistency, and server pagination

**Short answer:** A stale cache is a client view older than server state; eventual consistency means clients may converge after delay rather than instantly. This demo permits stale state until manual sync or conflict detection.

**Detailed explanation:** Full `syncLatest()` fetches the latest snapshot. A real API should return query pages and versions, and event messages may invalidate a cached page. Offset pagination can shift when rows reorder; cursor pagination uses a stable sort key and continuation token, but still needs handling for updates that cross page boundaries.

**Trade-off/production approach:** Server-side filtering, sorting, cursor pagination, query cache, and aggregate endpoints reduce data/memory. Server paging changes “select all” semantics; use a query token plus exclusions. Current files: `syncActions.ts`, `opportunities.ts`, `opportunityFilters.ts`.

**Follow-up:** What consistency should a CRM offer? Strong version check on writes; read freshness can be eventual if the UI exposes last sync and conflict states.

### 22. Database transactions and optimistic concurrency

**Short answer:** A transaction groups server changes atomically; this frontend's 500-row fake batch is not a database transaction. Version checking is optimistic concurrency: reject a write if the observed version is stale.

**Detailed explanation:** The fake API maps each item and saves successes separately. A production endpoint could wrap an atomic small operation in a DB transaction, but 10k rows often need an asynchronous job with per-record outcomes rather than one long transaction.

**Trade-off:** Atomic rollback simplifies state but can make large jobs expensive and all-or-nothing; partial outcomes are operationally useful but need durable reporting. Current code: `FakeApi.bulkUpdateOpportunities`, `bulkActions.ts`.

**Follow-up:** How to avoid partial application if atomicity is required? Validate all rows and versions first, then transactionally update within database limits, or create a staged job with commit/compensation protocol.

### 23. Retry backoff, rate limits, and cancellation semantics

**Short answer:** Backoff spaces retries after transient failure; rate limiting protects the service; cancellation means stop future work, but may not reverse a request already committed. The current app has user-triggered retry, no backoff/rate-limit model, and batch-boundary cancel.

**Detailed explanation:** Repeated immediate retries can amplify outages. Production should classify transient/permanent errors, use capped exponential backoff with jitter, honor `Retry-After`, and limit per-user/job throughput. AbortController stops client waiting or transport when possible, but server commit state can be ambiguous.

**Trade-off:** Automatic retries improve recovery but can delay error visibility and duplicate effects without idempotency. Current code: `bulkActions.ts:cancelBulk`, `recordActions.ts:retry`.

**Follow-up:** Can an aborted HTTP request guarantee no save? No. Server-side job cancellation/state query is needed for certainty.

### 24. Memory pressure, profiling, and accessibility

**Short answer:** Virtualization saves DOM memory but records, cloned snapshots, filtered arrays, and selections still use heap. Profiling should measure those separately; accessibility must be tested with keyboard and assistive technology.

**Detailed explanation:** `shallowRef` and ID sets reduce reactive/lookup overhead; full sync and selected-ID materialization remain expensive. Use Chrome Performance/Memory tools, fixed seed, production build, repeated scenarios. Automated DOM tests cannot prove screen-reader experience.

**Trade-off / action:** More caching can reduce computation but retain memory and risk stale data. Current owner-only stage `aria-label` uses global count while visible count is owner-scoped, so fix and test it. `OpportunityTable.vue`, `PipelineOverview.vue`, `selection.ts`.

**Follow-up:** What accessibility checks? Keyboard-only operation, visible focus, labels, live save/conflict announcements, contrast, zoom/reflow, and screen-reader checks.

### 25. Observability and production readiness

**Short answer:** Observability means logs, metrics, and traces that explain what a real request did. This fake API has no telemetry, persistence, auth, idempotency, or cross-process collaboration.

**Detailed explanation:** Production should log operation and record IDs without leaking sensitive fields, measure latency/failure/conflict/bulk progress, correlate client requests with server traces, and alert on error rates. Also validate permissions for each row and bulk operation.

**Trade-off / current implementation:** Telemetry adds data handling and operational cost; it should be designed with privacy/retention. Current `fakeApi.ts` is intentionally local and deterministic enough for tests, not a service boundary with real security.

**Follow-up:** What would you instrument first? Save latency and outcomes by operation, conflict rate, bulk completion/failure counts, and client long tasks on the 50k workspace.

## Ten likely questions based on this repository

1. Why virtualize the table, and what work does virtualization **not** optimize?
2. Explain the stage-update path from row click through optimistic state to server reconciliation.
3. How does `expectedVersion` prevent a lost update?
4. Is teammate simulation real multi-user synchronization?
5. Why does sync fetch the entire dataset, and what would replace it in production?
6. How does bulk cancellation work if a request is already running?
7. What does partial success mean, and how are only failed records retried?
8. How is selection maintained when rows unmount due to virtualization?
9. What are the most important gaps in undo and bulk failure testing?
10. The assignment calls for 20 reps; why does the generator currently have seven, and how would you fix/verify it?

## Five facts to say accurately

- The fake API is an in-memory singleton; no real backend, auth, database, or cross-browser sync exists.
- Bulk writes are sequential batches of 500, not a concurrency pool of 500 HTTP requests.
- Only DOM rows are virtualized; search, filter, sort, metrics, and full sync still operate in memory.
- Random failures are configurable, but a chosen UI action is not guaranteed to fail deterministically.
- There is no measured performance benchmark; talk about implementation characteristics, not numeric speedup.
