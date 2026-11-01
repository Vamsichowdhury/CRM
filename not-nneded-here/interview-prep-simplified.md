# 12. Interview Preparation: Explaining the Project Clearly

Use these answers as a guide. It is better to explain the user problem, describe what the application actually does, and then mention its limitation than to use technical terms without context.

## Product and user experience

### What problem does the application solve?

It helps FurniCraft sales representatives find and update a large number of potential furniture orders. They can see the customer, product, quantity, deal value, owner, and stage in one place. It also helps them recover from failed saves and avoid losing their place when the table changes after an update.

### What is an opportunity?

An opportunity is one possible order being tracked by the sales team. For example, Indigo Networks considering 115 office chairs worth ₹1,22,000 is one opportunity. It has an assigned sales representative and moves through the sales stages until it is won or lost.

### Why did you choose a table instead of Kanban?

The application needs to handle 50,000 opportunities. A table makes it easier to search, compare values, check owners, sort, and select records across stages. The stage overview above the table still gives users a quick view of the pipeline.

The trade-off is that a table is less visual and can feel crowded. A separate Kanban view could be considered after testing with real sales users.

### How does the application help users keep their place?

The table is sorted by recently updated records, so a saved row can move. The application briefly highlights the changed row and moves focus to the next record based on the order from before the update.

## Technology and application structure

### Why Vue, TypeScript, and Pinia?

Vue is used to build the screen from smaller components. TypeScript helps keep opportunity data and stage changes in the correct format. Pinia keeps shared information in one place so the table, filters, overview, and bulk actions stay in sync.

### Why is there a simulated API?

The assignment needs to demonstrate slow saves, failed saves, and changes made by another user. The simulated API behaves like a small backend and keeps its own copy of the records. This makes it possible to show those situations without building a real server.

### How does data get from the server to the screen?

The application loads a copy of the records when it starts. The table and summary use that copy. When a user makes a change, the store sends it to the simulated API and then updates the screen based on the response.

## Performance

### How can the application show 50,000 opportunities?

It does not create all 50,000 table rows on the page at once. It uses virtualization to create only the rows near the user's current scroll position. This reduces the browser work needed to display the table.

### Does virtualization mean the application only loads a few records?

No. All 50,000 records are still loaded into browser memory. Virtualization reduces the number of visible page elements. Search, filtering, sorting, and summary calculations still work on the full loaded dataset.

### Have you measured the performance improvement?

No browser benchmark is recorded, so I would not claim a specific speed improvement. I can explain that virtualization limits the number of mounted rows, and I would measure search time, rendering, memory, sync time, and bulk-update duration before making a numerical claim.

## Saving and reliability

### What is an optimistic update?

It means the screen shows the user's change immediately instead of waiting for the server. The row is marked as saving. If the server accepts the change, it stays. If the save fails, the application restores the latest available data and shows an error or conflict.

### What happens if two people change the same opportunity?

Each opportunity has a version number. A save is accepted only if the version sent by the user matches the latest server version. If another person has already saved a newer version, the older save is rejected instead of silently overwriting the newer change.

### Is this real multi-user collaboration?

No. The fake API demonstrates how a conflict can happen, but it is an in-memory simulation inside one application. A real product needs a shared backend and database that check versions safely across users and devices.

### What happens when a bulk update partly fails?

Successful records stay saved. Failed records are listed and can be retried without sending the successful records again. This avoids making the user repeat the entire operation.

### How does cancellation work?

The current group of up to 500 records is allowed to finish. The application then stops sending more groups and reconciles records that were not sent. It cannot undo a change that the server has already accepted.

### How does Undo protect another person's change?

Undo checks the version of each record. If the record has changed since the bulk update, it is skipped rather than overwriting the newer change. Undo is best-effort and is not one all-or-nothing transaction.

## What would you improve next?

I would first fix the gap between the 20-representative requirement and the seven owners currently generated. I would then add deterministic tests for mixed bulk failures, Undo failures, and overlapping sync. For a production version, I would replace the simulated API with a real backend, add authentication and permissions, move search and filtering to the server, and make Undo failures retryable.

# 13. Five Things to Explain Accurately

1. **It is a prototype:** The API is simulated and stores data in memory. There is no production database or authentication.
2. **It is not real-time collaboration:** Teammate changes are simulated in one application and appear after the user manually syncs.
3. **Bulk updates are sent in groups:** The application sends sequential groups of up to 500 records. It does not send 500 separate requests at the same time.
4. **Virtualization only reduces table rendering work:** All records are still loaded into memory, and search, filtering, sorting, and sync still work on the full dataset.
5. **Performance has not been benchmarked:** Describe what the implementation does, but do not claim a measured speed improvement without test results.
