## Story Authoring Protocol — Verify Before You Write

**Every AC that references existing code must be grounded in verified reality, not assumption.**

### Before writing any story AC, you MUST verify:

| AC references | Verification required |
|---|---|
| A DB table or column | Read the `CREATE TABLE` statement from `db.mjs` or the migration file |
| A function or export | Grep for it — confirm name, signature, and file |
| An IPC channel | Check `preload.ts` SEND_CHANNELS and the handler file |
| A file path | Confirm the file exists — read it if the AC describes its contents |
| A type or interface | Read the type definition — do not invent field names |
| An existing column to "repurpose" | Read how it is currently written by all callers |

### Hard rules

- **NEVER write SQL in an AC without running the query or reading the schema first.** Column names in ACs are a specification — agents implement exactly what is written.
- **NEVER reference a function signature you have not read.** If you think `hub.mint()` takes certain parameters, read `hub.mjs` first.
- **NEVER write "no schema changes — table already exists" without verifying the table schema matches what the AC requires.** This is the failure mode that caused story 643.
- **NEVER describe a frozen surface without reading it.** Frozen means what is there now — not what you expect to be there.

### The cost of skipping this

An agent implements against a false AC. The mismatch surfaces mid-implementation. The agent escalates. The story is retrofitted. Token cost, time cost, and Jeremy's trust — all spent on a failure that a single `grep` or `Read` would have prevented.

**The tools exist. Use them before authoring, not after the agent finds the problem.**
