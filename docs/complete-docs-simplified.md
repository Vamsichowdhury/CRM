# FurniCraft Sales Pipeline — Complete Documentation

This document explains the FurniCraft Sales Pipeline in plain language. It covers what the application does, how its main features work, why certain design choices were made, what happens when something goes wrong, and what should be improved before using a system like this in a real business.

The application is an interview assignment prototype. It uses sample data and a simulated API. It is not a live CRM connected to a real database or shared between real users.

# 1. What the Application Does

FurniCraft is a fictional company that sells office furniture in bulk to other businesses. The application helps its sales team keep track of potential orders, from the first enquiry until the deal is won or lost.

A potential sale is called an **opportunity**. Each opportunity contains information such as:

- The company that may buy the furniture.
- The furniture product and the number of units requested.
- The estimated value of the order in Indian rupees.
- The sales representative responsible for following up.
- The current stage of the sale.
- The dates of recent activity and updates.

For example, Indigo Networks may be interested in buying 115 office chairs worth ₹1,22,000. Aisha Khan is responsible for following up, and the opportunity is currently at the **New Lead** stage.

The sales process uses these stages:

**New Lead → Contacted → Demo Done → Proposal Sent → Negotiation → Won or Lost**

The application includes 50,000 sample opportunities. Salespeople can search and filter them, change their stages, select many opportunities at once, and retry updates that fail.

The main goal is to make a large list of sales opportunities easy to work with, without making users lose track of what they are doing when records move or saves fail.

# 2. How the Application Is Put Together

The application has three main parts:

1. **The screen:** This is what salespeople use. It contains the summary, filters, opportunity table, and action controls.
2. **The application's working data:** This keeps the current records, filters, selected rows, save messages, and progress information.
3. **The simulated server:** This keeps a separate copy of the records and behaves like a backend. It can introduce delays, reject saves, and simulate another salesperson changing a record.

Keeping the screen's data separate from the simulated server is important. It allows the application to demonstrate what happens when the information on a user's screen is older than the latest server data.

## Technology used

| Technology                | What it does in this application                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Vue 3                     | Builds the application screen from reusable parts.                                        |
| TypeScript                | Helps keep data and update requests in the expected format.                               |
| Pinia                     | Keeps shared application data available to the table, filters, summary, and bulk actions. |
| TanStack Vue Virtual      | Displays only the table rows near the user's current scroll position.                     |
| Vite                      | Runs the development application and creates the production build.                        |
| Vitest and Vue Test Utils | Run tests for application logic and screen components.                                    |

The project does not currently use a real backend, database, or HTTP service. The API is simulated inside the application.

## How data moves through the application

When the application starts, it asks the simulated server for the opportunity records. The application keeps a local copy and uses that copy to show the table and calculate the summary numbers.

When a user changes a stage, selects records, or applies filters, the screen works with the shared application data. When a save is needed, the relevant action sends the change to the simulated server. The server either accepts it or returns a failure or conflict. The application then updates the screen to reflect the result.

Search, filtering, sorting, and summary calculations currently happen in the browser using the loaded records. They are not sent to a real server.

# 3. Why the Main Design Choices Were Made

## A table instead of a full Kanban board

A Kanban board normally shows one column for each sales stage. Users move cards from one column to another as a deal progresses.

That works well when there are a small number of opportunities. This application has 50,000. Showing thousands of cards across several columns would make it harder to search, compare deal values, check owners, and select records from different stages.

I chose a table because it puts important details side by side: customer, product, quantity, deal value, owner, stage, and activity dates. A stage summary above the table keeps some of the visual simplicity of Kanban. Clicking a stage filters the table to show opportunities in that stage.

**Trade-off:** A table is less visual than a Kanban board and can feel crowded. A future version could offer an optional Kanban view for users who prefer it, with the server returning only the records needed for that view.

## Stage arrows and a dropdown instead of drag-and-drop

Each row has previous-stage and next-stage arrows, as well as a dropdown for choosing a stage directly.

The arrows make common stage changes quick. The dropdown lets users choose any stage, including Won or Lost. These controls are easier to use in a large table and work better with keyboard navigation than dragging rows between columns.

**Trade-off:** The row has more controls, and users need to understand what the arrows do. Drag-and-drop could be considered if a separate visual board is added later.

## Keeping the user's place after an update

The table is sorted by the most recently updated opportunity. When a user saves a change, that row may move to the top of the table.

For example, a salesperson may be reviewing the first five opportunities. After updating the fifth one, it moves to the top because it was just changed. Without help, the salesperson could lose track of the next opportunity to review.

