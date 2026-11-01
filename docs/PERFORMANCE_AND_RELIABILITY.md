# Performance and Reliable Saves, Explained Simply

The app is designed to demonstrate what it takes to work with 50,000 opportunities and unreliable saves. It has not been benchmarked in a browser, so this document explains what the code does without claiming a measured speed improvement. The **fake API** is local code that acts like a server for this demo: the screen asks it to load or save records, and it can add delays or reject saves.

## 1. Keeping a 50,000-row table usable

### The browser does not build every row

If a page tried to show 50,000 rows at once, it would need to create a huge number of HTML elements: rows, text, buttons, checkboxes, dropdowns, and status labels. The browser would then have to lay out and paint all of them, even though the user can see only a small part of the list.

`src/components/OpportunityTable.vue` uses **virtual scrolling**. In plain terms, it builds the rows around the current scroll position and a small buffer of nearby rows. As the user scrolls, it replaces those rows with the next ones. The table estimates a row at 56 pixels high and uses `overscan: 8`, which keeps nearby rows ready as the user scrolls. Each opportunity’s stable ID helps the screen recognize the same deal if its position changes.

This reduces the number of row elements on screen. It does **not** mean the app has loaded only a few records: all 50,000 are still in memory.

### What still takes work

Different kinds of performance have different costs:

| Kind of work | What this app does | What can still be slow |
| --- | --- | --- |
| Drawing the table | Shows only nearby rows | Each visible row still has controls and styling. |
| Searching and filtering | Checks the in-memory records in the browser | A search can check all 50,000 records every time the text changes. There is no pause before searching, so typing another character starts another check. |
| Sorting | Sorts a copy of the matching records | A large matching set still takes time to order. |
| Summaries | Counts stages and adds deal values from loaded records | A data change may require another pass over records. |
| Network behavior | Simulates delay and failures | There is no real bandwidth, backend load, or server latency measurement. |
| Memory | Uses a shallow record list and ID sets | Both the client and fake server keep data; full syncs and “select all matching” need extra memory too. |

The store keeps the large record list in a shallow Vue reference. In plain terms, Vue watches when the list changes without adding its tracking layer to every field of all 50,000 records. Filtering and sorting results are reused until their inputs change. Sorting works on a copy so it does not rearrange the original record list.

### Why not use pages?

Pages would also reduce the number of visible rows. However, moving between pages interrupts continuous review and makes it harder to select records across the entire filtered result. Virtual scrolling keeps one long list while showing only a small part of it.

For a production system, a backend would likely send one page of results at a time, then provide a way to ask for the next page. Virtual scrolling limits what the browser draws; it does not remove the need to fetch and hold the data.

### Selection while scrolling

The table stores selected opportunity IDs in `src/stores/selection.ts`, not references to visible row elements. The IDs are kept in a `Set`, a collection that does not add the same ID twice. So if a user checks a deal, scrolls away, and its row disappears from the page, that deal stays selected.

The header checkbox selects rows currently rendered by the virtual table. **Select all matching** is the separate control for the full filtered result. It remembers the matching IDs at the moment the user clicks it, so later scrolling does not change the selection.

This is practical for 50,000 sample records, but a set containing tens of millions of IDs would consume too much browser memory. A production service could represent the selection as a saved filter or server-side token.

## 2. Bulk updates and why they use batches

The app sends at most 500 opportunities in one bulk request, waits for that request to finish, then sends the next group. Each response is applied to the local table in a group rather than updating each row separately.

For example:

- 500 selected records use one request.
- 1,000 use two requests.
- 10,000 use 20 requests.

This keeps each request a reasonable size and gives the interface places to update progress, report failures, and check whether the user has canceled.

### Why not send everything at once?

Sending 10,000 or 50,000 records in one enormous request could exceed a service’s request-size limit or take too long to process. Sending thousands of requests at the same time could overload the browser or server. Sending one record per request, one after another, would add the network delay to every record.

The current implementation uses sequential groups of 500. That means it is not a pool of parallel workers. With a simulated 300–1500 ms delay per group, 10,000 records pass through 20 delayed requests.

### Why the screen froze in an earlier version

The earlier version already grouped the network work. The responsiveness problem was in what the browser did with the results: it updated or restored records one at a time. Repeating local lookup and reactive notification thousands of times kept the browser busy, so the screen could not repaint or respond promptly when the user clicked Cancel.

The current version applies a successful response as a group. When Cancel is pressed, it also restores records that were never sent in groups of up to 500 and yields to the browser between groups. That gives the browser a chance to draw the screen and receive input. This is a design improvement, not a measured benchmark result.

The implementation is in `src/stores/opportunities/bulkActions.ts`; `src/services/fakeApi.ts` simulates one delay for each request and returns individual results for the records in that request.

## 3. What happens when a save fails

### Updating one deal

Suppose a representative changes an opportunity from **New Lead** to **Contacted**.

