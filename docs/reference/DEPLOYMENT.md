# Deployment Guide

---

## Dev Mode

`make dev` starts two processes in parallel and kills both on `Ctrl+C`:

```bash
make dev
# Starts:
#   python3 backend/app.py          → Flask backend on :5001
#   cd copernicus && npm run dev    → Vite + Electron renderer
```

**Expected output:**
- Flask: `* Running on http://127.0.0.1:5001`
- Vite: `VITE vX.X.X  ready in Xms → Local: http://localhost:5173`
- Electron window opens automatically

**Individual processes:**
```bash
make dev-backend    # Flask only
make dev-frontend   # Electron/Vite only
```

**Prerequisites:** `bash scripts/dev-setup.sh` must have run at least once — creates venv, installs npm deps, copies config.

---

## Packaged Build

Copernicus is an Electron desktop app distributed as a native installer per platform.

```bash
cd copernicus

# macOS DMG
npm run build -- --mac

# Windows NSIS installer
npm run build -- --win

# Linux AppImage + .deb
npm run build -- --linux
```

**Output:** `copernicus/release/<version>/` — DMG, NSIS installer, or AppImage.

**What's bundled (`extraResources`):**

| Platform | Resources |
|---|---|
| macOS | `knowledge/`, `install-daemon.sh`, `copernicus-backend` |
| Linux | `knowledge/`, `install-daemon.sh`, `copernicus-backend` |
| Windows | `knowledge/`, `install-daemon.ps1`, `copernicus-backend.exe` |

The backend binary is built separately with PyInstaller before running electron-builder:
```bash
cd backend && pyinstaller copernicus-backend.spec
```

**TypeScript gate** — always run before building:
```bash
cd copernicus && npx tsc --noEmit
```

---

## Background Services

After a packaged install, register persistent daemons so services start at login:

```bash
# macOS / Linux
bash scripts/install-daemon.sh

# Windows
powershell scripts/install-daemon.ps1
```

On first launch of the packaged app, Copernicus offers a toast prompt to register the Jules daemon automatically. Click **Register** or use the terminal command above.

See `docs/help/BACKGROUND_SERVICES_GUIDE.md` for full registration, verification, and uninstall steps.

---

## Secrets

| Environment | Where secrets live |
|---|---|
| Dev machine | `~/.secrets` (sourced by shell; set via `bash scripts/dev-setup.sh`) |
| Packaged app | `~/.secrets` (same file; Electron reads it at startup) |
| App config | `~/Library/Application Support/copernicus/config.env` (macOS) |

**Never:**
- Commit `~/.secrets` (it's in `.gitignore`)
- Put API keys in `.env.example`, `config.env`, or any tracked file

---

## Logs

| Location | Contents |
|---|---|
| `~/Library/Application Support/copernicus/logs/` | Electron main process (`electron-log`) |
| `/tmp/jules-daemon.log` | Jules daemon stdout/stderr |
| Flask console | Backend request log (stdout when run via `make dev`) |

Open logs from inside the IDE: **App menu → Open Log File**, or via the Engine Room terminal.

---

## Reset / Wipe

```bash
make reset      # Wipe DB + settings + logs → triggers setup wizard on next launch
make reset-db   # Wipe DB only (preserves settings and first-run state)
```
