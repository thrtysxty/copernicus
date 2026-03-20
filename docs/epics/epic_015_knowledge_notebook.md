# Epic 015: Knowledge Notebook — Document Ingestion & Citation Q&A

**Status:** PLANNED — POST-LAUNCH
**Priority:** P2
**Phase:** Sovereign Intelligence

## Narrative

**As a** developer using Copernicus,
**I want** to add arbitrary documents — PDFs, URLs, markdown files, plain text — to a project-scoped notebook and ask questions that return answers grounded to specific source passages,
**So that** I can reason over specs, RFCs, vendor docs, and design documents alongside my codebase without leaving the IDE or relying on fragile browser automation.

---

## Context

The notebooklm-mcp project (github.com/PleasePrompto/notebooklm-mcp) provides this capability via Puppeteer automation of the NotebookLM web UI — no official API, requires a Google account and a visible display, breaks on any UI update. It is not a viable long-term dependency.

Copernicus already has the infrastructure this needs:
- **RAG pipeline** (`RagInjector.ts`, vector search, LSP-guided chunking)
- **Provider system** (all LLM providers wired, including local Ollama)
- **IPC / AuthManager** (credential isolation, IPC contract)
- **Epic 009 Hindsight** (long-term memory — notebook banks map naturally to Hindsight `bank_id`)

What is missing is the document-facing half: ingestion, source management UI, passage attribution, and optionally audio synthesis.

---

## Goals

1. Ingest arbitrary sources (PDF, URL, Markdown, plain text) into a project-scoped notebook with chunking and vector embedding.
2. Surface a **Notebook panel** in the IDE where sources can be added, viewed, and removed, and questions answered with inline citations (passage + source + page/line offset).
3. Route notebook Q&A through the existing provider system — Ollama for on-prem sovereign use, cloud providers optional.
4. Optionally synthesize an audio overview (TTS) of notebook content — lower priority, architecturally isolated from core feature.
5. Integrate with Epic 009 Hindsight when it lands: each notebook becomes a Hindsight memory bank, enabling `reflect` synthesis across sessions.

---

## What This Is NOT

- A port or dependency on notebooklm-mcp — native implementation only.
- A replacement for codebase RAG (RagInjector.ts) — that indexes the repo; this indexes external documents.
- A cloud-hosted service — all ingestion and inference runs on the local/R620 stack.

---

## Sub-Stories

| Story | Title | Depends On |
|-------|-------|------------|
| 470 | Document ingestion pipeline: PDF (pdfminer/pypdf), URL (readability extract), plain text/markdown | — |
| 471 | Notebook store + IPC: `notebooks:create`, `notebooks:add-source`, `notebooks:remove-source`, `notebooks:list`, `notebooks:get` | 470 |
| 472 | Notebook panel UI: source list, add-source dialog, source status chips (indexing / ready / error) | 471 |
| 473 | Citation Q&A: RAG query against notebook vectors → answer with passage excerpts + source attribution | 471 |
| 474 | Chat panel integration: `@notebook:<name>` mention routes query to notebook RAG context | 473 |
| 475 | Hindsight bank wiring (post-Epic 009): map each notebook to a Hindsight `bank_id`; use `reflect` for synthesis | 471, Epic 009 |
| 476 | Audio overview (P3): TTS synthesis of notebook summary via local TTS engine (Piper / Coqui) | 473 |

470 is the only independent story — start there.
471–473 run in sequence.
474, 475, 476 are parallel post-473.
476 is lowest priority and may ship in a later phase.

---

## Architecture

### Ingestion Pipeline (Story 470)

```
Source URL / PDF / file
        │
        ▼
  Extractor (by type)
  ├── PDF → pdfminer-six → page-aware text chunks
  ├── URL → readability-lxml → article body, title, canonical URL
  └── Plain text / Markdown → direct chunk
        │
        ▼
  Chunker (512-token sliding window, 64-token overlap)
        │
        ▼
  Embedder (Ollama nomic-embed-text or sentence-transformers)
        │
        ▼
  SQLite-vec / chroma → stored with (notebook_id, source_id, chunk_index, offset)
```

### Citation Q&A (Story 473)

```
User query
    │
    ▼
Embed query → cosine similarity search → top-K chunks
    │
    ▼
Grounded prompt: "Answer using ONLY the passages below. Cite [Source N, p. X]."
    │
    ▼
LLM (Ollama / provider) → answer + inline citations
    │
    ▼
Renderer: answer text + expandable citation cards
```

### Notebook IPC Channels (Story 471)

| Channel | Direction | Payload |
|---------|-----------|---------|
| `notebook:create` | invoke | `{ name, projectId }` → `NotebookRecord` |
| `notebook:list` | invoke | `{ projectId }` → `NotebookRecord[]` |
| `notebook:add-source` | invoke | `{ notebookId, type, uri }` → `SourceRecord` |
| `notebook:remove-source` | invoke | `{ notebookId, sourceId }` |
| `notebook:query` | invoke | `{ notebookId, query, topK? }` → `CitationAnswer` |
| `notebook:source-status` | push | `{ sourceId, status: 'indexing'\|'ready'\|'error', progress? }` |

### Schema (new tables)

```sql
CREATE TABLE notebooks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT,
  created_at INTEGER
);

CREATE TABLE notebook_sources (
  id TEXT PRIMARY KEY,
  notebook_id TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
  type TEXT CHECK(type IN ('pdf','url','text','markdown')),
  uri TEXT,
  title TEXT,
  status TEXT DEFAULT 'pending',
  indexed_at INTEGER,
  chunk_count INTEGER
);

CREATE TABLE notebook_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES notebook_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  content TEXT,
  offset_start INTEGER,
  offset_end INTEGER,
  embedding BLOB  -- float32 array, sqlite-vec compatible
);
```

---

## Frozen Surfaces

- `RagInjector.ts` and codebase RAG pipeline — notebook RAG is a parallel system; do NOT modify the codebase indexer.
- Existing `project_memory` / `context_snapshots` tables — notebook schema is additive only.
- `ChatPanel` — Story 474 adds `@notebook:` mention handling; no other ChatPanel changes.

---

## Acceptance Criteria (Epic Level)

- [ ] A PDF dropped into the Notebook panel is chunked, embedded, and marked `ready` within 30s for a 50-page document on the local stack.
- [ ] A URL source fetches the article body (not raw HTML), chunks it, and indexes it.
- [ ] Q&A response cites at least one source passage with `[Source N, p. X]` format.
- [ ] `@notebook:my-notebook` in ChatPanel scopes the RAG context to that notebook.
- [ ] Removing a source deletes all its chunks and embeddings from the vector store.
- [ ] Audio overview (Story 476) is behind a feature flag and does not affect Story 473 delivery.
- [ ] `tsc --noEmit` clean; `pytest` green.

---

## Out of Scope

- Google account or cloud API dependency of any kind.
- Replacing or merging with codebase RAG (RagInjector.ts).
- Real-time collaborative notebooks (future).
- Skill marketplace distribution of notebooks (Epic 010 scope).

---

## Documentation Impact

- `docs/reference/TECHNICAL_BIBLE.md` — add "Notebook RAG" section: IPC contract, schema, citation format standard.
- `docs/reference/UX_BIBLE.md` — add Notebook panel layout spec.
