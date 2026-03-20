---
name: ledger-query
description: Use when asked about model costs, token usage, session spend, story cost breakdown, or agent activity. Queries the Copernicus SQLite ledger directly via the scripts in this skill's scripts/ folder.
---

# ledger-query

Provides cost and activity analysis from the Copernicus SQLite ledger.

The ledger lives at: `copernicus/data/copernicus.db` (or `$COPERNICUS_DB_PATH` if set).

## Available queries

Run the scripts in `scripts/` directly. Pass `--help` to any for options.

| Script | What it answers |
|---|---|
| `scripts/session_cost.py` | Total cost + tokens for the current or a named session |
| `scripts/story_cost.py <story_id>` | All model calls attributed to a story, with per-model breakdown |
| `scripts/daily_cost.py [--days 7]` | Daily spend heatmap for the last N days |
| `scripts/top_models.py` | Cost and call count ranked by model |
| `scripts/cache_rate.py` | Cache hit rate by session or all-time |

## IPC alternative (when inside Copernicus session)

If running inside Copernicus, prefer IPC over direct SQLite:
- `ledger:session-stats` — current session tokens + cost
- `ledger:cost-by-story` — story-level breakdown
- `ledger:daily-costs` — heatmap data
- `ledger:cost-by-model` — model leaderboard
- `ledger:all-time-cost` — lifetime total

## Gotchas

- The DB file is locked while Copernicus is running — use WAL mode queries (`PRAGMA journal_mode=WAL`) or the IPC path to avoid blocking
- `model_calls` table has a `prompt_id` column (nullable until Epic 013 Story 443 ships) — filter `WHERE prompt_id IS NOT NULL` for correlated queries only
- Cost figures are in USD. `input_tokens` includes cache creation tokens; `cache_read_tokens` are charged at ~10% of input rate
