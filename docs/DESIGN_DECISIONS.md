# Design Decisions: Why the App Works This Way

This document explains the choices behind the FurniCraft Sales Pipeline in everyday language. The examples use its sample office-furniture deals. The app is a frontend prototype, so its “server” is a local simulation rather than a production service.

## How the workspace looks and feels

### 1. A table with a visual stage strip

**What we chose:** A searchable table is the main workspace. A colored stage strip above it shows the pipeline and filters the table when clicked. Each row also has arrows and a stage dropdown.

**Why:** A sales representative may need to compare customer, product, quantity, deal value, owner, stage, and activity across many deals. A table puts those details beside one another. The stage strip gives a quick visual view of the pipeline, and clicking **New Lead** shows only those records in the table. This combines a visual stage overview with the detailed scanning and selection of a table.

**Other options:** A full Kanban board would show one column per stage. It can be easy to understand with a short list, but thousands of cards across seven columns would be difficult to search and compare. A separate table and board mode would mean more screens and duplicated behavior.

**Cost and next step:** The table is denser than a board. In a real product, I would watch salespeople use both views and add a board only if it solves a real workflow need.

**In the code:** `src/components/PipelineOverview.vue`, `OpportunityTable.vue`, and `OpportunityTableRow.vue`.

### 2. One focused workspace instead of many pages

**What we chose:** Summary, filters, bulk actions, and the opportunity table are all on one page.

**Why:** The common task is to find a deal, review it, and take action. Keeping the controls together makes that path easier to follow and avoids repeatedly navigating between a dashboard and a separate list.

**Other options:** Separate dashboard, search, and bulk-management pages could make each page simpler. They would also make a user switch contexts for work that often happens together.

**Cost and next step:** A single page can feel crowded. The component layout separates the sections, but a production version should test the page at different screen sizes and let users hide less-used panels if needed.

**In the code:** `src/App.vue` assembles the page from smaller components.

### 3. Summary cards and stage percentages

**What we chose:** Show total opportunities and value, won and lost counts, inactive deals, plus a count and percentage for each stage.

**Why:** A manager can quickly see the shape of the pipeline before opening individual deals. For example, a large number of opportunities at **Proposal Sent** may tell the team where follow-up is needed.

**Other options:** A chart dashboard could show more measures, but the assignment’s primary task is updating records. A chart would take extra space and would not replace the table.

**Cost and next step:** These totals are calculated from the records in the browser, so they are not official company reporting. A production system should calculate them from the company’s saved data and agree on the rules with sales leadership.

**In the code:** `src/components/PipelineOverview.vue` calculates and displays the summary and stage strip.

### 4. Search, filters, and sorting

**What we chose:** Search company and product names; filter by stage, owner, value range, and 30-day inactivity; sort by customer, value, last activity, or update date.

**Why:** A representative can answer practical questions such as “show me Aisha’s inactive deals” or “which orders have the highest value?” without scrolling through all 50,000 opportunities.

**Other options:** Searching only on the server would be better for a much larger, remote dataset. It needs a backend and query design that this assignment does not have.

**Cost and next step:** Search checks the loaded records as the user types; there is no pause before a search starts, so each keystroke can check the list again. A production version should move search and filters to a backend and should explain confusing ranges such as a minimum value higher than the maximum.

**In the code:** `src/components/OpportunityFilterToolbar.vue` collects the choices; `src/utils/opportunityFilters.ts` applies them.

### 5. Arrows and dropdown instead of drag-and-drop

**What we chose:** Each row has a previous-stage arrow, a next-stage arrow, and a dropdown for direct stage selection. The stage strip can also filter the table to a stage.

**Why:** Moving a deal from **New Lead** to **Contacted** is a frequent action, so one arrow click is quicker than opening a dropdown. The dropdown still handles a direct choice such as **Lost**. Buttons and a dropdown also work better with a keyboard and a dense table than dragging a row between columns.

**Other options:** Drag-and-drop can feel natural on a Kanban board, but is difficult to use in a virtual table and is not convenient for every keyboard or touch user. A dropdown alone is accessible but takes more actions for every adjacent move.

**Cost and next step:** The extra controls take room and need clear labels. The app also treats Lost as an outcome, not as the next step after Won. A real product should confirm the stage path with the sales team.

**In the code:** `src/utils/stageNavigation.ts` defines arrow movement; `src/components/OpportunityTableRow.vue` renders the controls.

### 6. Keep the owner visible and searchable

