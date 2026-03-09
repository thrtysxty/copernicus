#!/bin/bash
# Copernicus Review Gate — run after implementation, before merge
set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "=== Copernicus Review Gate ==="

echo "[1/3] TypeScript check..."
cd copernicus && npx tsc --noEmit
cd "$REPO_ROOT"

echo "[2/3] IPC pattern check..."
DIRECT_IPC=$(grep -r "window\.ipcRenderer\.invoke" copernicus/src/renderer 2>/dev/null || true)
if [ -n "$DIRECT_IPC" ]; then
  echo "FAIL: Direct ipcRenderer.invoke found:"
  echo "$DIRECT_IPC"
  exit 1
fi

echo "[3/3] Stale win closure check..."
STALE_WIN=$(grep -r "if (!win) return" copernicus/electron/ipc 2>/dev/null || true)
if [ -n "$STALE_WIN" ]; then
  echo "WARN: Possible stale win closure — verify BrowserWindow.getAllWindows()[0] is used:"
  echo "$STALE_WIN"
fi

echo "=== Review Gate PASSED ==="