To make this easier, the application briefly highlights the updated row and moves focus to the next opportunity based on the order the user was reviewing before the update.

## Letting users choose when to sync teammate changes

The application can simulate another salesperson changing an opportunity. That change is made to the simulated server copy, but it does not immediately change the table on the current screen.

The user can click **Sync updates** when they are ready to load the latest information. A **Go to active row** action helps them return to the opportunity they were working on.

This avoids unexpected table changes while someone is reviewing records.

**Important limitation:** This is a simulation inside one application. It does not provide real-time collaboration between separate browsers or devices.

## Showing only the rows the user needs

Creating all 50,000 table rows at once would make the browser do unnecessary work. Most of those rows would be outside the visible part of the screen.

The application uses a technique called _virtualization_. It creates the rows around the current scroll position and a few extra rows nearby. As the user scrolls, it replaces those rows with the next visible set.

This keeps the table responsive without creating 50,000 visible page elements.

**Important distinction:** Virtualization reduces the amount of table content the browser displays at once. It does not reduce the number of records loaded into memory. All 50,000 records are still loaded, and search, filtering, and sorting still work on the browser's copy.

# 4. How Saving Changes Works

A save can succeed, fail, or conflict with a change made by someone else. The application shows these situations instead of assuming every save will work.

## Saving one opportunity

When a user changes a stage, the row keeps showing its last saved stage and shows that the save is in progress. The stage changes after the service confirms the save. This avoids showing a change that might fail.

For example:

1. An opportunity is at **New Lead**.
2. The user changes it to **Contacted**.
3. The row keeps showing **New Lead** and is marked as saving.
4. If the server accepts the change, the table shows **Contacted** and marks the row as saved.
5. If the server rejects the change, the row stays at its last saved stage, shows an error or conflict state, and offers Retry.

A user can click **Retry** to try the intended change again.

The application distinguishes between four save states:

- **Saved:** The latest change was accepted.
- **Saving:** The application is waiting for the save result.
- **Error:** The save failed for another reason, such as a simulated network failure.
- **Conflict:** The record changed on the server after the user last read it.

## When two people change the same opportunity

Imagine two salespeople open the same opportunity while it is at **New Lead**.

- Salesperson A changes it to **Contacted** and saves successfully.
- Salesperson B, still looking at the older information, tries to change it to **Lost**.

If the application accepted both changes without checking, B could overwrite A's newer update without knowing it.

To prevent this, every opportunity has a version number. When a user saves, the application sends the version number they were working with. The server accepts the change only if that version is still current. A successful save increases the version number.

In the example, A saves version 1 and the server moves to version 2. B then tries to save using version 1. The server rejects B's update and returns the latest record as a conflict.

The user can review the latest information and click **Retry**. Retry fetches the latest version and tries the user's original stage change again.

**What is not included:** There is no dedicated screen that compares both people's changes and lets the user choose which one should win. The version check is also only demonstrated by the simulated API. A real backend must perform this check safely when saving to the database.

## When a large update partly fails

Users can select many opportunities and change their stage together. For example, a manager may select 2,000 opportunities and move them to **Proposal Sent**.

The application sends these changes in groups of up to 500 records. It processes one group at a time and keeps track of the result for each opportunity.

A bulk update does not have to be all successful or all unsuccessful. For example, if 500 opportunities are selected, 480 may save successfully and 20 may fail.

In that situation:

- The 480 successful changes stay saved.
- The 20 failed opportunities are identified.
- The user can retry only those 20 records.

The application also shows progress while the update is running. If the user cancels, the current group is allowed to finish, and the application does not send the remaining groups.

**Why groups of 500?** Sending every record as one huge request could create a very large request. Sending one request per record would be slow. Groups provide a practical middle ground for this demonstration.

## How Undo works

After a bulk stage change, the application keeps the previous stage and the version created by the bulk update.

When the user clicks **Undo**, the application checks each opportunity:

- If the opportunity has not changed since the bulk update, it can restore the previous stage.
- If someone has changed it since then, the application skips it so that a newer change is not overwritten.

Undo is a best-effort action, not one all-or-nothing database operation. If an Undo save fails, the current application does not keep that failed Undo available for another retry. The user would need to change that opportunity manually.

# 5. Features and How to Use Them

## Pipeline overview

The overview displays summary information such as the total number of opportunities, pipeline value, won and lost deals, and opportunities that may need attention. Stage tiles show how many opportunities are in each stage.

Click a stage tile to filter the table. Click it again to remove that stage filter. When filtering by owner, the overview can show figures for the full pipeline or for the selected owner.

These figures are calculated from the records loaded in the browser. They are useful for understanding the sample pipeline, but they are not audited financial reports or server-generated business analytics.

