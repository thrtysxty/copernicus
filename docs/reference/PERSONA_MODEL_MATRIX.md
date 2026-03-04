# Copernicus Persona & Model Matrix (Hybrid Cloud/Local)
**Last Updated:** Wednesday, March 4, 2026
**Architecture:** Cloud-First with Local Tactical Fallback (Dell R210ii)

This document outlines the available sub-agent personas and their underlying model mappings for testing and development.

---

## ☁️ 1. High-Intelligence Tier (Ollama Cloud)
*Zero local RAM usage. Heavy lifting is offloaded to Ollama's high-end infrastructure.*

| Persona | Command | Model Tag | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **Researcher** | `/researcher` | `deepseek-v3.2:cloud` | Deep logical reasoning, "thinking-in-tool-use," and technical exploration. |
| **Architect** | `/architect` | `glm-5:cloud` | Massive system design (744B), schema planning, and long-horizon planning. |
| **Engineer** | `/engineer` | `devstral-2:123b:cloud` | Purpose-built for software agents. Exploring large repos and multi-file editing. |
| **Thinker** | `/thinker` | `kimi-k2.5:cloud` | Native multimodal reasoning and complex problem-solving with "thinking modes." |
| **Coder** | `/coder` | `qwen3-coder-next:cloud` | Optimized agentic coding workflows and high-precision refactoring. |
| **Polymath** | `/polymath` | `qwen3.5:cloud` | Versatile generalist family delivering exceptional utility across all technical tasks. |
| **Logistician** | `/logistician` | `minimax-m2.5:cloud` | Optimized for real-world productivity and elevating high-efficiency coding. |
| **Speedster** | `/speedster` | `gemini-3-flash:cloud` | Frontier intelligence built for speed. Rapid iteration in high-intel environments. |
| **Expert** | `/expert` | `cogito-2.1:cloud` | High-level architectural documentation and complex generative tasks (671B). |
| **Sentinel** | `/sentinel` | `devstral-small-2:24b:cloud` | Security auditing, dependency analysis, and agentic bug hunting. |

---

## 🏠 2. Tactical Sidekick Tier (Dell Local)
*Running on Dell R210ii CPU. Optimized for speed and low footprint (1.5B - 3B params).*

| Persona | Command | Model Tag | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **The Scribe** | `/scribe` | `qwen2.5-coder:1.5b` | Writing docstrings, markdown reports, and logging session successes/errors. |
| **Junior Dev** | `/junior-dev` | `qwen2.5-coder:1.5b` | Implementing small, isolated functions and unit tests (TDD). |
| **UI Developer** | `/ui-dev` | `qwen2.5:3b` | Adjusting Tailwind classes, React components, and Phosphor UI details. |
| **Reviewer** | `/code-reviewer` | `phi3:mini` | Fast syntax checking and adherence to `handleIpc` standards. |

---

## 🧩 3. Embedding Tier (Local RAG)
*Optimized models for semantic search and codebase understanding.*

| Model | Size | Best For | Status |
| :--- | :--- | :--- | :--- |
| **`qwen3-embedding:0.6b`** | 600M | **Default Indexer.** High logical accuracy for code RAG. | ACTIVE |
| **`bge-m3`** | 567M | Multilingual repos and structural code patterns. | Standby |
| **`embeddinggemma`** | 300M | Real-time semantic lookup and low-resource devices. | Standby |

---

## 🌐 4. Frontier Cloud Tier (Native API)
*Managed through the Copernicus Model Registry. Requires individual API keys.*

| Provider | Model ID | context Window | Best For |
| :--- | :--- | :--- | :--- |
| **Anthropic** | `claude-3-5-sonnet-latest` | 200k | **Default Choice.** High-intel coding and complex refactoring. |
| **Google** | `gemini-1.5-pro` | 1M - 2M | Massive codebase ingestion and long-horizon planning. |
| **OpenAI** | `gpt-4-turbo` | 128k | Balanced performance and broad tool compatibility. |

---

## 🧪 Testing Scenarios

### A. Infrastructure Stress Test
1.  **Command:** `python3 scripts/ollama_tool_shim.py "/architect Create a blueprint for a new billing module."`
2.  **Expected Result:** Dell server RAM should stay low (~17MB) while it fetches the response from Ollama Cloud.

### B. Local "Sidekick" Performance
1.  **Command:** `python3 scripts/ollama_tool_shim.py "/scribe Document the existing App.tsx logic."`
2.  **Expected Result:** Fast response from local CPU inference using the 1.5B model.

### C. Hybrid Fallback (Manual)
1.  Disconnect internet.
2.  **Command:** `OLLAMA_MODEL="mistral:latest" python3 scripts/ollama_tool_shim.py "Verify local offline mode."`
3.  **Expected Result:** Dell server spins up the pre-pulled 7B Mistral model (local fallback).

---

## 🛠️ Operational Protocol (STRICT)
All sub-agents follow the **Industrial Execution Protocol**:
1.  **No Advice:** No general programming tutorials.
2.  **No Placeholders:** No `// ... rest of code`. Full implementation only.
3.  **Tool-First:** If info is missing, use `read_file` or `search_codebase` immediately.
4.  **Surgical:** Target only the specific files provided in the prompt.
