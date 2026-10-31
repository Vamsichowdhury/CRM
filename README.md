# FurniCraft Sales Pipeline

A table-first sales pipeline workspace running on HighLevel for FurniCraft, a fictional B2B supplier of office chairs, office desks, conference tables, storage cabinets, and reception desks. FurniCraft is the business using the software; HighLevel is the CRM platform. It manages 50,000 potential business-customer orders with realistic bulk quantities and Indian Rupee deal values. It demonstrates virtualized data browsing, optimistic updates, explicit recovery, manual teammate synchronization, and bulk operations against a simulated in-memory API.

The first seeded example is Indigo Networks ordering 115 office chairs for ₹1,22,000, owned by Aisha Khan and currently at New Lead.

## Problem and product choices

FurniCraft's sales team needs to find furniture enquiries that have gone quiet, make safe changes even when requests fail, and act on large groups of customer orders without waiting for thousands of rows to render. The workspace puts the searchable, filterable opportunity table first. A stage strip shows each stage's share of the pipeline and filters the table when selected. Owner filtering includes a searchable dropdown.

See [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) for the reasoning and trade-offs behind the table, virtualizer, selection, optimistic updates, concurrency, and bulk operations.

## Technology and architecture

- Vue 3 Composition API and TypeScript
- Pinia stores for opportunity data, selection, and simulation controls
- TanStack Vue Virtual for table row virtualization
- Vite, Vitest, Vue Test Utils, ESLint, and Prettier
- No backend, database, authentication, or external API calls

The fake API owns an authoritative server-side `Map` separate from client state. The opportunities store owns local records, per-record sync states, optimistic updates, revisions, and API reconciliation. The selection store stores IDs only. The simulation store configures delay, failure probability, and offline mode.

## Features

- Seeded dataset of 50,000 FurniCraft business-customer opportunities generated once per page session
- Office-furniture products, order quantities, named sales owners, and Indian Rupee deal values
- Summary metrics and stage counts and percentages derived from loaded records
- Search by customer company or furniture product; filter by stage, searchable owner, deal value, and 30-day inactivity
- Sort by company, deal value, last activity, and updated time
- Move deals one stage forward or back with inline arrows; keep the dropdown for direct stage selection
- After a successful row update, briefly highlight its new position and advance focus to the next opportunity in the pre-update review order
- Keep teammate edits pending on the simulated server until the user clicks Sync updates; mark the active row and provide a Go to active row control after reordering
- TanStack virtualized rows with an overscan of eight rows
- Select rendered rows, select all matching filtered results, exclude individual IDs, and clear selection
- Optimistic stage changes with saving/saved/error/conflict states, retry, and stale-response protection
- Bulk stage changes in batches of 500, with per-record version checks, a persistent partial-failure panel, retry of failed records, and version-checked undo of successful changes
- Cancel bulk work between dispatched batches; in-flight records finish and undispatched rows are reconciled
- Teammate update simulation and network simulation controls
- Persistent light/dark theme toggle that follows system preference until the user chooses a theme
- Keyboard help: `/` focuses search, Arrow Up/Down moves rows, Left/Right changes the focused opportunity's stage, Space selects the row, and Escape clears selection

## Performance approach

Only the current viewport and eight overscan rows are mounted. Filtering and sorting operate on the in-memory array; sorting uses a copied filtered list so the base dataset order is not changed. Summary values are computed from records rather than hard-coded. The simulation keeps client and server records separate so teammate changes can wait for explicit synchronization.

The dataset is still in memory, and a filter or sort scans up to 50,000 records. This is suitable for the assignment, not a claim about a production-scale remote data architecture. For a production service, filtering, pagination, and summaries would generally be server-backed and instrumented against real workloads.

## Reliability and bulk behavior

Individual changes are optimistic. A per-record local operation revision ensures that an old response cannot replace the latest local edit, and same-record requests are serialized. Each write includes the server version it expects; if another user changes that record before the write arrives, the server rejects it and returns the latest record for review and retry. Teammate edits remain on the simulated server until the user clicks **Sync updates**, so remote changes do not continuously reorder the table. The active row remains highlighted, and **Go to active row** restores it after a sync. Failed writes restore the latest server record when available and expose a prominent retry action.

Bulk work is sent in batches of 500. A batch shares one simulated request delay, then each record is version-checked and may independently fail. Successful records remain saved when others fail. The toolbar reports progress and offers retry for failed IDs. Undo is best effort and only restores records whose versions still match the post-bulk version, so it cannot overwrite a newer edit.

## Simulation controls

Defaults are 300–1500 ms request delay and 10% save failure probability. Open **Simulation controls** below the table to adjust the failure rate or switch offline. To demonstrate a same-deal conflict, select a row, open the **Same-deal concurrency** scenario, and simulate a teammate edit. Change that deal's stage before syncing: the stale save is rejected and shown as a conflict. Use **Sync updates** to load the teammate's latest version, review it, then retry if appropriate. This simulation does not synchronize separate browser tabs or devices.

For partial bulk failures, select multiple opportunities, choose a stage, and apply the update with a nonzero failure rate. Successful records remain saved and the persistent alert shows how many records need attention. **Retry failed** sends only those IDs again. **Undo successful updates** attempts to restore the successful records, skipping any whose versions changed after the bulk save.

## Folder structure

```text
src/
  components/       Pipeline summary, virtual table, simulation panel
  services/         Seeded generator and authoritative fake API
  stores/           Opportunities, selection, simulation
  types/            Opportunity and simulation contracts
  utils/            Filtering and sorting
  App.vue           Single-page workspace
  style.css         Workspace styling
  main.ts           Vue and Pinia entry point
tests/              Service, filtering, and selection tests
```

## Local setup

Prerequisites: Node.js 20.19+ or 22.12+, and npm.

```sh
npm install
npm run dev
```

Available checks:

```sh
npm run test       # Vitest
npm run lint       # ESLint
npm run build      # TypeScript project build and Vite production build
```

## Known limitations and next steps

- State resets when the page reloads; there is no persistent backend.
- The fake API simulates concurrency in one app instance only.
- Sorting/filtering scan in-memory data and may need profiling on slower devices.
- Bulk cancellation takes effect after the current batch returns; an in-flight batch cannot be interrupted.
- Deployment and a public repository have not been created from this workspace.

Future work: add browser-level interaction coverage, a visible activity history, request cancellation, and performance measurements on target hardware before making latency claims.

## Submission links

- GitHub repository: `https://github.com/<your-account>/<repository-name>`
- Deployed application: `<add the verified Vercel or Netlify URL>`