## Opportunity table

The table shows the customer company, furniture product, quantity, deal value, sales owner, stage, last activity, updated date, and save status.

Users can scroll through the list, sort by supported columns, select rows, and change stages. The table uses virtualization, so only rows around the visible area are created at a time.

## Search, filters, and sorting

Users can search by customer company or product. They can also filter by stage, owner, minimum or maximum deal value, and whether an opportunity has had no recent activity.

The table can be sorted by supported fields such as company, deal value, last activity, and update date. Search and filtering happen immediately in the browser; search is not currently delayed or debounced.

## Selecting opportunities

Users can select individual rows with checkboxes. Selection is stored using opportunity IDs, so it remains intact even when a row scrolls off screen and is no longer displayed by the virtual table.

The table's header checkbox selects the rows currently rendered in the table area. **Select all matching** is a separate action: it selects every opportunity matching the current filters, including records that are farther down the list. Users can exclude individual records from that selection.

The distinction matters: selecting the visible rows is not the same as selecting every result that matches the filters.

## Bulk stage changes

After selecting opportunities, users can choose a stage and start a bulk update. The application shows progress, reports successful and failed records, and allows failed records to be retried without resending successful ones.

Cancellation stops later groups from being sent after the current group finishes. It does not undo records that the server has already accepted.

## Simulation controls

The simulation panel lets reviewers test different situations without a real backend. It includes settings for network delay, save failure rate, offline behavior, and a simulated teammate change.

The default simulated delay is 300–1500 milliseconds and the default save failure rate is 10%. The settings can be changed to make failures easier to demonstrate. The teammate scenario changes the simulated server record while leaving the current table unchanged until the user syncs.

One limitation is that individual-record reads do not use the same simulated delay/offline behavior as other API calls. This is a simplification in the demo and is not how a real network service should behave.

## Keyboard controls and visual feedback

The application supports keyboard actions for common tasks:

- `/` focuses the search field.
- Up and Down arrows move between rows.
- Left and Right arrows change the stage using the available stage navigation.
- Space selects the focused row.
- Escape clears a selection or moves focus away from search, depending on the current focus.

The active row is highlighted, and a successful stage update briefly highlights the updated row. A help control explains the shortcuts.

The keyboard behavior has not been tested thoroughly with screen readers or every keyboard interaction. Those checks should be part of further accessibility work.

## Theme

The application supports light and dark themes. It follows the computer's theme setting until the user chooses a theme manually. A manual choice is stored in the browser's local storage, so it remains selected on that browser.

There is no account-wide theme setting or separate high-contrast theme.

# 6. Performance: What Is Fast and What Still Has a Cost

The application is designed to avoid creating 50,000 table rows at once. That is helpful, but it does not mean every operation is instant or that the application is ready for unlimited data.

## What virtualization improves

Virtualization limits the number of table rows mounted in the page. The current setup estimates a row height of 56 pixels and keeps eight extra rows around the visible area. The exact number of mounted rows depends on the screen size and scroll position.

Stable opportunity IDs help the table keep track of each row when sorting changes its position.

## What virtualization does not improve

The browser still holds all 50,000 opportunities in memory. Searching and filtering scan the loaded records. Sorting arranges the matching records. Summary values also need to inspect the data. Sync currently downloads the complete dataset again.

In simple terms, the table displays only a small part of the data, but the browser still has the full dataset available to work with.

## How performance should be measured

There is no recorded browser benchmark or measured speed improvement in this project. It would be inaccurate to claim a specific percentage improvement.

A proper test should use the production build, a fixed dataset of 50,000 records, and the same browser, machine, and screen size. It should measure:

- How long the first screen takes to become usable.
- How many table rows are actually mounted.
- How quickly search, filters, and sorting respond.
- How long a single save and a full sync take.
- How long a 10,000-record bulk update takes.
- Browser memory use before and after large selections and syncs.

The test should be repeated several times and report typical results rather than relying on one run.

# 7. Failures and Less Common Situations

The application handles several failure situations, but not every situation is fully covered. The table below explains the current behavior in everyday language.

