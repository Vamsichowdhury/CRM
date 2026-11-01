# FurniCraft Sales Pipeline: Product Guide

## What this app is for

FurniCraft is a fictional company that sells office chairs, office desks, conference tables, storage cabinets, and reception desks in bulk to other businesses. Its sales team uses HighLevel to keep track of potential orders, from the first enquiry to a won or lost deal.

This project is a frontend prototype for that workflow. It starts with 50,000 sample opportunities and simulates saves, delays, errors, and teammate edits inside the browser. It does not connect to a real database or share changes between real users.

## What an opportunity means

An opportunity is one possible sale the team wants to follow up on. These terms help explain what appears in a row:

| Term | In plain language | FurniCraft example |
| --- | --- | --- |
| Customer company | The business that may buy from FurniCraft | Indigo Networks |
| Opportunity | The possible order the sales team is tracking | Indigo Networks’ office chair enquiry |
| Product and quantity | What the customer may buy and how many | Office chairs · 115 units |
| Deal value | The estimated value of the possible order | ₹1,22,000 |
| Owner | The sales representative responsible for follow-up | Aisha Khan |
| Stage | How far the sale has progressed | New Lead |

The pipeline stages are **New Lead → Contacted → Demo Done → Proposal Sent → Negotiation → Won or Lost**. The arrows follow the main path toward Won. Lost is chosen from the stage dropdown.

## Who uses it

- **Sales representatives** need to find their opportunities, see what the customer is considering, move a deal forward, and keep their place while they work through the list.
- **Sales managers** need to understand pipeline value, outcomes, inactive deals, and how work is distributed across stages and owners.
- **People handling many records** need to select groups, update them efficiently, and see exactly which saves need attention.

## Problems this workspace helps with

| User problem | What the app provides |
| --- | --- |
| “I can’t find one deal in a list of 50,000.” | Search by company or product, then narrow results by stage, owner, value, or inactivity. |
| “A stage dropdown takes too many clicks for a routine move.” | One-click previous and next arrows beside the dropdown. The dropdown remains available when a direct stage choice is needed. |
| “I changed a deal and it moved somewhere else in the list.” | A short green highlight shows the saved row, and focus moves to the next deal in the order the user was reviewing. |
| “I need to see just one person’s workload.” | Searchable owner filter and a switch between team-wide and selected-owner statistics. |
| “Some saves fail.” | Clear saving, saved, failed, and conflict states, plus a retry action. |
| “A teammate changed the same deal.” | Version checks reject an older save and show the latest server record for review. |
| “One deal failed in a large update.” | Successful records stay saved; the user can retry only the failed records. |
| “The table keeps changing while I’m reviewing it.” | Simulated teammate changes wait until the user presses **Sync updates**. |

## How to use the main features

### 1. Get a quick view of the pipeline

The cards at the top show total opportunities, total deal value, won and lost counts, and deals with no activity for more than 30 days. The colored stage strip shows the number and percentage of opportunities in each stage.

Click a stage tile to show that stage’s deals in the table. Click it again to return to all stages. This gives the user a visual way to browse stages while keeping the detailed table in view. The app does not have separate Kanban columns.

When an owner is selected, a switch can show either the full pipeline statistics or that owner’s statistics. These numbers are calculated from the records currently held by the browser.

### 2. Find and compare deals

Search checks customer company names and product names. Other filters narrow the list by stage, owner, minimum or maximum deal value, and whether the last activity was more than 30 days ago. The filters can be combined and cleared together.

Click the Customer company, Deal value, Last activity, or Updated heading to sort by that field. For example, a manager can find high-value orders by sorting on deal value, or bring recently updated deals together by sorting on Updated.

These searches and filters work in the browser on the loaded dataset. They do not request a smaller result from a server.

### 3. Review a deal and change its stage

Each table row shows the customer, furniture product and units, estimated rupee value, owner, stage, activity dates, and save status. The arrows move to the previous or next stage in the main path. The dropdown can choose any stage, including Lost.

When the user changes a stage, the row updates straight away while the save is in progress. This is called an **optimistic update**: the app assumes the save will work so the screen feels responsive, then checks the result. If it succeeds, the row stays updated. If it fails, the app restores the latest record it can read and shows an error or conflict state.

