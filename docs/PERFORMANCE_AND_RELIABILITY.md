# Performance and reliability

This document describes measured facts only where measurements exist. The repository has tests for dataset size and large bulk scenarios, but no browser performance benchmark or profiling report. Do not quote an unmeasured speedup in an interview.

## Performance model

### Rendering

Rendering 50,000 table rows would create tens of thousands of row elements plus cells, selects, buttons, text, and event/accessibility nodes. The browser must allocate nodes and repeatedly calculate style, layout, paint, and interaction hit targets. `src/components/OpportunityTable.vue` uses TanStack Vue Virtual with `estimateSize: 56` and `overscan: 8`; it mounts virtual rows around the viewport instead of all 50,000. The exact number depends on viewport height and row estimate; it is approximately viewport rows plus eight extra rows, not a fixed total. Stable opportunity IDs are the virtualizer keys.

The virtualizer addresses **DOM/rendering cost**, not every cost. Filter and sort still run in JavaScript on the full loaded array. The generated dataset and client cache also remain in memory. No measured before/after benchmark exists.

### JavaScript computation

`visibleRecords` filters then sorts in a computed property. For N=50,000, a filter/search is O(N); sorting k matches is O(k log k). The filter and sort utility avoids mutating the original data. Metrics such as total value and attention count scan the records; stage counts scan once. Vue computed values cache results until their reactive dependencies change, but a data/filter change can trigger these passes. Search updates immediately; there is no debounce. Owner-stage metrics in `PipelineOverview.vue` build counts from records.

### Memory

Memory includes generated authoritative FakeApi records, client record copies, response snapshots/clones, arrays from filtering/sorting, maps and reactive save state, and ID sets. `selectAllMatching` snapshots IDs, potentially 50,000 strings. Sync fetches and clones a full snapshot and rebuilds client maps. `records` is a `shallowRef` to avoid deeply proxying every nested record; individual records are flat. This reduces reactive proxy work but does not make data storage free.

### Network/request simulation

Individual writes wait 300–1500 ms by default. Bulk writes send sequential 500-record batches, each with one simulated delay. A 500-record request is one fake API call, not 500 parallel HTTP requests. For 1,000 rows there are two delayed batches; for 10,000, 20; for 50,000, 100. This trades total duration for bounded request/payload size and observable cancellation checkpoints. `getOpportunity()` is immediate and bypasses offline/delay simulation, which differs from a real network.

### Performance dimensions are different

| Dimension | Current approach | What still costs |
|---|---|---|
| Rendering | Virtual row window, stable keys, shallow records | Row measurement, component work for mounted rows, layout for table |
| JavaScript | Computed filter/sort, Maps/Sets, bulk array installation in batches | O(N) filtering/metrics, O(k log k) sorting, some O(N) array passes |
| Network | Fake latency/failures and batch API shape | No real bandwidth/server load; full snapshot sync; serial batch delay |
| Memory | One client array plus maps and ID sets; no 50k DOM rows | Server/client data copies, clones, filtered/sorted arrays, selection snapshots |

## How to measure reproducibly

No performance result is claimed until measured. For a useful local comparison:

1. Use a production build and the same machine/browser/viewport; record browser and hardware.
2. Load 50,000 records with fixed seed, wait for settled rendering, record Chrome Performance and Memory traces.
3. Measure initial scripting/rendering, typing into search, clearing filters, changing sort, changing one stage, syncing a full snapshot, selecting all matches, and a 10,000-row bulk update.
4. Record mounted `<tr>` count, long tasks, scripting/layout time, heap before/after selection and sync, and operation duration. Repeat several times and report median plus range.
5. Compare identical interactions with virtualization disabled only in a temporary experiment; do not ship that change as part of this task.
6. Keep network simulation settings fixed. For real production data, measure server query latency and payload size separately from browser work.

## Network reliability lifecycle

`SaveState` distinguishes saved, saving, error, and conflict. Individual stage updates are optimistic: the displayed stage changes immediately; a successful API response replaces it with authoritative data. Ordinary failure attempts to read current server data and restore it; version conflict installs the authoritative record included in `ApiError`, and asks for review/retry. Per-ID `revisions` ensure an old local response does not replace a newer local intent. `queues` serialize same-record local writes.

Bulk operations similarly show optimistic states and progress. Each record has an independent outcome. Successful records stay saved; failures retain an error and retry intent. Retry sends failed IDs only. Sync is explicit and fetches a full snapshot; teammate changes do not automatically reorder the visible table.

Offline mode causes simulated requests that use `simulate()` to wait and fail. Retry is user-driven; there is no automatic exponential backoff, offline queue, background service worker, or connectivity listener. Notably, `getOpportunity()` bypasses offline simulation, so some reconciliation/retry reads succeed while the UI is “offline”; this is a deliberate simplification/behavioral inconsistency to disclose.

## Version-based concurrency

Suppose the authoritative record is **New Lead, version 1**.

1. User A submits **Contacted** with `expectedVersion: 1`. The server matches version 1, saves Contacted, and increments to version 2.
2. User B's stale page submits **Lost** with `expectedVersion: 1`. The server sees current version 2, rejects the write, and returns the current record as a conflict.
3. User B can sync/review the newer record and intentionally retry. The stale write does not silently erase User A's stage.

This is optimistic concurrency control: writers proceed without taking a lock and the server rejects a write based on an old version. The fake API checks whole-record versions. There is no cross-browser server or shared database here, so two real tabs/devices do not actually share this singleton. Production would enforce the version atomically in a database/API (for example conditional update/ETag), return HTTP 409/412, and broadcast changes through a real collaboration channel if required.

## Bulk behavior and examples

The bulk action snapshots target IDs and old stage/version, optimistically updates local rows, then loops through batches of 500 serially. It does not issue hundreds of concurrent requests. Concurrency limiting avoids a thundering herd and too many open requests. Fully sequential one-record requests would avoid bursts but pay one 300–1500 ms delay for every record. One unbounded giant request risks payload/time limits. A batch endpoint is a middle ground.

At 500 records, one request returns up to 500 independent results. At 1,000 records there are two requests, and a 500-row progress jump occurs per response. A record conflict or random failure does not undo neighbors in the same batch. Failed IDs are retained and retried alone. Cancel stops dispatching subsequent batches, lets the active batch settle, and reconciles undispatched rows in chunks. It cannot guarantee that a server-side operation was aborted because no request cancellation or transaction is simulated.

Potential production improvements: asynchronous bulk job with operation ID, server-side idempotency, fine-grained progress polling/SSE, durable per-record outcomes, explicit retry/backoff, cancellation endpoint semantics, and server-side selection/query tokens for “all matching.”
