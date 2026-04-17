# Epic 010: Extension System v2 — Isolated Extension Host

**Status:** PLANNED
**Priority:** P3
**Phase:** Post-v1 Architecture
**Prerequisite:** Stories 403–406 (Extension System v1 B/C hybrid) complete and stable

## Vision

Copernicus v1 extensions run in-process (B/C hybrid — trusted, no isolation). This epic
describes the v2 architecture that moves extensions into a fully isolated host process,
enabling untrusted third-party extensions, a public registry, and a proper capability-based
security model — analogous to how VS Code's extension host works.

## Why This Exists

v1 extensions are trusted modules loaded via `require()` in the Electron main process.
This is fine for first-party and team-internal extensions but has three hard limits:
1. **No isolation** — a buggy extension crashes the IDE
2. **No security** — an extension has full Node.js access (filesystem, network, subprocess)
3. **No marketplace** — can't safely distribute untrusted code without sandboxing

v2 removes all three limits.

## Architecture

### Extension Host Process
A separate Node.js child process (`copernicus-extension-host`) spawned by the main process.
Extensions run entirely within the host. If an extension crashes, the host restarts without
affecting the IDE window.

```
┌─────────────────────────────────────┐
│  Electron Main Process              │
│  ┌─────────────────────────────┐   │
│  │  ExtensionHostManager       │   │
│  │  (spawns, monitors, restarts│   │
│  │   the host process)         │   │
│  └────────────┬────────────────┘   │
│               │ IPC (JSON-RPC)     │
└───────────────┼─────────────────────┘
                │
┌───────────────┼─────────────────────┐
│  Extension Host Process             │
│  ┌────────────┴───────────────┐    │
│  │  ExtensionHostRuntime       │    │
│  │  - Loads extensions         │    │
│  │  - Calls activate()         │    │
│  │  - Routes API calls         │    │
│  └─────────────────────────────┘   │
│                                     │
│  [ext A]  [ext B]  [ext C]  ...    │
└─────────────────────────────────────┘
```

### Message Passing Protocol
JSON-RPC 2.0 over `process.send` / `process.on('message')`. Every extension API call
becomes a message; responses are async. The protocol is typed — both sides share a
generated schema.

Message categories:
- `host→main`: contribution registrations, API call responses, activation events
- `main→host`: activate/deactivate commands, event notifications, API call requests

### Extension API Surface (v2)
Extensions receive a `CopernicusExtensionAPI` proxy object. Every method call on the
proxy becomes a JSON-RPC message to the main process. The main process executes the
call and returns the result.

Capabilities are declared in the manifest. An extension that doesn't declare
`capabilities.filesystem` cannot call `api.fs.*` — the host enforces this at the
proxy level before the message is even sent.

```typescript
interface CopernicusExtensionManifest {
  name: string
  version: string
  displayName: string
  capabilities: {
    filesystem?: 'read' | 'read-write'
    network?: boolean
    subprocess?: boolean
  }
  activationEvents: string[]  // 'onView:myView', 'onCommand:myCommand', '*'
  contributes: ContributionManifest
}
```

### Capability-Based Security Model
| Capability | What it allows | Default |
|------------|---------------|---------|
| `filesystem: read` | Read files within workspace | Denied |
| `filesystem: read-write` | Read + write within workspace | Denied |
| `network` | Make HTTP requests | Denied |
| `subprocess` | Spawn child processes | Denied |

User is prompted to approve capabilities on first install (similar to Android permissions).
Approved capabilities are stored in `~/.copernicus/extension-trust.json`.

### Extension Activation Events
Extensions are not loaded until their activation event fires:
- `*` — activate immediately on startup (discouraged)
- `onView:<viewId>` — activate when a view is opened
- `onCommand:<commandId>` — activate when a command is invoked
- `onWorkflowNode:<nodeType>` — activate when a workflow contains the node type
- `onLanguage:<languageId>` — activate when a file of that language is opened

### Extension Marketplace
A public registry at `extensions.copernicus.dev` (future). Extensions are npm packages
with the `copernicus-extension` keyword. The IDE has a built-in extension browser view
(new activity bar item) that lists, installs, and updates extensions via npm.

Install flow: browse → install → capability approval prompt → activate.

### Extension Development Kit (EDK)
```bash
npx create-copernicus-extension my-extension
cd my-extension
npm run dev       # watch mode, live-reloads into running IDE
npm run package   # builds .vsix-equivalent bundle
npm publish       # publishes to registry
```

Includes:
- TypeScript types for the full extension API
- Local development server that hot-reloads the extension host
- Extension test harness (mock `CopernicusExtensionAPI`)

## Migration from v1

v1 extensions (B/C) are compatible with v2 with minimal changes:
1. Add `capabilities` and `activationEvents` to manifest
2. Wrap `activate()` — the API shape is identical, calls are just proxied instead of direct
3. Async-only — v1 allowed sync API calls; v2 everything is `Promise<T>`

A `@copernicus/compat-v1` shim handles the async wrapping automatically for simple
extensions.

## Stories

| Story | Title | Status |
|-------|-------|--------|
| 685 | Extension host process + JSON-RPC protocol | DRAFT |
| 686 | Capability manifest + approval prompt | DRAFT |
| 687 | Extension API proxy layer | DRAFT |
| 688 | Activation events system | DRAFT |
| 689 | Extension marketplace view | DRAFT |
| 690 | Extension Development Kit (EDK) | DRAFT |
| 691 | v1 → v2 migration shim | DRAFT |

**Dependency chain:** 685 → 686 → 687 → 688 → 689 (sequential). 687 also unblocks 690 and 691 (parallel).

## Success Criteria
- A third-party extension installed from the registry cannot read files outside the
  workspace without explicit user approval
- Extension crash does not crash the IDE — host restarts in < 2s
- v1 extensions work in v2 with only manifest changes (no code changes for simple cases)
- Extension activation is lazy — cold start time unaffected by number of installed extensions