**What we chose:** Show the owner in every row and provide a searchable owner filter. When an owner is selected, show a switch for that person’s summary numbers.

**Why:** The person responsible for the next follow-up is important context. A manager can also quickly inspect one representative’s workload without losing the shared pipeline view.

**Other options:** Owner details could live only on a separate deal page. That would hide useful information when comparing rows. A plain long dropdown is harder to use as the team grows.

**Cost and next step:** The current data has seven generated owners, although the assignment describes a 20-person team. A production application should use real team membership and permissions rather than a hard-coded list.

**In the code:** `src/components/OpportunityTableRow.vue`, `OpportunityFilterToolbar.vue`, and `PipelineOverview.vue`; sample names are in `src/services/opportunityGenerator.ts`.

### 7. Show when the table is behind teammate changes

**What we chose:** Teammate changes are marked as waiting. The user presses **Sync updates** to load them. The active row stays identified, and **Go to active row** can return to it.

**Why:** If every remote change immediately reordered the table, a representative could lose the deal they were reviewing. An explicit sync lets the user choose when to refresh.

**Other options:** Polling or live updates with WebSockets can keep real users current. This app has no shared backend or second user, so those systems cannot be tested here.

**Cost and next step:** Sync fetches a new copy of all 50,000 records, which is simple but expensive. A real app should fetch only changed records and show who changed them and when.

**In the code:** `src/stores/opportunities/syncActions.ts` and the table caption in `src/components/OpportunityTableCaption.vue`.

### 8. Put failure controls in a simulation panel

**What we chose:** A panel below the table controls offline mode, request delay, random save failures, and a same-deal teammate edit.

**Why:** It lets a reviewer reproduce a failed save or conflict instead of hoping one happens by chance. Keeping it below the main work area leaves the day-to-day table as the focus.

**Other options:** A separate demo page would make the controls more prominent but disconnect the scenario from the deal being edited. Random failures alone are hard to demonstrate reliably.

**Cost and next step:** These settings exist for the assignment and are not normal CRM controls. A real product would not let a user set the service failure rate.

**In the code:** `src/components/SimulationPanel.vue` and `src/stores/simulation.ts`.

## How the code is organized

### 9. Vue 3, TypeScript, and Pinia

**What we chose:** Vue 3 builds the interface from components, using its Composition API and `<script setup>` style. TypeScript describes opportunities and stages. Pinia is the shared place for data used by the table, filters, metrics, and bulk controls.

**Why:** Composition API lets related screen data and functions live together. A stage such as **Negotiation** should be one of the known values, not a spelling that changes between components. Shared records also need one owner so that a table row and the summary do not keep separate, conflicting copies.

**Other options:** Vue’s Options API is also a good choice, but groups code by option type rather than by feature. Plain JavaScript is quicker to start but cannot catch as many mismatched field names or stage values. Component-only state is fine for a small widget but becomes awkward when several parts of the page need the same records.

**Cost and next step:** TypeScript checks code before it runs; it does not validate data received from a real server. Production API responses should also be checked at runtime.

**In the code:** `src/types/opportunity.ts`, `src/App.vue`, and the Pinia stores in `src/stores/`.

### 10. Split shared state by its job

**What we chose:** Opportunity records, selected IDs, and simulation settings live in separate Pinia stores. Individual record saves, synchronization, and bulk actions are also split into smaller action files behind the opportunity store.

**Why:** A selected checkbox is temporary screen state; it is not part of the customer deal. Simulation settings are also different from sales data. Separating them makes each part easier to follow and test.

**Other options:** One large store could hold everything, but it had become hard to read. Keeping everything inside each component would duplicate save and selection rules.

**Cost and next step:** There are more files and a developer must follow the action from the screen into the store module. The opportunity store acts as the shared entry point to keep that path consistent.

**In the code:** `src/stores/opportunities.ts`, `src/stores/selection.ts`, `src/stores/simulation.ts`, and `src/stores/opportunities/`.

### 11. Keep simulated network behavior out of the screen components

**What we chose:** Components send the user’s intent to a store action; the store calls `fakeApi` for reads and writes.

**Why:** The row component should say “move this deal to Contacted.” It should not need to know how to wait, simulate an error, check versions, or recover the server record.

**Other options:** Put the API calls directly in each row. That would duplicate save rules and make errors harder to handle consistently. A large production networking framework would be unnecessary for one fake service.

**Cost and next step:** `fakeApi` is a shared singleton, which is convenient for this prototype but can make tests share state unless it is reset. A real app should inject a client connected to a backend.

