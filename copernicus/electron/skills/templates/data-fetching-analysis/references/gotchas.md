# Known Failure Patterns

- **NULL column not handled**
  - **Symptom:** UI crashes with "Cannot read properties of null".
  - **Cause:** Selecting nullable columns from SQLite without providing default values or handling null states in TypeScript.
  - **Fix:** Map database records to strongly-typed TypeScript interfaces and handle nullable fields explicitly.

- **Date format mismatch between SQLite and JS**
  - **Symptom:** Invalid dates rendered in UI, sort ordering incorrect.
  - **Cause:** SQLite stores dates as ISO-8601 strings or epoch integers, but JS `Date` constructor expects a specific string format.
  - **Fix:** Always store dates consistently (ISO string preferred) and parse them explicitly before sending them over IPC.

- **Missing index causing slow queries**
  - **Symptom:** App slows down when fetching historical data or searching memory.
  - **Cause:** Queries perform full table scans on large tables (e.g. `agent_work_log` or `retro_reports`).
  - **Fix:** Ensure indexes are created in schema migrations for frequently searched or filtered columns.
