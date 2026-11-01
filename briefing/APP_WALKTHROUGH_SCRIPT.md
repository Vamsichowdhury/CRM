# FurniCraft Sales Pipeline — Screen Recording Script

**Length:** about 10–12 minutes at a relaxed pace

**How to use:** Text in quotation marks is what to say. Instructions in square brackets are actions for the recording; do not read them aloud.

## Before you start recording

- Open the app and wait for the pipeline to finish loading.
- Start with the network online. Set the save failure rate to **0%** for the first demonstrations so normal saves succeed predictably.
- Keep the simulator's default delay unless you are demonstrating cancellation. For that part, raise the minimum delay to 900 ms so there is time to click **Cancel**.
- If the app opens in dark mode, either keep it for the whole recording or switch to light mode at the start. Avoid switching back and forth without explaining why.
- Random failures are not guaranteed to happen on a particular click. The script includes a reliable offline failure demonstration and a separate optional partial-bulk demonstration.

## 1. Greeting and business context

[Start at the top of the loaded page. Pause briefly so the viewer can see the header and summary.]

**Say:**

> “Hi, thanks for watching. I’m going to walk through the FurniCraft Sales Pipeline I built for the HighLevel engineering assignment.
>
> FurniCraft is a fictional company that sells office furniture in bulk to other businesses. HighLevel is the CRM software; FurniCraft is the business using it. The app helps its sales team keep track of potential orders and move them through the sales process.”

[Point to the FurniCraft name, tagline, HighLevel label, and the “Sales Pipeline” heading.]

**Say:**

> “At the top you can see the FurniCraft branding and that the workspace is powered by HighLevel. The page is focused on one job: reviewing sales opportunities and deciding what should happen next.”

## 2. Pipeline overview and stage strip

[Point to the summary cards, then move across the colored stage cards.]

**Say:**

> “These summary cards give a quick view of the pipeline: how many opportunities we have, their total estimated value, how many are won or lost, and how many have had no activity for 30 days or more.
>
> The colored cards below show the number and percentage of opportunities at each stage. They’re also filters. If I click a stage, the table shows deals in that stage, much like opening a Kanban column. I can click the same stage again to return to all stages.”

[Click a stage card such as “Proposal Sent”; pause for the table to filter. Click it again to clear the stage filter.]

**Say:**

> “This gives me a stage-focused view while keeping the table, so I can still compare customers, deal values, owners, and activity in one place.”

### Optional owner-specific overview

[Open **All owners**, type “Aisha” in the owner search, select Aisha Khan, then click **Show owner stats only**. Point out the changed summary and stage cards. Click **Show all pipeline stats**, then select **All owners** again.]

**Say:**

> “I can also search the owner list and choose one representative. This switch changes the summary from the whole pipeline to that owner’s opportunities. I’ll switch back to all owners so the rest of the walkthrough uses the full pipeline.”

## 3. Find and prioritize opportunities

[Press `/` to focus the search box. Type “Indigo Networks”. Point to the customer and furniture order results. Clear the search using the visible **Clear** control.]

**Say:**

> “I can search by customer company or furniture product. For example, searching for Indigo Networks brings up its opportunities. The first generated example is an order for 115 office chairs, worth ₹1,22,000, owned by Aisha Khan, at New Lead.”

[Point to the table headings and one row.]

**Say:**

> “Each row keeps the main information together: customer company, product and unit count, deal value in rupees, owner, stage, last activity, last update, and save status. The owner dropdown is searchable too.”

[Use the stage dropdown in the filter toolbar. Choose one stage and show the results. Clear it. Optionally enter a minimum or maximum amount and toggle **Stale 30+ days**; then click **Clear**.]

**Say:**

> “I can narrow the list by stage, owner, minimum or maximum deal value, and whether the deal has gone stale. Clear resets those filters. This helps a representative focus on a manageable set—for example, high-value deals that have not had a recent follow-up.”

[Click the **Deal value** table heading once and again. Point out the sort direction marker. Repeat with **Last activity** or **Updated** if useful.]

**Say:**

> “The sortable columns let me bring high-value or recently updated deals together. Clicking a heading again reverses the sort order.”

