# HighLevel Sales Pipeline

A table-first sales pipeline workspace for a 20-person B2B sales team managing 50,000 opportunities. It demonstrates virtualized data browsing, optimistic updates, version conflicts, explicit recovery, and bulk operations against a simulated in-memory API.

## Problem and product choices

Sales teams need to find deals that have gone quiet, make safe changes even when requests fail, and act on large groups of records without waiting for thousands of cards to render. The workspace puts the searchable, filterable opportunity table first. A compact stage strip gives a visual pipeline overview and filters the table when selected.

See [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) for the reasoning and trade-offs behind the table, virtualizer, selection, optimistic updates, concurrency, and bulk operations.

## Technology and architecture

- Vue 3 Composition API and TypeScript
- Pinia stores for opportunity data, selection, and simulation controls
- TanStack Vue Virtual for table row virtualization
- Vite, Vitest, Vue Test Utils, ESLint, and Prettier
- No backend, database, authentication, or external API calls

The fake API owns an authoritative server-side `Map` separate from client state. The opportunities store owns local records, per-record sync states, optimistic updates, revisions, and API reconciliation. The selection store stores IDs only. The simulation store configures delay, failure probability, and offline mode.

## Features

- Seeded dataset of 50,000 opportunities generated once per page session
- Summary metrics and stage counts derived from the loaded records
- Search by company or opportunity; filter by stage, owner, deal value, and 30-day inactivity
- Sort by company, deal value, last activity, and updated time
- TanStack virtualized rows with an overscan of eight rows
- Select rendered rows, select all matching filtered results, exclude individual IDs, and clear selection
- Optimistic stage changes with saving/saved/error/conflict states, retry, and stale-response protection
- Bulk stage changes in batches of 500, with per-record partial failure status, retry of failures, and version-checked undo
- Cancel bulk work between dispatched batches; in-flight records finish and undispatched rows are reconciled
- Teammate update simulation and network simulation controls
- Persistent light/dark theme toggle that follows system preference until the user chooses a theme
- Keyboard help: `/` focuses search, Arrow Up/Down moves focused rows, Space toggles selection, Escape clears selection

## Performance approach

Only the current viewport and eight overscan rows are mounted. Filtering and sorting operate on the in-memory array; sorting uses a copied filtered list so the base dataset order is not changed. Summary values are computed from records rather than hard-coded. The simulation stores client and server records separately to make conflict checks meaningful.

The dataset is still in memory, and a filter or sort scans up to 50,000 records. This is suitable for the assignment, not a claim about a production-scale remote data architecture. For a production service, filtering, pagination, and summaries would generally be server-backed and instrumented against real workloads.

## Reliability and bulk behavior

Individual changes are optimistic. A per-record operation revision ensures that an old response cannot replace the latest local edit. Same-record requests are serialized and obtain the latest server version before applying the next requested stage. A version mismatch returns the authoritative record; the UI reconciles to it and exposes a retry action. Retrying re-applies the user's intended stage on top of the newest version.

Bulk work is sent in batches of 500. A batch shares one simulated request delay, then each record is independently version-checked and may fail. Successful records remain saved when others fail. The toolbar reports progress and offers retry for failed IDs. Undo is best effort and applies only when each record still matches the version observed after the bulk update; changed records are skipped instead of overwritten.

## Simulation controls

Defaults are 300–1500 ms request delay and 10% save failure probability. Use the controls at the bottom of the workspace to adjust failure rate or switch offline. The header action simulates a teammate editing one record. This models concurrent writes through a shared frontend service; it does not synchronize separate browser tabs or devices.

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
