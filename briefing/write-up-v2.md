# FurniCraft Sales Pipeline

### HighLevel R1 Engineering Assignment – Interview Write-up

## 1. What I Built and Why

I built a sales pipeline management application for a fictional company called FurniCraft, which sells office furniture in bulk to other businesses.

I chose the furniture business because it makes the sales process easy to understand.

### What the application does

The application contains 50,000 sample sales opportunities. Each opportunity includes:

- Customer company: The business interested in purchasing furniture.
- Opportunity: The particular order being discussed.
- Product and quantity: What the customer wants to purchase and how many units.
- Deal value: The estimated order value in Indian rupees.
- Owner: The FurniCraft sales representative responsible for following up.
- Stage: The current status of the opportunity.

Example opportunity:

| Field      | Value           |
| ---------- | --------------- |
| Customer   | Indigo Networks |
| Product    | Office Chairs   |
| Quantity   | 115 units       |
| Deal Value | ₹1,22,000       |
| Owner      | Aisha Khan      |
| Stage      | New Lead        |

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

I used Vue 3, TypeScript, Pinia, and TanStack Vue Virtual to build the application.

The application has a simulated API that behaves like a backend. It maintains a separate copy of the opportunity data, allowing me to demonstrate saving, failures, version conflicts, and teammate changes.

### Technology choices

| Technology              | Why I used it                                                                  |
| ----------------------- | ------------------------------------------------------------------------------ |
| Vue 3                   | Component-based UI and Composition API for organizing application logic.       |
| TypeScript              | Better type safety for opportunities, stages, and API operations.              |
| Pinia                   | Shared state management across the table, filters, overview, and bulk actions. |
| TanStack Vue Virtual    | Renders only visible rows instead of mounting all 50,000 rows.                 |
| Vite                    | Development server and build tooling.                                          |
| Vitest + Vue Test Utils | Testing application logic, stores, and components.                             |

## 3. Key UX Decisions and Alternatives I Rejected

### 3.1 Why I chose a table instead of a full Kanban board

One of the first decisions was how to display the opportunities.

A Kanban board is a natural choice for a sales pipeline because each column represents a stage, and users can move opportunities between stages.

However, the assignment involves 50,000 opportunities.

Having thousands of opportunities distributed across seven columns, it would become difficult to search across all opportunities, compare deal values, identify owners, and select records across different stages.

That's why I chose a table as the primary workspace.

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

This was one of the most important parts of the implementation.

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
- The application must not continue showing Contacted as if it were successfully saved.

To handle this, I implemented the following flow:

\#chatgpt-mermaid-\_r_20v\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_20v\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_20v\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_20v\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_20v\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_20v\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_20v\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_20v\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_20v\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_20v\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_20v\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_20v\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_20v\_ p{margin:0;}#chatgpt-mermaid-\_r_20v\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_20v\_ .label text,#chatgpt-mermaid-\_r_20v\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ .node rect,#chatgpt-mermaid-\_r_20v\_ .node circle,#chatgpt-mermaid-\_r_20v\_ .node ellipse,#chatgpt-mermaid-\_r_20v\_ .node polygon,#chatgpt-mermaid-\_r_20v\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ .rough-node .label text,#chatgpt-mermaid-\_r_20v\_ .node .label text,#chatgpt-mermaid-\_r_20v\_ .image-shape .label,#chatgpt-mermaid-\_r_20v\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_20v\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ .rough-node .label,#chatgpt-mermaid-\_r_20v\_ .node .label,#chatgpt-mermaid-\_r_20v\_ .image-shape .label,#chatgpt-mermaid-\_r_20v\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_20v\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_20v\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_20v\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_20v\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_20v\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_20v\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_20v\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_20v\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_20v\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_20v\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_20v\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_20v\_ .icon-shape,#chatgpt-mermaid-\_r_20v\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_20v\_ .icon-shape p,#chatgpt-mermaid-\_r_20v\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_20v\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_20v\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_20v\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_20v\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_20v\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_20v\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_20v\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_20v\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_20v\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_20v\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_20v\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_20v\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_20v\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_20v\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_20v\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_20v\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ .node rect,#chatgpt-mermaid-\_r_20v\_ .node circle,#chatgpt-mermaid-\_r_20v\_ .node ellipse,#chatgpt-mermaid-\_r_20v\_ .node polygon,#chatgpt-mermaid-\_r_20v\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_20v\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_20v\_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_20v\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_20v\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_20v\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}User changes opportunitystageUpdate UI immediatelyShow Saving stateSend API requestSave successful?Keep updated valueShow error stateFetch latest available serverdataRestore consistent UI stateOffer RetryYesNo

Why I chose this approach:

- Users don't have to wait for every save.
- The interface feels responsive.
- Failed updates are clearly identified.
- The application does not leave users believing an unsuccessful update was saved.

When the user clicks Retry, the application fetches the latest version of the opportunity and attempts the intended stage change again.

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
2. Technical improvements: Make the application reliable and scalable for production.

### 5.1 Product improvements

#### 1. Allow managers to create and customize pipelines

Different types of sales might follow different processes.

For example, a new furniture enquiry and a repeat customer order might not need exactly the same stages.

I would allow managers to:

- Create multiple pipelines.
- Define custom stages.
- Change the order of stages.
- Assign opportunities to different pipelines.

#### 2. Add the ability to create opportunities

Currently, the application focuses on managing generated opportunities.

I would add a form to create new opportunities with details such as:

- Customer company.
- Product and quantity.
- Estimated deal value.
- Sales owner.
- Current stage.
- Expected closing date.
- Next action.

#### 3. Add more customer and opportunity details

A sales representative often needs more than just the deal value and stage.

I would add:

- Customer contact details.
- Notes and comments.
- Call and email history.
- Delivery location.
- Installation requirements.
- Other details needed to fulfill the order.

#### 4. Improve filters and saved views

I would add filters for:

- Product.
- Quantity.
- Expected closing date.
- Delivery city.
- Tags.
- Recent activity.

I would also allow users to save frequently used filters.

For example, a salesperson could save a view called Large chair orders that need follow-up and access it whenever needed.

#### 5. Add smart tags

I would introduce rule-based tags to help salespeople identify opportunities that need attention.

Examples:

| Tag               | Condition                                               |
| ----------------- | ------------------------------------------------------- |
| High value        | Deal value is above a configured amount.                |
| Needs follow-up   | No activity for 30 days.                                |
| Closing soon      | Expected closing date is approaching.                   |
| Large chair order | Opportunity contains a large quantity of office chairs. |

I would also show users why a tag was applied instead of making the classification feel like a black box.

### 5.2 Technical and production improvements

- Better conflict resolution: Let users compare the latest server value with their intended change before deciding what to do.
- More reliable Undo: Retain failed undo operations so they can be retried.
- More automated tests: Cover mixed bulk failures, overlapping synchronization, undo failures, and keyboard interactions.
