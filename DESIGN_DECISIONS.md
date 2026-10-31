# Design decisions

## Table versus Kanban

**Chosen:** A dense opportunity table is the primary workflow, with a stage summary strip above it.

**Why:** The target dataset is 50,000 opportunities and a single stage can contain 10,000. Users need search, sorting, selection, bulk changes, and quick comparisons across many rows. A table supports those tasks and works with row virtualization.

**Considered:** A conventional Kanban board. It is familiar for moving individual deals and communicating stage progression.

**Why it was not primary:** Thousands of cards per column are costly to render and hard to scan. Implementing both full views would also duplicate selection and update behavior. The stage strip retains a simple visual overview and stage navigation.

**Trade-off:** Rows are less visual than deal cards, and there is no drag-and-drop. Stage changes remain explicit in the row selector.

## Optimistic versus pessimistic updates

**Chosen:** Optimistic stage changes with visible saving/saved/error states.

**Why:** A sales rep should see an immediate response to a common small edit. A failed request is reconciled from the authoritative API and surfaced with a retry control.

**Considered:** Waiting for the API before changing the row. That is simpler but makes a 300–1500 ms simulated request feel unresponsive.

**Trade-off:** The client temporarily displays a value that may not be accepted. The status and error recovery make that temporary state explicit.

## Version-based concurrency

**Chosen:** Every server record has an integer version; updates include the version they expect.

**Why:** It is enough to reject stale writes and return current server data without adding locks or a synchronization protocol. Per-record revisions prevent older responses from overwriting a newer local operation.

**Considered:** Last-write-wins and distributed locking. Last-write-wins can silently erase a teammate's work; locks are beyond the needs of this single frontend simulation.

**Trade-off:** A conflict needs a user retry or discard decision. The fake service only simulates teammates sharing this app instance; it is not cross-browser synchronization.

## TanStack Vue Virtual

**Chosen:** `@tanstack/vue-virtual` with a fixed 56 px row estimate and eight rows of overscan.

**Why:** The DOM contains only viewport rows while preserving a familiar scrollable table-like view. The library is explicitly required and avoids maintaining custom windowing math.

**Considered:** Rendering every row or writing a custom virtualizer. Rendering 50,000 nodes is unnecessary; custom windowing would duplicate tested library behavior.

**Trade-off:** Fixed-height rows constrain content wrapping. The current design truncates long labels and keeps row height predictable.

## Selection model

**Chosen:** Store individual selected IDs, or an all-matching snapshot of IDs plus excluded IDs.

**Why:** The model works independently of mounted virtual rows, and selecting all results is different from selecting the viewport. When filters change, a select-all snapshot retains the exact IDs selected at that moment; subsequent filter changes do not alter that selection.

**Considered:** Selecting only rendered rows or storing entire opportunity objects. The first surprises users; the second duplicates large records in state.

**Trade-off:** A snapshot of 50,000 string IDs uses memory. It is still smaller and easier to reason about than storing record objects and is bounded by the in-memory dataset.

## Bulk batching and partial failures

**Chosen:** Send 500-record batches sequentially; the fake API applies per-record version checks and failures within each request.

**Why:** A batch delay is paid once, and the client never starts an unbounded number of requests. Per-record results keep successful updates when a few records fail.

**Considered:** One HTTP-like request per record with unbounded concurrency. That would create unnecessary simulated load and makes large selections slow; unbounded fan-out also obscures failure recovery.

**Trade-off:** A batch is not interruptible after dispatch. The UI cancellation control stops before the next batch and reconciles undispatched records; a real API should define server-side cancellation semantics.

## Undo safety

**Chosen:** Capture prior stages and use the latest client version for each undo request. The server rejects stale versions; skipped records are counted.

**Why:** An undo must not erase an edit made by a teammate after the bulk operation.

**Considered:** Blindly restoring prior values. That can overwrite newer work.

**Trade-off:** Undo can be partial. The user sees restored and skipped counts.

## Pinia store organization

**Chosen:** Three stores: opportunities, selection, and simulation.

**Why:** Each store has one clear responsibility while business logic remains testable outside the table component.

**Considered:** One giant store or many tiny stores. One store mixes UI selection and simulation settings; many stores add navigation cost without useful boundaries.

**Trade-off:** The opportunity store coordinates the selection and simulation stores for bulk and teammate actions. That coupling is narrow and visible.

## Testing strategy

**Chosen:** Vitest unit tests for pure filtering, fake API version rules, and selection semantics, with TypeScript and production build checks.

**Why:** These are the highest-risk logic paths and can run deterministically without waiting on random delays.

**Considered:** Broad screenshot or browser test coverage first. It would be useful later, but focused unit tests give faster feedback on the concurrency and selection rules.

**Trade-off:** Unit tests do not prove every browser interaction or visual detail. The final submission should add end-to-end tests if a browser test runner is introduced.