| Situation                                           | What the application does now                                                                    | What still needs work                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| The first data load fails                           | Shows an error and offers a retry.                                                               | No saved offline copy or automatic retry.                                                     |
| A single save fails                                 | Tries to restore the latest available server data and shows an error with a retry option.        | No automatic retry schedule or detailed failure categories.                                   |
| The network is slow                                 | Shows a saving state; repeated updates to the same record are handled in order.                  | No request timeout or measured network reporting.                                             |
| The app is offline                                  | Simulated API operations that use the network simulation fail.                                   | Some individual-record reads bypass the offline simulation; there is no offline work queue.   |
| Two users change the same record                    | The simulated server rejects the older version and returns the latest record.                    | This is not shared across real browsers or devices.                                           |
| An older save response arrives late                 | Local revision checks help prevent an older response from replacing a newer local change.        | More tests are needed for every possible order of success, failure, and conflict responses.   |
| A teammate changes a record during a bulk update    | Each record is checked separately; stale records can become conflicts while other records save.  | There is no dedicated test that coordinates this exact situation across batches.              |
| Some records in a bulk update fail                  | Successful records stay saved; failed records can be retried separately.                         | A deterministic test of mixed success and failure in one batch is still needed.               |
| A bulk update is cancelled                          | The current group finishes, later groups are not sent, and untouched records are reconciled.     | Cancellation is not an immediate stop and cannot undo a request already accepted by a server. |
| The user selects the wrong records                  | The selection is visible and can be changed before the update.                                   | A preview of all selected records would make large changes safer.                             |
| The dataset is reset while a save is pending        | There is a test helper for resetting the fake API, but no complete user-facing reset flow.       | Old responses could affect a newly loaded dataset; a dataset-generation check is needed.      |
| A record is moved out of the current filter         | The record may disappear from the filtered table after the update.                               | The interface should explain this and make it easy to find the active record again.           |
| Undo happens after someone else changes a record    | The application skips records whose version has changed.                                         | If an Undo save fails, it is not currently available for another Undo retry.                  |
| A full sync overlaps with another teammate update   | The application tracks pending update generations and tries not to clear a newer pending marker. | More tests are needed for overlapping syncs and active saves.                                 |
| A record becomes inactive while the page stays open | The attention count is calculated using the current time when it is recomputed.                  | The count may not refresh just because time passes while the page remains open.               |
| The user clicks an action repeatedly                | Some saving and progress states limit repeated actions; same-record saves are queued.            | Important actions also need protection inside the store, not only disabled buttons.           |

**Interview wording:** It is accurate to say that the simulated API demonstrates save failures and version conflicts. It is not accurate to say that the application already supports production-grade, real-time collaboration between multiple users.

# 8. Current Gaps and What Should Be Improved

## Product improvements

1. **Support multiple sales pipelines.** Managers should be able to create different processes for new enquiries, repeat orders, or other types of sales.
2. **Allow users to create opportunities.** Add a form for customer, product, quantity, estimated value, owner, stage, expected close date, and next action.
3. **Store more customer information.** Add contact details, notes, call and email history, delivery location, and installation requirements.
4. **Improve filters and saved views.** Add filters for product, quantity, expected close date, delivery city, tags, and recent activity. Let users save useful combinations such as “large chair orders that need follow-up.”
5. **Add helpful tags.** Automatically label high-value deals, deals with no activity for 30 days, deals closing soon, or large chair orders. Explain why each tag was applied.
6. **Improve the review experience.** Make the table less crowded, clarify selection scope, and improve the accessibility labels and keyboard experience.

## Technical improvements before production

1. **Use a real backend and database.** The current simulated API keeps data only in memory and loses it when the application process resets.
2. **Load only the data needed.** Move search, filtering, sorting, summary calculations, and pagination to the server. Avoid downloading all 50,000 records for every sync.
3. **Add authentication and permissions.** Real users should only see and change the information they are allowed to access.
4. **Make version checks reliable.** The backend must check the version and save the change as one safe database operation.
5. **Improve conflict handling.** Let users compare the latest saved value with their intended change before choosing what to do.
6. **Make Undo recoverable.** Keep failed Undo records so users can retry them and clearly report what was restored, skipped, or failed.
7. **Make bulk jobs more reliable.** Track large operations on the server, keep their results, and provide clear progress and cancellation behavior.
8. **Validate incoming data.** Check server responses and user settings before using them in the application.
9. **Add stronger tests.** Cover mixed bulk outcomes, repeated failures, Undo failures, overlapping sync, keyboard use, and dataset reset while saves are pending.
10. **Measure performance and accessibility.** Run browser benchmarks and test with keyboard and screen-reader users before making production claims.

# 9. What the Code Contains

This section gives a short guide to the main project files. It is included for anyone who wants to connect the behavior described above to the source code.