## 4. Large-list browsing and stage changes

[Clear any filters. Scroll the opportunities table a little. Point to the “Showing … of …” caption.]

**Say:**

> “The app has 50,000 sample opportunities. It keeps the dataset in memory for this assignment, but it only renders the rows around the current scroll position, plus a few nearby rows. That keeps the page from placing all 50,000 rows into the browser’s document at once. Filtering and sorting still work on the in-memory dataset.”

[Choose a visible row that is not already Won or Lost. Click its right arrow once. Wait for the saving indicator to clear. Point to the changed stage, the green highlight, the updated stage count, and the toast.]

**Say:**

> “For a quick stage move, I can use the right arrow to move this deal forward, or the left arrow to move it back. The dropdown is still here when I want to choose a stage directly.
>
> The stage changes on screen straight away while the save is happening. When the save succeeds, the stage count updates too. Because the table is sorted by update time, this row may move. The green highlight shows where it went, and the app moves focus to the next deal I was reviewing.”

[If convenient, focus a row and press the right arrow once. Then point to the keyboard help at the bottom of the page.]

**Say:**

> “The same stage movement is available from the keyboard. The help at the bottom shows the shortcuts: slash focuses search, up and down move between rows, left and right change stage, Space selects a row, and Escape clears selection or leaves search.”

## 5. Select and update several opportunities

[Set the save failure rate to 0% in Simulation controls, with the network online. Return to the table. Select two or three visible rows using their checkboxes. Point to the selected count. Choose a destination stage and click **Apply to selected**. Wait for completion.]

**Say:**

> “When I need to update several deals together, I select their checkboxes, choose a destination stage, and apply it once. The progress area shows that the update is running. One request handles up to 500 deals, and each deal has its own result. Batches avoid sending a separate request for every deal, keep each request manageable, and give the app clear points to report progress or stop before sending more work.”
>
> “There was an earlier problem where the app updated the table one record at a time. With thousands of records, it kept the browser busy doing repeated updates, so the screen could not respond promptly when I clicked Cancel. Now each batch is installed into the table together, and cancelled records are reconciled in groups, with a short pause between groups so the browser can respond.”

[Point out that the rows update and selection clears after a normal successful operation. If the Undo toast appears, click **Undo** and wait for the confirmation.]

**Say:**

> “After the save, successful records stay updated. If I use Undo, the app tries to restore their previous stages. It skips a record if someone has changed it again since the bulk update, so Undo does not overwrite that newer change.”

[In the toolbar, optionally search “Office chairs”. Click **Select all matching** and point to the selected count. Then click **Deselect all**.]

**Say:**

> “There are two selection scopes. The checkbox in the table heading selects the rows currently shown. Select all matching selects every result for the current filters, including deals farther down the list. I’m clearing this selection without applying an update.”

## 6. Show a failed save and retry

[Open **Simulation controls** below the table. Confirm the network is online and set failure rate to 0%. Turn **Network connection** to Offline. Return to a visible row and change its stage once. Wait for the error state. Point out the row’s **Save failed** status and **Retry** button, plus the error toast.]

**Say:**

> “I can also demonstrate a failed save. I’ve switched the simulated connection offline. The app tries to save the stage, but the request fails. The row shows that the save failed, and the toast explains the problem. The app does not leave the unsaved stage looking like a confirmed save.”

[Open Simulation controls. Turn Offline off. Return to the row and click its **Retry** button. Wait for success.]

**Say:**

> “Now that the connection is back, I can retry. The app checks the latest available server data and tries my stage change again. This is called an optimistic update: the screen responds immediately, but the app still confirms the save and shows an error if it does not succeed.”

## 7. Explain partial bulk failures and cancellation

[Open Simulation controls and set failure rate to 40%, while keeping the network online. Return to the table and select around 10 visible rows. Choose a destination stage and click **Apply to selected**. Wait for the outcome.]

**Say if some rows fail:**

> “Here the simulator has produced a partial result: some deals were saved and some need attention. The successful updates stay saved. The panel tells me how many failed and lets me retry only those records, so I don’t have to send the successful ones again.”

