# Design decisions

## Demo business domain

**Chosen:** FurniCraft is a fictional commercial furniture supplier selling office chairs, office desks, conference tables, storage cabinets, and reception desks in bulk to business customers.

**Why:** A concrete B2B scenario makes the sample companies, order quantities, Indian Rupee values, and pipeline labels easier to understand. The seeded 50,000-record dataset uses furniture products and units, with quantities and values scaled to each product category.

**Trade-off:** The opportunity data contract retains its existing quantity field for compatibility with stores and tests; the interface presents that quantity as furniture units.

## Table versus Kanban

**Chosen:** A dense opportunity table is the primary workflow, with a stage summary strip above it.

**Why:** The target dataset is 50,000 opportunities and a single stage can contain 10,000. Users need search, sorting, selection, bulk changes, and quick comparisons across many rows. A table supports those tasks and works with row virtualization.

**Considered:** A conventional Kanban board. It is familiar for moving individual deals and communicating stage progression.

**Why it was not primary:** Thousands of cards per column are costly to render and hard to scan. Implementing both full views would also duplicate selection and update behavior. The stage strip retains a simple visual overview and stage navigation.

**Trade-off:** Rows are less visual than deal cards, and there is no drag-and-drop. Stage changes remain explicit in the row selector.

## Quick stage movement

**Chosen:** Keep the stage dropdown and add previous/next arrow buttons beside it.

**Why:** The table stays compact and scannable, while the arrows reduce a common stage move to one click. Both controls use the same optimistic update path, so save status and error recovery stay consistent.

**Stage order:** Forward arrows follow New Lead → Contacted → Demo Done → Proposal Sent → Negotiation → Won. Lost is a terminal outcome rather than a step after Won, so it remains available in the dropdown. From Won or Lost, the previous arrow returns the deal to Negotiation; unavailable directions are disabled.

**Trade-off:** The arrows represent one defined workflow. The dropdown remains available for Lost and for any non-adjacent correction.

After a successful single-row update, the moved row is highlighted briefly and keyboard focus advances to the next opportunity from the pre-update order. For example, if row 5 moves to the top after a save, focus goes to the former row 6 rather than the new row 2. If that next opportunity is no longer visible, focus moves to the row at the updated opportunity's previous position. Failed saves keep focus in place so the user can inspect the error or retry.

## Optimistic versus pessimistic updates

**Chosen:** Optimistic stage changes with visible saving/saved/error states.

**Why:** A sales rep should see an immediate response to a common small edit. A failed request is reconciled from the authoritative API and surfaced with a retry control.

**Considered:** Waiting for the API before changing the row. That is simpler but makes a 300–1500 ms simulated request feel unresponsive.

**Trade-off:** The client temporarily displays a value that may not be accepted. The status and error recovery make that temporary state explicit.

## Manual teammate synchronization

**Chosen:** Teammate edits update the simulated server but remain out of the visible table until the user selects **Sync updates**. The active row stays highlighted and can be restored with **Go to active row** after the refreshed data reorders.

**Why:** Applying each remote edit immediately can reorder an all-owner table while someone is reviewing it. A deliberate refresh makes the reordering predictable and gives the user a stable review anchor.

**Trade-off:** The visible table can be stale until the user syncs. Local edits remain optimistic and same-record requests are serialized in the client; version checks reject a write if that same record changed after the expected version was read.

## Same-record concurrency

**Chosen:** Every opportunity carries a server version. Single and bulk writes include the version they expect; stale writes return the latest record and are shown as conflicts.

**Why:** Concurrent edits to different rows are handled by manual table synchronization. Version checks protect the separate case where two users edit the same opportunity, preventing either write from silently replacing a newer change.

**Trade-off:** A conflict needs review and retry. The local per-record queue also serializes rapid edits from one browser, while a revision token prevents older responses from replacing newer local intent.

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

**Chosen:** Send 500-record batches sequentially; the fake API applies per-record failures within each request.

**Why:** A batch delay is paid once, and the client never starts an unbounded number of requests. Per-record results keep successful updates when a few records fail.

**Considered:** One HTTP-like request per record with unbounded concurrency. That would create unnecessary simulated load and makes large selections slow; unbounded fan-out also obscures failure recovery.

**Trade-off:** A batch is not interruptible after dispatch. The UI cancellation control stops before the next batch and reconciles undispatched records; a real API should define server-side cancellation semantics.

## Undo safety

**Chosen:** Capture prior stages and post-bulk versions. Undo only writes a record if its version still matches that post-bulk version.

**Why:** Users can reverse a bulk stage change without repeating the selection workflow, while avoiding overwriting a teammate's later edit.

**Considered:** Blindly restoring all prior stages. That can erase an edit made after the bulk operation.

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
