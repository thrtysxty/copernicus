# User Story 729: Fix Underline Active Indicator — Block Style

## Story Number
729

**Status:** IN PROGRESS
**Priority:** P1
**Type:** Design Compliance Fix

## Blocks:
(none)

## Blocked By:
(none)

## Goal

Replace `border-b-2` underline active indicators with the VT block style (`bg-copernicus-phosphor/10 text-copernicus-phosphor`) in all sub-tab components. The underline style is forbidden per the Copernicus design system; block fill is the canonical active state.

## Files in Scope

- `copernicus/src/renderer/components/settings/sections/GovernanceSection.tsx`
- `copernicus/src/renderer/components/settings/sections/ToolsSection.tsx`
- `copernicus/src/renderer/components/extensions/ExtensionsPanel.tsx`

## Acceptance Criteria

1. In `GovernanceSection.tsx`, the `SubTabButton` active class replaces `text-copernicus-phosphor border-b-2 border-copernicus-phosphor` with `text-copernicus-phosphor bg-copernicus-phosphor/10`
2. In `ToolsSection.tsx`, the sub-tab button active class replaces `text-copernicus-phosphor border-b-2 border-copernicus-phosphor` with `text-copernicus-phosphor bg-copernicus-phosphor/10`
3. In `ExtensionsPanel.tsx`, the two tab buttons (installed/marketplace) replace `border-b-2 transition-colors` + `border-copernicus-phosphor` active with `bg-copernicus-phosphor/10 text-zinc-200 transition-colors` and remove the `pb-1` underline spacing (replace with `px-2 py-1.5`)
4. Running `bash scripts/ipc-lint.sh 2>&1 | grep "Underline active"` returns no matches
5. `npx tsc --noEmit` passes with zero errors after changes

## Definition of Done

- All 5 ACs pass
- `npx tsc --noEmit` exits 0
- No `border-b-2` active-state classes remain in the three target files

## Reference Pattern

Canonical active tab style from `SettingsPanel.tsx` `TabButton`:
```tsx
// Active:
'text-[#050505] bg-copernicus-phosphor font-bold'
// Sub-tab (softer, no inversion):
'text-copernicus-phosphor bg-copernicus-phosphor/10'
// Inactive (unchanged):
'text-zinc-500 hover:text-zinc-300'
```
