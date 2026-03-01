#!/bin/bash
# jules-preflight.sh — COPERNICUS environment setup and validation
#
# PURPOSE: Run this as the Jules "Initial Setup" command in Jules web UI
# Configuration → Initial Setup command:
#   bash scripts/jules-preflight.sh
#
# This script:
#   1. Installs Node dependencies for copernicus/
#   2. Runs TypeScript type-check (MUST pass before implementation starts)
#   3. Prints a summary of key project conventions for Jules to read
#   4. Reports any pre-existing IPC violations Jules should not make worse

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "COPERNICUS IDE — Jules Pre-flight Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Install dependencies ──────────────────────────────────────────────

echo ""
echo "Step 1/4: Installing copernicus dependencies..."
cd "$REPO_ROOT/copernicus"
npm install --prefer-offline --no-audit 2>&1 | tail -5
echo "✓ Dependencies ready"

# ── Step 2: TypeScript baseline ───────────────────────────────────────────────

echo ""
echo "Step 2/4: TypeScript baseline check..."
if npx tsc --noEmit 2>&1; then
  echo "✓ TypeScript: CLEAN (zero errors before your changes)"
else
  echo "⚠️  TypeScript errors exist BEFORE your changes."
  echo "   These are pre-existing — do NOT fix them unless your story requires it."
  echo "   Your changes must not ADD new errors."
  npx tsc --noEmit 2>&1 | grep " error TS" | head -20
fi

# ── Step 3: IPC lint baseline ─────────────────────────────────────────────────

echo ""
echo "Step 3/4: IPC compliance baseline..."
cd "$REPO_ROOT"
if [ -f "scripts/ipc-lint.sh" ]; then
  bash scripts/ipc-lint.sh --quiet 2>&1 || {
    echo "   Pre-existing violations found. Jules: do NOT make these worse."
    echo "   Run: bash scripts/ipc-lint.sh --fix-hints  for details."
  }
else
  echo "   ipc-lint.sh not found — skipping"
fi

# ── Step 4: Print key conventions ─────────────────────────────────────────────

echo ""
echo "Step 4/4: Key conventions (READ BEFORE WRITING CODE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "MANDATORY PATTERN — main process IPC:"
echo "  ipcMain.handle('chan:name', (_e, arg) => handleIpc(() => manager.doThing(arg)))"
echo ""
echo "MANDATORY PATTERN — renderer IPC:"
echo "  const invoke = useIpcError()"
echo "  const result = await invoke<MyType>('chan:name', arg)"
echo "  if (!result.ok) return  // hook shows toast; access result.data for value"
echo ""
echo "MANDATORY PATTERN — new channel registration:"
echo "  1. Add ipcMain.handle() in main.ts"
echo "  2. Add channel name to SEND_CHANNELS in preload.ts"
echo ""
echo "ACTIVE STATE CSS (§1.4 VT block):"
echo "  active:   bg-copernicus-phosphor text-[#050505] rounded-none"
echo "  inactive: text-zinc-500 hover:text-zinc-300"
echo "  FORBIDDEN: bg-copernicus-phosphor/10   border-b-2 border-copernicus-phosphor"
echo ""
echo "NO console.log — use electron-log (Story 192)"
echo "NO vertical-text Tailwind class — use writingMode inline style"
echo "NO rotateColumn/toggleColumnMinimize — use setSpotlightLane"
echo ""
echo "VERIFY BEFORE COMMITTING:"
echo "  cd copernicus && npx tsc --noEmit  ← ZERO ERRORS REQUIRED"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Pre-flight complete. Implement your story."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