**In the code:** `src/services/fakeApi.ts` and the action files under `src/stores/opportunities/`.

## How the app handles 50,000 records

### 12. Render only the rows around the user

**What we chose:** Use TanStack Vue Virtual to render the rows near the current scroll position, plus a small buffer above and below.

**Why:** Building every cell, button, checkbox, and dropdown for 50,000 rows would burden the browser even though almost all rows are off screen.

**Other options:** Showing all rows would be wasteful. Pagination would reduce the visible rows too, but it interrupts continuous scrolling and makes “select all matching” more complicated. TanStack Table helps build table behavior, but it does not replace the row virtualizer used here.

**Cost and next step:** The virtual table assumes rows are about 56 pixels high. Its `overscan: 8` setting keeps a small buffer of nearby rows ready as the user scrolls. Rows outside that window are removed from the page, so focus has to be restored when needed. Virtual scrolling reduces page elements, not the number of records in memory. No performance benchmark has been run.

**In the code:** `src/components/OpportunityTable.vue` uses `@tanstack/vue-virtual` with stable opportunity IDs and `overscan: 8`.

The stable ID also helps Vue recognize the same opportunity after sorting moves it to a new position. It does not mistake a different deal for the old row just because both occupied the same screen position.

### 13. Use record IDs for selection

**What we chose:** Store selected opportunity IDs in JavaScript `Set`s, collections that keep each ID only once. “Select all matching” remembers the IDs that matched when the user clicked and tracks any rows they later uncheck.

**Why:** Virtualized rows disappear from the page when the user scrolls away. If selection belonged to the row element, it would disappear too. IDs let a user select a deal and keep it selected even when its row is not currently mounted.

**Other options:** Store references to visible row components or store only the current page’s checkbox states. Those approaches cannot safely represent all filtered results.

**Cost and next step:** Selecting all 50,000 records still stores many IDs. For a much larger remote dataset, the server could remember a query or selection token instead.

**In the code:** `src/stores/selection.ts` and `src/components/BulkActionBar.vue`.

### 14. Change bulk records in batches of 500

**What we chose:** Send up to 500 selected records in one request, wait for the result, then send the next group. The app applies each response to the table together.

**Why:** One request per opportunity would mean many waits. Sending 10,000 records in one request could make the request too large. Groups of 500 give the app manageable checkpoints for progress, failure reporting, and cancellation.

**Other options:** Sending every record at once risks oversized requests. Sending each record as a separate request at the same time can overload a service. Sending them one at a time is simple, but very slow with network delay.

**Cost and next step:** Groups run one after another, so a 10,000-record update takes 20 simulated request delays. This is a simple batch loop, not a pool of parallel workers. A production system would likely create a server-side bulk job and report its progress.

**In the code:** `src/stores/opportunities/bulkActions.ts` and `src/services/fakeApi.ts`.

### 15. Keep filtering simple and predictable

**What we chose:** Filtering and sorting are computed from the current in-memory records. Sorting makes a copy instead of rearranging the source records.

**Why:** The dataset is local to the demo, so the browser can apply the user’s filters directly. Keeping the original list order unchanged helps selection and review position stay understandable.

**Other options:** Re-fetch from the server after each filter. There is no real server to query in this project. More complex indexing could speed up some searches but would add state that must be kept in sync.

**Cost and next step:** Every search/filter change may examine up to 50,000 records. There is no typing pause, so a search can run for every character entered. A production version should query smaller pages from a backend.

**In the code:** `src/stores/opportunities.ts` and `src/utils/opportunityFilters.ts`.

For a single save, the store replaces that opportunity in the local list instead of downloading all 50,000 records again. It still looks through the array to find the row’s position. For a bulk response, it collects the changed rows and replaces the list in one pass. That avoids notifying the screen separately for every row, though the pass still checks the full local list once per batch.

## How the app tries to keep saves safe

### 16. Change the stage only after the save succeeds

**What we chose:** Keep the last saved stage visible while a save is pending. Show **saving** on the row, then change the stage when the service confirms it.

**Why:** The person reviewing the pipeline always sees a stage that was actually saved. The saving label confirms their action was received, without showing a change that might fail.

**Other options:** Changing the row before the service replies can feel faster, but it needs a rollback if the save fails and can briefly show a stage the server never accepted. This app favors showing the last confirmed value.

