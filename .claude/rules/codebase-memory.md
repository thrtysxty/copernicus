---
description: codebase-memory-mcp usage — blast-radius analysis required before any symbol edit
---
<!-- codebase-memory-mcp:start -->
# codebase-memory-mcp — Code Intelligence

This project is indexed by codebase-memory-mcp v0.5.4 (MIT, DeusData). Single static binary, 64-language tree-sitter, SQLite persistence at `~/.cache/codebase-memory-mcp/`, sub-millisecond queries. Project key: `Users-dadmin-Projects-agentic-platform`.

> If the MCP server is not responding, re-index: `codebase-memory-mcp cli index_repository '{"repo_path":"/Users/dadmin/Projects/agentic-platform","name":"agentic-platform"}'`

## Always Do

- **MUST run blast-radius analysis before editing any symbol.** Before modifying a function, class, or method, run `trace_call_path` (direction: `inbound`) and report direct callers and risk to the user.
- **MUST run `detect_changes` before committing** to verify changes only affect expected symbols.
- **MUST warn the user** if blast radius returns more than 5 direct callers before proceeding.
- When exploring unfamiliar code, use `search_graph` to find symbols by name/pattern — faster and more precise than grepping.
- For full context on a symbol (callers, callees, imports), use `get_code_snippet` + `trace_call_path`.

## When Debugging

1. `search_graph` — find symbols related to the error by name or pattern
2. `trace_call_path` (direction: `both`, depth: 2) — see all callers and callees
3. `get_architecture` (aspects: `["overview","hotspots"]`) — check structural context and hotspots
4. `detect_changes` — see what your branch changed vs main

## When Refactoring

- **Before editing:** `trace_call_path` (inbound, depth: 2) — find all callers
- **Before committing:** `detect_changes` to verify only expected files changed
- **For renames:** use `search_graph` to find all uses, then update manually (no rename tool — story 449 filed)
- **For extractions:** `trace_call_path` (outbound) to find all callees before moving code

## Never Do

- NEVER edit a function or class without first running `trace_call_path` (inbound) on it.
- NEVER ignore blast-radius results with more than 5 direct callers without user confirmation.
- NEVER commit without running `detect_changes` to check affected scope.

## Tool Quick Reference

| Tool | When to use |
|------|-------------|
| `search_graph` | Find symbols by name/pattern |
| `trace_call_path` | Caller/callee traversal, blast radius |
| `detect_changes` | Pre-commit scope check (git diff → symbols) |
| `query_graph` | Custom Cypher-like graph queries |
| `get_code_snippet` | Retrieve code by qualified symbol name |
| `get_architecture` | Codebase overview, hotspots, entry points |
| `search_code` | Full-text search within indexed source files |
| `index_repository` | Trigger re-index after large changes |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `trace_call_path` (inbound) was run for all modified symbols
2. No high blast-radius warnings were ignored
3. `detect_changes` confirms changes match expected scope

## CLI

- Re-index: `codebase-memory-mcp cli index_repository '{"repo_path":"/Users/dadmin/Projects/agentic-platform","name":"agentic-platform"}'`
- Check status: `codebase-memory-mcp cli index_status '{"project":"Users-dadmin-Projects-agentic-platform"}'`
- Architecture: `codebase-memory-mcp cli get_architecture '{"project":"Users-dadmin-Projects-agentic-platform","aspects":["overview"]}'`

<!-- codebase-memory-mcp:end -->