1. The table shows **Contacted** immediately and marks the row as saving. This is called an **optimistic update**: show the expected result first, then check whether it saved.
2. If the fake API accepts the change, it returns the saved record and a newer version number. The row becomes saved.
3. If the save fails, the app tries to read the latest server record and puts that back in the table. The row shows **Save failed**, and Retry is available.
4. If someone else saved a newer version, the row shows **Update conflict** and displays the latest record the server returned.

The user sees the difference between a save still in progress, an ordinary error, and a conflict. The app does not leave a failed optimistic value looking like it was saved.

### Avoiding an older response replacing a newer action

If a user changes one deal several times quickly, requests could finish in a different order from the clicks. The store uses a local revision number for each deal and queues saves to that same deal. A response from an older local action is not allowed to replace the result of a newer action.

This protects the browser’s display from stale responses. It is separate from the server version check, which protects one user from overwriting a teammate.

### Retrying

Retry is a user action, not an automatic loop. It reads the latest server record first. If the requested stage is already there, the row is marked saved. Otherwise the app tries the original stage request using the current version.

The app does not currently use exponential retry delays, an offline queue, or a request idempotency key. An idempotency key is a unique request label a production server can use to recognize a repeated submission as the same operation.

### Offline-mode limitation

The simulation panel can turn the fake API offline. Calls that use the simulated request path wait and then fail. However, `fakeApi.getOpportunity()` is a local read that skips both the delay and offline check. Some recovery reads can therefore succeed while the interface says Offline. A real API would have to handle those reads as network requests too.

## 4. How version checks protect a teammate’s edit

Each opportunity has a version number. When the app sends a save, it includes the version it last saw. The fake server accepts the save only if that version still matches.

For example:

1. Aisha and another representative both see **New Lead, version 1**.
2. Aisha saves **Contacted** using version 1. The server accepts it and makes the record **Contacted, version 2**.
3. The other representative tries to save **Lost** using version 1.
4. The server sees that version 1 is old. It rejects the save and returns version 2, so Aisha’s edit is not silently overwritten.

This is called **optimistic concurrency control**. In simple terms, users can work without locking each other out, and the server checks for a newer change when someone saves.

The user sees **Update conflict**, can sync the latest data, review the row, and press Retry if the original requested stage is still what they want. Retry replays that saved stage request. There is no merge screen for combining two different edits.

The demo’s fake server exists in one JavaScript process. It cannot coordinate actual separate users or devices. In production, the backend would check and save the version together in the database, then return a clear conflict response when the version is old.

## 5. Bulk failures, retry, cancel, and undo

Every record in a batch can succeed or fail independently. If 498 succeed and two fail, the 498 stay saved. The failure panel keeps the two failed IDs and retries only those records.

If the user presses Cancel during a request:

1. The request already sent is allowed to finish.
2. The app does not send the next group.
3. It reads the latest server data for records that were never sent and restores those rows in groups.

This means Cancel is “stop future work,” not “undo the request already in progress.” A production bulk API could provide a job ID and define a server-side cancellation point, but even then it must report records already committed.

Undo is also best effort. The app remembers the old stage and the version created by the bulk save. It only restores a record if that version is still current. This avoids overwriting a teammate’s newer change.

There is a known limitation: if undo itself has failures, the current app reports the result but clears its saved undo information, so the user cannot retry only the failed undo records. The undo does not succeed or fail as one all-or-nothing action.

## 6. Teammate updates and manual sync

The simulation changes the fake server’s copy of the active opportunity and leaves the visible client copy alone. A pending update indicator appears. The user presses **Sync updates** when ready; this fetches a fresh copy of all 50,000 records.

This avoids surprise reordering while the user works, but it is a simplified demo. It does not keep a history of who changed what, and it does not send live updates between browsers. A production service should return only changes since the user’s last sync and identify the teammate and update time.

## 7. What to measure before making a speed claim

No browser benchmark is included, so do not claim a specific speedup. To measure the current app fairly:

1. Use the same computer, browser, viewport, and production build for every run.
2. Load the fixed 50,000-record dataset and wait until it settles.
3. Measure typing in search, changing filters, sorting, scrolling, syncing, selecting all, and updating 10,000 records.
4. Record how many row elements are mounted, how long the browser spends scripting/layout/painting, and how memory changes after selection and sync.
5. Repeat each action several times and report the median and range.

Keep these separate: virtualization affects how much the browser draws; local search affects JavaScript work; network latency affects how long saves wait; and holding server/client copies affects memory.

## Main files

- Virtual rows and keyboard movement: `src/components/OpportunityTable.vue`
- Record state and local updates: `src/stores/opportunities.ts`
- Single save and retry: `src/stores/opportunities/recordActions.ts`
- Bulk work and cancellation: `src/stores/opportunities/bulkActions.ts`
- Fake server, delay, failures, and version check: `src/services/fakeApi.ts`
- Filtering and sorting: `src/utils/opportunityFilters.ts`
- ID-based selection: `src/stores/selection.ts`