**Cost and next step:** The user waits to see the stage change for the 300–1500 ms request delay. During that time the stage controls are disabled for the row, while the saving state makes it clear that work is underway. If the save fails, the old stage stays visible and the row offers Retry.

**In the code:** `changeStage` in `src/stores/opportunities/recordActions.ts`.

### 17. Check versions to catch a teammate’s newer save

**What we chose:** Every record has a version. A save says which version it was based on. The fake server accepts it only if that version is still current.

**Example:** Aisha and another representative both open an opportunity at version 1. Aisha saves **Contacted**, so the server changes it to version 2. The other representative then tries to save **Lost** using version 1. The server rejects that stale request and returns version 2, rather than silently replacing Aisha’s update.

**Other options:** “Last write wins” would accept whichever request arrives last and could erase an earlier change. A lock would prevent someone else editing, but locks need ownership and expiry rules. Version checks allow normal editing and catch a conflict at save time.

**Cost and next step:** The user has to review and retry. This app checks the version for the whole record, even if two people changed different fields. A production backend must check the version as part of the same database save; this demo only simulates it in one process.

**In the code:** `expectedVersion` in `src/types/opportunity.ts`, `updateOpportunity` in `src/services/fakeApi.ts`, and `changeStage` in `src/stores/opportunities/recordActions.ts`.

### 18. Keep client data separate from server data

**What we chose:** Pinia has the copy currently shown in the browser. `fakeApi` keeps a separate server copy.

**Why:** To simulate a teammate, the server copy must be able to change while the browser still shows its older copy. That older copy is what lets the app demonstrate a version conflict.

**Other options:** Use Pinia as both screen and server data. That would be simpler, but a simulated teammate would immediately change the screen and there would be no stale save to catch.

**Cost and next step:** Two copies use memory and are not durable. A real backend would keep the official records and share them across users.

**In the code:** `src/services/fakeApi.ts` owns the server `Map`; `src/stores/opportunities.ts` owns local records.

### 19. Keep successful bulk rows when another row fails

**What we chose:** Each record in a bulk request has its own result. Successful rows remain saved; the failed IDs are kept for retry.

**Why:** If 499 of 500 updates succeed, asking the user to repeat all 500 is unnecessary and could cause confusion.

**Other options:** Roll back every record if any one fails. That would require the server to save the entire group as one all-or-nothing database operation, which the fake API does not provide. Silently ignore failures would make the result hard to trust.

**Cost and next step:** The user must understand that “bulk update complete” can mean partial success. The app shows a persistent failure panel. Undo is also best effort and skips records with newer versions.

**In the code:** `bulkUpdateOpportunities` in `src/services/fakeApi.ts` and `bulkChangeStage` in `src/stores/opportunities/bulkActions.ts`.

### 20. Make Cancel stop future batches

**What we chose:** Let a request already sent finish, then stop before sending another batch. Reconcile records that were never sent from server data.

**Why:** Once a request reaches a server, the browser cannot know that canceling locally has undone a save. Pretending to roll it back could show the wrong stage.

**Other options:** Immediately reset every row or abort the request. A local reset cannot reverse a server save, and aborting a network request does not guarantee the server stopped processing it.

**Cost and next step:** Cancel is not instant; it takes effect at a batch boundary. In an earlier version, browser work after each response handled many rows one at a time and made the screen unresponsive. The current code installs results in groups and yields while reconciling untouched rows so the browser can repaint and accept input.

**In the code:** `cancelBulk` and `bulkChangeStage` in `src/stores/opportunities/bulkActions.ts`.

### 21. Keep teammate changes manual in this prototype

**What we chose:** A simulated teammate edit waits on the fake server until the user clicks **Sync updates**.

**Why:** The user gets control over when the table reorders. The app can still show that updates are waiting and keep track of the active row.

**Other options:** Automatically reload or use live events. Those would be appropriate with a shared production backend, but are outside this local prototype.

**Cost and next step:** Sync loads the full dataset, and the simulator does not work across browsers. A real service should send only changed records and support real user identities.

**In the code:** `simulateTeammate` and `syncLatest` in `src/stores/opportunities/syncActions.ts`.

## What I would improve before calling this production-ready

- Add the missing sales representatives and improve the variety of generated customer companies.
- Move records, filtering, and summary calculations to an authenticated backend with paging.
- Make conflict review clearer, including a way to cancel the old intent instead of retrying it.
- Make failed undo results visible and retryable.
- Add browser-level checks for keyboard use, conflict flows, and mixed bulk outcomes.
- Measure actual browser behavior before making speed claims.