The default table order is by most recently updated. A saved row may move because of that sort. The app briefly highlights the moved row and focuses the next opportunity from the order the user was reviewing before the save.

### 4. Select and update several deals

Users can check individual rows, use the table header checkbox for the rows currently rendered, or choose **Select all matching** to remember every record that matches the current filters at that moment. Because the table only renders rows near the screen, selection is stored by record ID so it survives scrolling.

After selecting records, choose a stage and press **Apply to selected**. The app shows progress while it sends groups of up to 500 records. Each opportunity receives its own result. If five succeed and one fails, the five successful changes remain saved and the failure panel offers a retry for only the one that failed.

The user can also cancel. The request already sent is allowed to finish, because the server may have saved it. The app then stops sending later groups and restores records that were not sent. Cancel stops future work; it does not pretend to roll back a request that may already have completed.

After a bulk update, the app can offer **Undo successful updates**. It restores a record only if nobody has changed it since the bulk update. It may restore some records and skip others; it is not one all-or-nothing database operation.

### 5. See and recover from failed saves

Each row shows whether it is saved, saving, failed, or in conflict. If a save fails, the row shows **Save failed** and a **Retry** button. The app also shows an error toast at the bottom right. It tries to restore the latest server record first, so a failed save does not leave the screen claiming that an unsaved change is complete.

The simulation panel can switch the fake service offline or change the random failure rate. This makes it possible to demonstrate the error and retry flow without relying on a real network outage.

When the app first opens, it loads the sample pipeline. If that load fails, the page shows an error and a **Try again** button.

### 6. Handle a teammate’s change

The simulation panel can change the active opportunity on the fake server while leaving the visible table alone. The user can choose when to press **Sync updates**, so the table does not unexpectedly reorder while they are reviewing a row.

Every record has a version number. If a user tries to save using an older version, the fake server rejects it and returns the latest record. The row is marked **Update conflict**. The user can sync, review the latest stage, and use Retry if the original requested stage is still appropriate. In this prototype, Retry replays that original stage request; there is no compare-and-merge dialog.

This is a demonstration of conflict handling inside one app instance, not live collaboration between separate browsers or devices.

### 7. Use keyboard controls and choose a theme

The app supports `/` to focus search, Up and Down to move between focused rows, Left and Right to change the focused row’s stage, Space to select a row, and Escape to clear selection or leave search. A theme control in the header switches between light and dark. The app follows the computer’s theme until the user makes a choice, then stores that choice in browser local storage.

## What is simulated, and what is not

The project has an in-memory fake API with configurable delay, random save failures, offline mode, per-record version checks, and simulated teammate changes. The default delay is 300–1500 ms, and the default save failure rate is 10%. It helps demonstrate how the interface responds to common situations.

It does **not** include a production backend, sign-in, permissions, persistent storage, real-time updates, or cross-device collaboration. Search, filtering, sorting, and summary calculations use all records loaded into the browser. These are important limitations to explain during a review or interview.

## Current sample-data gap

The assignment describes a team of 20 sales representatives. The current generator in `src/services/opportunityGenerator.ts` has seven owners. It also creates 50,000 records from a smaller set of fictional company names with numeric suffixes. The data has the furniture products and rupee deal values, but the owner count and company variety do not fully match the assignment brief.

## Where the behavior lives

- Summary cards and clickable stage tiles: `src/components/PipelineOverview.vue`
- Search, owner picker, and filters: `src/components/OpportunityFilterToolbar.vue`
- Table, row movement, and virtual scrolling: `src/components/OpportunityTable.vue`
- Row details and stage controls: `src/components/OpportunityTableRow.vue`
- Individual save and retry: `src/stores/opportunities/recordActions.ts`
- Bulk update, cancel, and undo: `src/stores/opportunities/bulkActions.ts`
- Teammate simulation and manual sync: `src/stores/opportunities/syncActions.ts`
- Simulated server and sample data: `src/services/fakeApi.ts` and `src/services/opportunityGenerator.ts`
