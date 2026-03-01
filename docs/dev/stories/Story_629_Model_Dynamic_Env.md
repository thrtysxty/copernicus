# Story 629 — Model Configuration & Dynamic Environment

**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Gemini
**Blocked By:** —
**Sprint:** C — Parallel with Stories 626, 630
**Priority:** P1

---

## Goal

Make model lists dynamic across the platform, add default system personas, expand
story template types, and investigate/implement the drivers for
Settings:Environment and Settings:IDE Capabilities.

---

## Environment Setup

```bash
cd copernicus && npm install
npx tsc --noEmit   # verify zero errors before touching anything
```

---

## Context

**Canonical paths** (the "(Verify)" stub path for Model Manager was incorrect):

| Resource | Correct Path |
|----------|-------------|
| Settings sections | `copernicus/src/renderer/components/settings/sections/` |
| Templates section | `copernicus/src/renderer/components/settings/sections/TemplatesSection.tsx` |
| Personas section | `copernicus/src/renderer/components/settings/sections/PersonasSection.tsx` |
| Models section | `copernicus/src/renderer/components/settings/sections/ModelsSection.tsx` |
| Environment section | `copernicus/src/renderer/components/settings/sections/EnvironmentSection.tsx` |
| Settings store (main) | `copernicus/electron/settings-store.ts` → `SettingsStore` class |
| Settings store (renderer) | via `settings:load` / `settings:save` IPC |
| Model Registry | `copernicus/electron/models/model-registry.ts` |
| Template config | `copernicus/src/renderer/templates/` (currently only `.md` files — `index.ts` does NOT exist yet) |

The `codebase-indexer.ts` is a codebase search/indexing tool — it is NOT the model
manager. Model management goes through `ModelRegistry` in `model-registry.ts`.

---

## Acceptance Criteria

### AC-1: Dynamic Model Lists

**File:** `copernicus/src/renderer/components/settings/sections/ModelsSection.tsx`

Model lists throughout the platform must read from `invoke('models:list')` rather than
hardcoded arrays. Inspect `ModelsSection.tsx` and any other component that hardcodes
model IDs as string literals. Replace with a `useEffect` call to `models:list` on mount
and store the result in local state.

**AGENTS.md forbidden pattern:** Do not hardcode model IDs as string literals outside
`model-registry.ts`. Any existing violations found while working in this story must
be corrected.

Check `StoryDetail.tsx:34` — `MODEL_OPTIONS` is a hardcoded array. Replace it with
a dynamic fetch from `models:list`.

### AC-2: Model Hot-Swapping

The foundation (Context Snapshots — Story 157) is already built. For this story:
- Ensure every chat-capable component that renders a model picker calls
  `invoke('models:set-active', modelId)` when the user changes the model, not just
  updates local state.
- Verify that `models:set-active` exists in `main.ts` with `handleIpc()` and is in
  `SEND_CHANNELS`. If not, add it.

Do not implement new snapshot logic — that belongs to Story 157 which is already complete.

### AC-3: Default System Personas

**File:** `copernicus/src/renderer/components/settings/sections/PersonasSection.tsx`

On mount, call `settings:load` to fetch existing personas. If no system personas exist,
seed the following defaults (these are the personas the platform uses):

```typescript
const SYSTEM_PERSONAS = [
  { id: 'architect',    name: 'Architect',     description: 'System design, planning, and schema management', system: true },
  { id: 'senior-dev',   name: 'Senior Dev',    description: 'Task breakdown, code review, and agent management', system: true },
  { id: 'junior-dev',   name: 'Junior Dev',    description: 'Focused task implementation using TDD', system: true },
  { id: 'product-owner',name: 'Product Owner', description: 'MVP strategy and user story management', system: true },
  { id: 'deployer',     name: 'Deployer',      description: 'Pi operations, Docker, and deployment tasks', system: true },
  { id: 'sentinel',     name: 'Sentinel',      description: 'Autonomous hardening and secret detection', system: true },
]
```

System personas (`system: true`) must be displayed but not editable or deletable by
the user. Render them in a separate "System" group above user-defined personas.

Persist user-added personas via `settings:save` with key `personas`.

### AC-4: Story Template Types

**File:** `copernicus/src/renderer/components/settings/sections/TemplatesSection.tsx`

Inspect the current `TemplatesSection` to understand how templates are rendered and
stored. Add the following template types to the list if they are not already present:

`Epic`, `Bug`, `Feature`, `Security`, `Foundation`, `Dependency Update`, `Regression`, `Refactor`

Each template type corresponds to a `.md` file in `copernicus/src/renderer/templates/`.
Create `copernicus/src/renderer/templates/index.ts` that exports a `TEMPLATE_MANIFEST`:

