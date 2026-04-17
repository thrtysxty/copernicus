# Harbor-Style Containerized Agent Sandboxing Spike

**Story:** 633
**Date:** 2026-04-17
**Type:** Research Spike

## TL;DR: Go/No-Go Verdict

**Verdict for ML350 Gen9 Production Model Server:** **GO**
**Verdict for Dev Workstation Agent Sandboxing:** **NO-GO**

### Rationale
Harbor (`av/harbor`) is a Docker Compose orchestrator designed to manage local LLM stacks (Ollama, vLLM, Open WebUI, searxng). It excels at managing interconnected model services via a central network (`harbor-network`) and providing switchable service profiles.

However, **Harbor is not a generic agent worktree sandboxing tool.** Using Harbor on a local dev machine to spin up a transient Claude Code process to edit a local git worktree is shoehorning. Harbor is meant for long-running infrastructure, not ephemeral task runners.

**The Reframed Path Forward:**
1. **Production Inference Server (ML350 Gen9):** Use Harbor here. Deploy it to orchestrate Ollama, vLLM, and the CCR router. The local dev workstation will route LLM requests to this centralized ML350 server over the LAN.
2. **Dev Workstation (Local Agent Isolation):** Do not use Harbor. Instead, use a lightweight, plain Docker workflow. When dispatching a local agent, spin up a minimal container (e.g., node alpine) that mounts the specific git worktree (`-v .agent-worktrees/story-NNN:/work`) and connects to the daemon.

---

## Socket Strategy: Unix Socket Bind Mount vs. TCP Fallback

With the completion of Story 632, the Copernicus Agent Bus is active. Containerized agents on the dev workstation need to communicate with the `agent-daemon` running on the host.

**Chosen Strategy: TCP Fallback (`ws://localhost:7432` or via internal docker host IP)**

### Reasoning:
While a Unix socket bind mount (`-v /tmp/copernicus-agent-bus.sock:/tmp/bus.sock`) offers strict host-level IPC, Docker Desktop on macOS/Windows handles Unix socket bind-mounting inconsistently due to the VM boundary. File ownership and permissions (`chmod`) often break the connection.
Using the TCP fallback (`7432`) is vastly more reliable across operating systems. A container can connect via `host.docker.internal:7432` (or the equivalent Linux bridge IP). The Bus already supports a fallback to `localhost:7432` on `EADDRINUSE`, so the architecture is primed for TCP.

---

## Dispatch Sketch

Currently, agents are dispatched via raw processes bypassing permission checks:
`ccr code --dangerously-skip-permissions`

### Proposed Containerized Dispatch
When `jules:dispatch` (or similar) is called, the system will spin up an ephemeral container:

```bash
docker run --rm -d \
  --name agent-story-633 \
  -v $(pwd)/.agent-worktrees/story-633:/workspace \
  -e COPERNICUS_BUS_URL="ws://host.docker.internal:7432" \
  -e AGENT_ROLE="coder" \
  -e STORY_ID="633" \
  copernicus-agent:latest \
  node agent-runner.js
```

This isolates the agent to `/workspace`, preventing it from traversing up the host filesystem. It connects to the orchestrator via `host.docker.internal` on the TCP port.

---

## Breaking Change Inventory

Implementing containerized dispatch and offloading model serving to Harbor requires the following breaking changes:

### `scripts/agent-daemon/index.mjs`
- Needs to stop tracking raw child process PIDs for agents and instead track Docker container IDs.
- Needs integration with `docker run` instead of `child_process.spawn()` for local dispatch.
- `--status` logic needs to reflect container health alongside socket connection status.

### `scripts/agent-daemon/lib/bus.mjs`
- `SOCKET_PATH` binds directly to `/tmp/copernicus-agent-bus.sock`. The fallback mechanism binds to `localhost:7432`.
- **Change Required:** The TCP binding must change from `localhost` (which binds only to the host's loopback) to `0.0.0.0` or a specific Docker bridge IP so that containers can reach it.
- Authentication may be needed on the TCP port if bound to `0.0.0.0` to prevent unauthorized LAN access.

### `scripts/agent-daemon/adapters/ccr.mjs` (or dispatcher equivalent)
- Must construct the `docker run` command dynamically with the correct volume path for the specific `.agent-worktrees/story-NNN` directory.
- Must ensure the Docker image (`copernicus-agent:latest`) is built or pulled prior to dispatch.

## Harbor Evaluation details

Reviewing the `docker-compose.yml` and `compose.yml` files from `av/harbor`:
- Harbor's architecture leverages a `.env` file and modular `override.env` to dynamically construct compose setups from a massive directory of pre-configured services (located in `/services/`).
- `services/compose.ollama.yml` maps cache directories (`~/.ollama`, HF cache) into containers cleanly.
- If we adopt Harbor for the ML350, we would `harbor up ollama vllm` and point our agent daemon's LLM routing config at the ML350's exposed endpoints.
- We do not need to fork Harbor; we can use it as-is for the infrastructure tier.
