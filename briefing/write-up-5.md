## 1. What I Built and Why

I built a sales pipeline management application for a fictional company called FurniCraft, which sells office furniture in bulk to other businesses.

I chose the furniture business because it makes the sales process easy to understand.

### What the application does

The application contains 50,000 sample sales opportunities. Each opportunity includes:

| Field      | definition                                        | Example         |
| ---------- | ------------------------------------------------- | --------------- |
| Customer   | The business interested in purchasing furniture   | Indigo Networks |
| Product    | What the customer wants to purchase               | Office Chairs   |
| Quantity   | how many units                                    | 115 units       |
| Deal Value | The estimated order value in Indian rupees.       | ₹1,22,000       |
| Owner      | sales representative responsible for following up | Aisha Khan      |
| Stage      | sales representative responsible for following up | Demo Done       |

The sales process follows these stages:

New Lead → Contacted → Demo Done → Proposal Sent → Negotiation → Won / Lost

### Why I built it

The main goal was to create a workspace where sales representatives can manage a large number of opportunities without opening each record individually.

I wanted users to be able to:

- Find opportunities quickly.
- Understand the current sales pipeline.
- Update individual opportunities.
- Select and update multiple opportunities together.
- Identify failed saves and retry them.
- Handle changes made by other teammates without silently overwriting data.

I also wanted to demonstrate how a frontend application can handle a large dataset while keeping the user experience responsive and predictable.

## 2. Application Architecture and Data Flow

I used Vue 3, TypeScript, Pinia, and TanStack Vue Virtual(Renders only visible rows instead of mounting all 50,000 rows) to build the application.

The application has a simulated API that behaves like a backend. It maintains a separate copy of the opportunity data, allowing me to demonstrate saving, failures, version conflicts, and teammate changes.

## 3. Key UX Decisions and Alternatives I Rejected

### 3.1 Why I chose a table instead of a full Kanban board

- One of the first decisions was how to display the opportunities.
- A Kanban board is a natural choice for a sales pipeline because each column represents a stage, and users can move opportunities between stages.
- However, the assignment involves 50,000 opportunities.Having thousands of opportunities distributed across seven columns, it would become difficult to search across all opportunities, compare deal values, identify owners, and select records across different stages.
- That's why I chose a table as the primary workspace.

The table allows users to see important information side by side:

- Customer company
- Product and quantity
- Deal value
- Sales owner
- Current stage
- Last activity
- Updated date

I still wanted to preserve the useful part of a Kanban experience, so I added a stage overview above the table. Each stage displays its opportunity count and can be clicked to filter the table.

Alternatives I considered:

- Full Kanban board: More visual, but less convenient for comparing and managing large numbers of records.
- Separate table and Kanban views: Provides flexibility, but introduces additional navigation and duplicated interaction patterns.
- Paginated table: Reduces rendering work, but interrupts continuous review and makes selecting records across pages more complicated.

My decision: A table with a stage overview gives users a simpler way to manage large datasets.

Trade-off: The table is denser and less visual than Kanban. With more time, I would consider an optional Kanban view backed by server-side queries.

### 3.2 Why I used stage arrows and a dropdown instead of drag-and-drop

When a salesperson updates an opportunity, they usually move it from one stage to another.

I could have implemented drag-and-drop, but the main interface is a large, virtualized table. Dragging rows in this environment can be difficult, especially when users are working with many records or using a keyboard.

Instead, I provided:

- Previous and next arrows: For moving an opportunity through the usual sales progression.
- Stage dropdown: For directly selecting any stage.
- Keyboard shortcuts: For navigating records and changing stages without constantly using the mouse.

This keeps stage changes explicit and easy to understand.

Alternatives I considered:

- Drag-and-drop: More visual, but harder to use with virtualization and keyboard navigation.

My decision: Combining arrows, a dropdown, and keyboard shortcuts provides both quick actions and direct control.

### 3.3 How I prevent users from losing their place after an update

There is another small but important UX problem.

The table is sorted by the most recently updated opportunity. So, when a salesperson updates a record, that record may move to a different position.

Imagine a salesperson reviewing opportunities from the top of the table:

1. They review the first four opportunities.
2. They update the fifth opportunity.
3. The updated opportunity moves to the top because its update time has changed.
4. The salesperson may lose track of which opportunity to review next.

To avoid this, I implemented two things:

- The updated row receives a temporary green highlight.
- Focus moves to the next opportunity based on the original review order.

This helps the salesperson continue reviewing records without losing their place.

### 3.4 Why I chose manual synchronization for teammate changes

I wanted to demonstrate what happens when another salesperson changes an opportunity while someone is already working on it.

For the assignment, I created a simulated API that maintains a separate copy of the data.

When a simulated teammate changes an opportunity:

- The change is applied to the simulated server-side data.
- The affected opportunity is marked as having a pending update.
- The current table is not automatically refreshed.

The user can click Sync updates when they are ready to fetch the latest data.

After synchronization, the user can use Go to active row to return to the opportunity they were reviewing.

Why not automatic refresh?

Imagine a salesperson reviewing an opportunity. If the table suddenly refreshes and rows move around, they might lose track of the record.

Manual synchronization keeps the user in control.

Alternatives I considered:

- Polling: The application periodically checks for changes.
- WebSockets: The server pushes changes to connected users.
- Automatic refresh after every teammate update: Keeps the data refreshed but can disrupt the current workflow.

These are reasonable production approaches, but they require a real backend and connected clients. For this assignment, manual synchronization was a simpler way to demonstrate the behavior.

Important limitation: This is a teammate-change simulation inside the application, not real-time collaboration between separate browsers or devices.

