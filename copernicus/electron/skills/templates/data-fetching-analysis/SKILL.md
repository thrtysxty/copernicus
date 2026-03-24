Use when adding or modifying data access layers, specifically SQLite query patterns, or fetching event data in {{PROJECT_NAME}}.

## Instructions

When working in {{REPO_ROOT}} with {{STACK}} on data fetching and analysis:
1. All database access must be encapsulated within the `StateLedger` class methods (`electron/db/state-ledger.ts`).
2. Do not use raw SQLite queries or access the db outside `StateLedger`.
3. Ensure you follow standard data shapes for events and memory retrieval.
4. When writing IPC handlers for data fetching, use the envelope `{ ok: boolean, data?: T, error?: string }` via `handleIpc`.

## Notes

- Examples of data fetching include `db:get-events` or `db:search-memory` IPC calls.
- Familiarize yourself with the database schema and add necessary migrations when changing shapes.
