# COPERNICUS Installer Setup Guide

This guide provides instructions for setting up COPERNICUS after downloading an installer package (e.g., `.dmg`, `.exe`, or `.AppImage`). These steps are designed for users who are not interacting with the source code.

## Installation

### macOS (DMG)
- Download `COPERNICUS-x.y.z.dmg`
- Open the DMG, drag **COPERNICUS** to **Applications**
- First launch: macOS Gatekeeper will block the app if it is unsigned — right-click the app icon → **Open** → **Open** again in the dialog. This is a one-time step.
- The app will open to the setup wizard.

### Windows (NSIS installer)
- Download `COPERNICUS-Setup-x.y.z.exe`
- Run the installer. Windows SmartScreen may show a "publisher unknown" warning — click **More info → Run anyway**. This is expected for an unsigned build.
- Launch **COPERNICUS** from the Start menu or Desktop shortcut.

### Linux (AppImage)
- Download `COPERNICUS-x.y.z.AppImage`
- Make executable: `chmod +x COPERNICUS-x.y.z.AppImage`
- Run it: `./COPERNICUS-x.y.z.AppImage`
- Optional: install with [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) for desktop integration.

### Linux (.deb — Debian/Ubuntu)
- Download `copernicus_x.y.z_amd64.deb`
- Install: `sudo dpkg -i copernicus_x.y.z_amd64.deb`
- Launch from applications menu or by typing `copernicus` in the terminal.

---

## Phase 1 — Provider Setup (Settings → Providers)

You need **at least one** chat provider. Configure the ones you intend to use.

### Anthropic (Claude) — recommended first
- Get an API key: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- In COPERNICUS: Settings → Providers → Anthropic tile → paste your key → Save.

### Google (Gemini)
You have two options for Google integration:

**API Key (easier):**
- Get a key: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — a free tier is available.
- In COPERNICUS: Settings → Providers → Google tile → paste your key → Save.

**OAuth (required if you want Google Drive as an AI source):**
- **One-time GCP setup:**
  1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a new project.
  2. Navigate to **APIs & Services → Library** → enable the **"Generative Language API"**.
  3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
  4. For application type, select **Desktop app** → Create → copy the Client ID that is generated.
- In COPERNICUS: Settings → General → paste your Client ID into **"Google OAuth Client ID"**.
- Then: Settings → Providers → Google tile → Click **Log in with Google** → complete the browser authentication flow.

### OpenRouter (optional — access to 200+ models via one key)
- In COPERNICUS: Settings → Providers → OpenRouter tile → Click **Connect OpenRouter** → follow the browser login process. No key entry is typically needed this way.
- Alternatively, you can paste a key obtained from [openrouter.ai/keys](https://openrouter.ai/keys).

### OpenAI (optional)
- In COPERNICUS: Settings → Providers → OpenAI tile → paste your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### Ollama (optional — local/self-hosted models, zero cost)
- Install Ollama from [ollama.com](https://ollama.com) — this is a separate, one-time download and installation.
- After installing Ollama, open a terminal or command prompt and pull a model, for example:
  ```bash
  ollama pull llama3.2
  ```
- The Ollama tile in COPERNICUS will automatically show a green status when the Ollama daemon is running. No key is needed.

---

## Phase 2 — GitHub Integration (Settings → Git)

GitHub integration is required for the Kanban board and story dispatch features to function.

- **Option A — GitHub CLI (easiest):** If you already have `gh` installed and authenticated (you can check with `gh auth status` in your terminal), COPERNICUS will automatically read your token. No further action is needed.

- **Option B — Personal Access Token:**
  1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic) → select the following scopes: `repo`, `read:user`.
  2. In COPERNICUS: Settings → Providers → GitHub tile → paste your generated token.

- **Target Repository:** In COPERNICUS: Settings → Git → In the **Target Repository** field, type `owner/repo` for the project you are working on (e.g., `your-username/your-project-repo`). This setting is used by the Kanban board, story list, and agent dispatch features.
- Click **Test Connection** — it should display your GitHub username upon successful connection.

---

## Phase 3 — NotebookLM (optional, requires one terminal command)

This step requires using a terminal. If you do not plan to use NotebookLM, you can skip this phase.

- Open Terminal (macOS/Linux) or Command Prompt (Windows).
- Run the following command:
  ```bash
  notebooklm login
  ```
  A browser window will open. Sign in with your Google account and close the tab when prompted.
- Back in COPERNICUS: Settings → Providers → NotebookLM tile → Click **Refresh notebooks**.
- Your NotebookLM notebooks will now appear in the model picker under the Google group.

> Note: `notebooklm login` is a one-time step. COPERNICUS caches your credential, so you will not be asked again unless you explicitly log out.

---

## Phase 4 — Verify

- Open the Chat panel → select a model from the dropdown → send a message → confirm that a response streams back.
- Open a project folder (File → Open Folder) → confirm that the file tree populates with your project's files.
- Ensure that Settings → Git → Target Repository is set → confirm that the Kanban board loads and displays stories.

---

## Troubleshooting

**App won't open on macOS after dragging to Applications:**
Right-click the app icon → Select **Open** → In the dialog that appears, click **Open** again. This step is only required once for unsigned builds.

**"Backend unavailable" error on startup:**
This indicates that the app's internal backend failed to start. Check the log file for details: **Help → Show Log File**. If you see Python-related errors, this might mean the build was not fully packaged; please contact the developer.

**Models show 0 in the picker / no models load:**
At least one provider needs a valid API key or connection. Go to Settings → Providers and confirm that at least one provider tile shows a green status dot, indicating a successful connection.

**Ollama models not appearing:**
The Ollama daemon must be running *before* you launch COPERNICUS. Start Ollama first (open a terminal and run `ollama serve`), then restart COPERNICUS.

**NotebookLM tile not visible:**
The NotebookLM integration was introduced in later versions (Stories 432–434). If you do not see the NotebookLM tile, you might have an older build of COPERNICUS.