[To make retry predictable, set failure rate to 0% before clicking **Retry … failed**.]

**Say:**

> “I’ve set the failure rate to zero for this retry. I’ll retry the failed records only.”

**If all rows succeeded or all failed:**

> “These failures are random, so this run did not produce a mix of successful and failed rows. I won’t claim that it did. The interface supports per-record outcomes; in a real recording, I would repeat this demo with a larger selection to get a mixed result.”

[Optional cancellation demo: Set failure rate to 0%. Search a common product such as “Office chairs”, click **Select all matching**, choose a stage, and click **Apply to selected**. Click **Cancel** while the first batch is in progress. Wait until the cancelling/reconciliation message clears, then click **Deselect all**.]

**Say:**

> “For a large update, I can cancel while it is running. The batch that has already been sent is allowed to finish; the app then stops sending new batches and restores the records that were not sent. So cancel means stop future work—it does not pretend to roll back a request the server may already have saved.”
>
> “We let the current batch finish because the server may already have saved it, and a browser cancel cannot reliably undo that. After it finishes, the app does no more writes, reloads the untouched deals in groups of 500, and yields briefly between groups. That gives the browser time to repaint and handle input instead of freezing while thousands of rows are reconciled.”

## 8. Show a teammate edit and version conflict

[Make sure network is online and failure rate is 0%. Return to the table and click a deal row to make it active. Scroll to **Simulation controls** and expand **Same-deal concurrency**. Confirm the active deal is shown, then click **Simulate teammate edit on active deal**. Wait for the toast. Return to the table without syncing. On that same row, change the stage once. Wait for the conflict.]

**Say:**

> “This section demonstrates two people changing the same deal. First, the simulator changes the server’s copy but leaves my screen unchanged. Now I’ll make my own stage change using the older version. The server rejects it as an **Update conflict** and shows the latest stage it has.”

[Point to the row’s **Update conflict** status and its **Retry** button. Click **Sync updates** in the table caption. Then click **Go to active row** if the row is no longer in view. Point out the latest stage.]

**Say:**

> “I can sync to load the teammate’s latest data and return to the deal I was working on. If I choose Retry, the app fetches the latest version and reapplies my original stage choice. This demo does not have a separate merge screen, so in a production CRM I would make the choice between keeping the teammate’s change and reapplying mine more explicit.”

## 9. Theme, simulation, and honest boundaries

[Scroll to the header and click the theme button to show the alternate theme, then return to the preferred theme. Scroll back to Simulation controls and point to network, failure-rate, and delay controls.]

**Say:**

> “The theme control switches between light and dark, and the app remembers the choice in this browser. The simulation panel lets me vary the save failure rate and request delay or switch offline. The same-deal scenario gives me a way to demonstrate a stale-version conflict without opening another browser.”

[Optional: show the 50,000 dataset note in Simulation controls.]

**Say:**

> “One important boundary: this is a frontend assignment, not a production CRM backend. The API is simulated in one browser session, so it does not share data across real users or devices. The list is virtualized for rendering, but filtering and sorting still use the in-memory records. The generated data currently has seven different owner names; the assignment calls for twenty.”

## 10. Closing

[Return to the top of the pipeline and leave the stage strip and table visible.]

**Say:**

> “That’s the walkthrough. The main design goal was to make a large pipeline easy to scan, keep stage changes quick, and make failures visible and recoverable. I combined a table for comparing and selecting deals with stage-based filtering and arrow controls for quick movement.
>
> With more time, I’d add pipeline setup, opportunity creation, custom fields for furniture delivery needs, richer opportunity details, more saved filters, and smart tags for deals that are valuable, stale, or close to their expected close date. Thanks for watching.”

## Recording notes

- Keep narration conversational; pause while the app is saving rather than filling every second with speech.
- The simulated 40% failure rate is random. Only describe failures actually visible on screen.
- Set failure rate to 0% and reconnect before the teammate conflict demo so a random network error does not mask the version conflict.
- Do not call the fake API real-time collaboration, database transactions, or a production backend.
- Opportunity creation, pipeline setup, and smart tags are future ideas; they are not implemented in this version.
