---
description: Tavily MCP usage — live web search, CVE checks, API doc extraction
---
# Tavily MCP — Live Web Intelligence

Tavily MCP provides four production-grade web intelligence tools via HTTP. Fills the gap between static docs and live web data — use it to ground decisions in current information, check CVEs, extract structured API docs, and look up error solutions.

**Complements codebase-memory-mcp:** code graph intelligence (local) + Tavily (external/live). Together they cover both surfaces.

## Available Tools

| Tool | Use for |
|------|---------|
| `tavily-search` | Real-time web search — current docs, error solutions, CVEs, release notes |
| `tavily-extract` | Pull structured content from a specific URL — API docs, changelogs, specs |
| `tavily-map` | Map a site's architecture — useful before implementing integrations |
| `tavily-crawl` | Systematic crawl — index a service's doc site for deep research |

## Always Do

- **Run `tavily-search` before implementing any third-party integration** — check current API docs, not training-data snapshots
- **Check CVEs before adding a new dependency:** `tavily-search "<package> CVE vulnerability"`
- **Look up unfamiliar errors before guessing:** `tavily-search "<error message> fix"`
- **Extract live pricing/limits before hardcoding:** `tavily-extract <vendor-url>`

## Setup (one-time)

```bash
source ~/.secrets && claude mcp add --transport http tavily "https://mcp.tavily.com/mcp/?tavilyApiKey=$TAVILY_API_KEY"
```

Key stored in `~/.secrets` as `TAVILY_API_KEY`. Free tier: 1,000 searches/month.