```typescript
// copernicus/src/renderer/templates/index.ts
export interface TemplateManifest {
  id: string
  label: string
  filename: string
}

export const TEMPLATE_MANIFEST: TemplateManifest[] = [
  { id: 'story',            label: 'Story',            filename: 'story-doc.md' },
  { id: 'api',              label: 'API',              filename: 'api-doc.md' },
  { id: 'epic',             label: 'Epic',             filename: 'epic.md' },
  { id: 'bug',              label: 'Bug',              filename: 'bug.md' },
  { id: 'feature',          label: 'Feature',          filename: 'feature.md' },
  { id: 'security',         label: 'Security',         filename: 'security.md' },
  { id: 'foundation',       label: 'Foundation',       filename: 'foundation.md' },
  { id: 'dependency-update',label: 'Dependency Update',filename: 'dependency-update.md' },
  { id: 'regression',       label: 'Regression',       filename: 'regression.md' },
  { id: 'refactor',         label: 'Refactor',         filename: 'refactor.md' },
]
```

Create a minimal `.md` file for each new template type in
`copernicus/src/renderer/templates/` using the existing `story-doc.md` as the base
format. `TemplatesSection` should import `TEMPLATE_MANIFEST` and render from it.

### AC-5: Settings:Environment — Investigation & Implementation

**File:** `copernicus/src/renderer/components/settings/sections/EnvironmentSection.tsx`

**Before writing any code:** Read `EnvironmentSection.tsx` completely. Determine what
currently populates the list (hardcoded? IPC call? empty?). Document your finding in
a comment at the top of the file.

The Environment section should show the developer's environment configuration:
- Node.js version (`node --version`)
- Python version
- Git version
- Electron version (`process.versions.electron`)
- App version (`app.getVersion()`)

Add an IPC handler `env:get-versions` in `main.ts` that returns:
```typescript
interface EnvVersions {
  node: string
  electron: string
  appVersion: string
  platform: string
}
```
(Execute `node --version` etc. is not safe from the main process without a shell —
use `process.versions.node`, `process.versions.electron`, and `app.getVersion()` instead.
Do NOT shell out to get versions.)

Add `env:get-versions` to `SEND_CHANNELS`. Wire `EnvironmentSection` to call it on mount.

### AC-6: Settings:IDE Capabilities — Investigation & Implementation

**File:** `copernicus/src/renderer/components/settings/sections/EnvironmentSection.tsx`
(or a separate `IDECapabilitiesSection.tsx` if IDE Capabilities has its own tab)

**Before writing any code:** Read the current file. Determine what it shows.

IDE Capabilities should list the Copernicus feature flags / capability toggles. At
minimum: Monaco language support, browser automation (Playwright), workflow engine
status. Wire each toggle to `settings:save` / `settings:load` with appropriate keys.

If IDE Capabilities is already wired to feature flags, document it rather than
re-implementing.

---

## Files to Modify

| File | Change |
|------|--------|
| `copernicus/src/renderer/components/settings/sections/ModelsSection.tsx` | Dynamic model list via `models:list` |
| `copernicus/src/renderer/components/settings/sections/PersonasSection.tsx` | Seed + display system personas |
| `copernicus/src/renderer/components/settings/sections/TemplatesSection.tsx` | Import from `TEMPLATE_MANIFEST` |
| `copernicus/src/renderer/components/settings/sections/EnvironmentSection.tsx` | Wire `env:get-versions`; IDE capabilities |
| `copernicus/src/renderer/components/planning/StoryDetail.tsx` | Replace hardcoded `MODEL_OPTIONS` |
| `copernicus/src/renderer/templates/index.ts` | **NEW FILE** — `TEMPLATE_MANIFEST` export |
| `copernicus/src/renderer/templates/*.md` | **NEW FILES** — one per new template type |
| `copernicus/electron/main.ts` | Add `env:get-versions`; verify `models:set-active` |
| `copernicus/electron/preload.ts` | Add new channels to `SEND_CHANNELS` |

## Files NOT to Modify

- `copernicus/electron/codebase-indexer.ts` — not a model manager; do not add model logic here.
- `copernicus/electron/models/model-registry.ts` — read-only for this story; do not add personas or templates.
- Any file not listed above.

---

## Definition of Done

1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. `TEMPLATE_MANIFEST` has exactly 10 entries; all `.md` template files exist.
3. System personas appear in PersonasSection, marked non-editable.
4. No model IDs hardcoded outside `model-registry.ts`.
5. All new `ipcMain.handle()` channels use `handleIpc()` and are in `SEND_CHANNELS`.

---

## Blocks

— (no downstream blockers)

## Blocked By

— (no dependencies)

## Documentation Impact

- `docs/MODEL_HOTSWAP.md` — Document `models:set-active` flow.
- `docs/SETTINGS_GUIDE.md` — New templates, persona management, Environment section.