### 3.5 Why I used virtualization for 50,000 opportunities

Rendering 50,000 table rows at the same time would create unnecessary work for the browser.

Even though the user can only see a small portion of the table, the browser would still need to create and manage all those row elements.

I used TanStack Vue Virtual(lightweight utility library) to render only the rows around the current scroll position, along with a few extra rows.

This allows users to scroll through the dataset without mounting every row in the DOM.

Alternatives I considered:

- Render all rows: Simple to implement, but creates unnecessary DOM work.
- Pagination: Limits the number of rows displayed, but interrupts continuous scrolling.

My decision: Virtualization provides continuous scrolling while limiting the number of rendered rows.

Important distinction: The application still loads all 50,000 records into browser memory. Search, filtering, and sorting also happen on the client. Virtualization reduces DOM rendering work; this doesn't reduce the amount of data downloaded from the backend.

## 4. How I Handled Failed Saves and Teammates' Changes

I didn't want the application to behave as if every save would always succeed. In a real sales application, network delays, server failures, and simultaneous updates are normal situations.

I focused on three scenarios.

### 4.1 What happens when an individual save fails?

I used an approach called optimistic updating.

For example, suppose an opportunity is currently in New Lead and a salesperson changes it to Contacted.

Instead of making the user wait until the server responds, the application updates the interface immediately.

The row displays the new stage and indicates that the save is in progress.

This makes the application feel responsive, particularly when the network is slow.

However, there is a problem: the server might reject the update.

For example:

- The user changes New Lead to Contacted.
- The UI immediately shows Contacted.
- The API request fails because of a network or simulated server error.
- The application must not continue showing Contacted as if it were successfully saved. It should display Retry option.
- When the user clicks Retry, the application fetches the latest version of the opportunity and attempts the intended stage change again.

Why I chose this approach:

- Users don't have to wait for every save.
- The interface feels responsive.
- Failed updates are clearly identified.
- The application does not leave users believing an unsuccessful update was saved.

### 4.2 What happens when two people update the same opportunity?

This is a different problem.

Imagine two sales representatives are working on the same opportunity.

- The first salesperson changes its stage to Contacted.
- The second salesperson changes it to Lost.
- Both originally read the same version of the opportunity.

If both updates are accepted without checking the existing data, the second update could silently overwrite the first one.

To prevent that, I implemented version checking in the simulated API.

Every opportunity has a version number. When the application sends an update, it also sends the version it originally read.

The API accepts the update only if the submitted version matches the current server version.

Example:

| Step          | Salesperson A   | Salesperson B                          | Server version |
| ------------- | --------------- | -------------------------------------- | -------------- |
| Initial state | Reads version 1 | Reads version 1                        | 1              |
| First update  | Saves Contacted | —                                      | 2              |
| Second update | —               | Tries to save using old data version 1 | 2              |
| Result        | Successful      | Rejected as a conflict                 | 2              |

The second update is rejected because it was based on outdated information.

The application then:

1. Identifies the situation as an Update conflict.
2. Displays the latest server data.
3. Allows the user to click Retry.
4. Fetches the latest version and attempts the original stage change again.

Why this matters: It prevents one user's older update from silently overwriting a newer update.

What I haven't implemented: I haven't built a dedicated conflict-resolution screen where users can compare both changes and choose which one should win. The current retry flow attempts the user's original stage change against the latest version.

Also, version checking is demonstrated through the fake API. A production backend would need to enforce this check atomically in the database.

### 4.3 How I handled bulk updates and partial failures

I also wanted users to update many opportunities at once.

For example, imagine a manager selects 2,000 opportunities and wants to move them to Proposal Sent.

Sending all 2,000 updates as one large operation would make it difficult to track individual failures and provide useful progress information.

So I divided bulk updates into batches of up to 500 records.

The application processes these batches sequentially and tracks the result of each individual opportunity.

This is important because a bulk operation doesn't always have to be completely successful or completely unsuccessful.

Example:

Imagine 500 opportunities are being updated:

- 480 opportunities save successfully.
- 20 opportunities fail.

I don't want the user to repeat the entire operation just because 20 records failed.

Instead:

- The 480 successful updates remain saved.
- The 20 failed records are identified.
- The user can retry only those failed records.

I also added:

- Progress indicator: Shows how much of the operation has completed.
- Cancellation: Stops sending additional batches after the current batch finishes.
- Undo: Allows the most recent bulk change to be reversed.

How Undo works:

The application stores the previous stage and the version created by the bulk update.

When the user clicks Undo, the application checks whether each opportunity is still at that version.

- If nobody has changed it since the bulk update, the previous stage can be restored.
- If another update has happened, that record is skipped to avoid overwriting newer data.

Important limitation: Undo is a best-effort compensating update, not an atomic database transaction. If an Undo save fails, the application currently does not provide another Undo retry.

## 5. What I Would Do With More Time

The current application focuses mainly on viewing, finding, and updating opportunities.

With more time, I would improve it in two areas:

1. Product improvements: Make the application more useful for a real sales team.
   - Allow managers to create and customize pipelines
   - Add the ability to create opportunities
   - Add more customer and opportunity details
   - Improve and save filters
   - Rule-based tags to help salespeople identify opportunities that need attention(High value - Deal value is above a configured amount)

2. Technical improvements: Make the application reliable and scalable for production.
   - Better conflict resolution: Let users compare the latest server value with their intended change before deciding what to do.
   - More reliable Undo: Retain failed undo operations so they can be retried.
   - More automated tests: Cover mixed bulk failures, overlapping synchronization, undo failures, and keyboard interactions.