| File or folder                              | Purpose in simple terms                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/App.vue`                               | Starts the application, loads the data, handles global shortcuts, theme, notifications, and bulk-action flow.    |
| `src/components/`                           | Contains the visible parts of the application, such as the table, rows, filters, overview, and simulation panel. |
| `src/components/OpportunityTable.vue`       | Displays the table, manages scrolling, sorting, keyboard navigation, and the active row.                         |
| `src/components/OpportunityTableRow.vue`    | Displays one opportunity row and its stage and save controls.                                                    |
| `src/stores/opportunities.ts`               | Holds the main opportunity data and brings together actions used by the screen.                                  |
| `src/stores/opportunities/recordActions.ts` | Handles saving one opportunity, retrying, and keeping same-record updates in order.                              |
| `src/stores/opportunities/bulkActions.ts`   | Handles large updates, progress, cancellation, failed-record retry, and Undo.                                    |
| `src/stores/opportunities/syncActions.ts`   | Loads the data and handles simulated teammate changes and manual sync.                                           |
| `src/stores/selection.ts`                   | Remembers which opportunity IDs the user selected.                                                               |
| `src/stores/simulation.ts`                  | Stores the delay, failure, offline, and simulation settings.                                                     |
| `src/services/opportunityGenerator.ts`      | Creates the sample furniture opportunities.                                                                      |
| `src/services/fakeApi.ts`                   | Acts as the simulated server and controls saves, failures, versions, and teammate changes.                       |
| `src/utils/`                                | Contains helper logic for filtering, sorting, stage movement, and choosing the next row to review.               |
| `src/types/opportunity.ts`                  | Defines the shape of an opportunity and the allowed stages and save states.                                      |

## How the main actions work

### When the application first opens

1. The application asks the simulated server for the opportunity list.
2. The server returns a copy of its records.
3. The application stores those records for the table and summary.
4. The table displays the rows around the current scroll position.

### When a user changes one stage

1. The row sends the requested stage change to the opportunity store.
2. The row keeps showing its current saved stage and is marked as saving.
3. The store sends the change to the simulated server with the version it last read.
4. The server accepts the change or returns an error/conflict.
5. If accepted, the store updates the row to the new stage. If not, the current saved stage stays visible and the row shows the appropriate error or conflict status.

### When a user changes many stages

1. The application collects the selected opportunity IDs and remembers their previous stages and versions.
2. It keeps the current stages visible, marks the selected rows as saving, and sends groups of up to 500 records.
3. Each record receives its own success or failure result, and the application updates the rows as each group returns.
4. Successful changes stay saved, while failed rows keep the latest available stage and offer retry.
5. If cancelled, the current group finishes and later groups are not sent; their rows keep their existing stages.

### When a teammate changes an opportunity

1. The simulation changes the server copy of the opportunity.
2. The current table remains unchanged and shows that updates are waiting.
3. The user clicks **Sync updates**.
4. The application fetches the latest full list and updates its local copy, while trying to preserve records that are currently saving.

# 10. Data Details and Important Accuracy Notes

The opportunity data includes a stable ID, company name, product/opportunity name, deal value, quantity, owner, stage, activity dates, update dates, and version number.

A few details are important when explaining the current implementation:

- The quantity is stored in a field named `licenceCount`, which is a leftover from an earlier version of the assignment. In this furniture application it means the number of furniture units.
- The generator currently has **seven sales representatives**, not the 20 described in the assignment scenario. This is an implementation gap that should be fixed.
- The generator creates 50,000 opportunities, but company names are based on 20 fictional company names with numeric additions. They are not 50,000 unique, realistic company names.
- The stage name **Demo Done** is kept from the requested stage list, even though another phrase might sound more natural for furniture sales.
- The summary numbers are calculated from the loaded sample records. Pipeline value is not weighted by the chance of winning.
- The fake API is an in-memory object. It does not provide a real database, login, user permissions, durable storage, or communication between separate devices.

# 11. Testing and Build Checks

The project uses Vitest and Vue Test Utils for automated tests. Tests cover the sample data generator, filtering and sorting, stage navigation, selection, simulated API behavior, store actions, and some application-level flows.

The existing tests cover important paths, but they do not prove that every possible user interaction or failure is handled. Areas that need more tests include:

- A single bulk batch containing a mixture of successful, failed, and conflicting records.
- Repeated failures when retrying a bulk update.
- An Undo request that itself fails.
- A teammate update arriving while a bulk update is running.
- A full sync overlapping with another sync or an active save.
- Resetting the dataset while an earlier save is still pending.
- Keyboard navigation and screen-reader announcements.
- Owner selection and other detailed component interactions.

The project provides these checks:

- `npm run build` checks TypeScript and creates the production build.
- `npm test` runs the automated tests.
- `npm run lint` checks code style and common coding issues.

The recorded test result in the source documentation was 28 passing tests at that point. This should be treated as a historical result, not a guarantee that the current checkout still has the same result.
