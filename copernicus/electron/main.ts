import { app, BrowserWindow, ipcMain, shell, session, globalShortcut, dialog } from 'electron'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { AuthManager } from './auth-manager'
import { ModelRegistry } from './models/model-registry'
import { registerSecurityHandlers, initializeSecurityManager, GitGuardDecision, GitPushRequest } from './security'
import { SettingsStore } from './settings-store'
import { createTouchBar } from './touch-bar'
import { TouchBarConfig, DEFAULT_TOUCH_BAR_CONFIG } from './touch-bar-types'
import { StoriesManager } from './stories'
import { parseMakefile } from './utils/makefile-parser'
import { ptyManager } from './pty-manager'
import { stateLedger } from './db/state-ledger'
import { setupCommandHandlers as setupDispatcherHandlers } from './commands/dispatcher'
import { DevtimeManager } from './devtime-manager'
import { GithubManager } from './github-manager'
import { llmService } from './llm/service'
import { fsManager } from './fs-manager'
import { workflowEngine } from './workflow/engine'
import { codebaseIndexer } from './codebase-indexer'
import { WORKFLOW_TEMPLATES } from './workflow/templates'
import { browserSession } from './browser-session'
import { dispatchJulesSession } from './jules/dispatcher'
import { julesMonitor } from './jules/monitor'
import './interop/dispatcher' // Initialize Interop Dispatcher

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

// Initialize Logging
// COPERNICUS_E2E_HOME isolates e2e test runs from the real user profile.
const COPERNICUS_HOME = process.env.COPERNICUS_E2E_HOME ?? path.join(os.homedir(), '.copernicus')
const LOG_DIR = path.join(COPERNICUS_HOME, 'logs')
log.transports.file.resolvePathFn = () => path.join(LOG_DIR, 'copernicus.log')
Object.assign(console, log.functions)

// ── IPC Error Handling Helper (Story 163) ──────────────────────────────────
async function handleIpc<T>(
  fn: () => T | Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[ipc]', message)
    return { ok: false, error: message }
  }
}

function computeCoveragePct(coverageMap: Record<string, any>): number {
  const files = Object.values(coverageMap)
  if (!files.length) return 0
  const total   = files.reduce((acc: number, f: any) => acc + (f.s?.total   ?? 0), 0)
  const covered = files.reduce((acc: number, f: any) => acc + (f.s?.covered ?? 0), 0)
  return total > 0 ? Math.round((covered / total) * 100 * 10) / 10 : 0
}

// ── Playwright Lazy Loader ───────────────────────────────────────────────
let pw: typeof import('playwright-core') | null = null
async function getPlaywright() {
  if (!pw) pw = await import('playwright-core')
  return pw
}

// ── Global process safety nets ────────────────────────────────────────────
process.on('uncaughtException', (error: Error) => {
  console.error('[Main] uncaughtException:', error.stack ?? error.message)
  const wins = BrowserWindow.getAllWindows()
  wins.forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('app:critical-error', {
        type: 'uncaughtException',
        message: error.message,
        stack: error.stack,
      })
    }
  })
})

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack   = reason instanceof Error ? reason.stack  : undefined
  console.error('[Main] unhandledRejection:', stack ?? message)
  const wins = BrowserWindow.getAllWindows()
  wins.forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('app:critical-error', {
        type: 'unhandledRejection',
        message,
        stack,
      })
    }
  })
})

// ── Settings Persistence ───────────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'copernicus-settings.json')

function loadSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSettings(patch: Record<string, unknown>): void {
  const current = loadSettings()
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...current, ...patch }, null, 2))
}

export let win: BrowserWindow | null
let isFirstRun = false;
let touchBarCleanup: { remove: () => void } | null = null

export function notifyWorkspaceChanged(window: BrowserWindow | null, newPath: string) {
  if (window && !window.isDestroyed()) {
    window.webContents.send('app:workspace-changed', { path: newPath })
  }
}

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

const authManager = new AuthManager()
new GithubManager(authManager)
const modelRegistry = new ModelRegistry()
const settingsStore = new SettingsStore()
export const storiesManager = new StoriesManager(os.homedir(), stateLedger)
const devtimeManager = new DevtimeManager()

// Initialize Security Manager
initializeSecurityManager({
  requestConfirmation: async (request: GitPushRequest): Promise<GitGuardDecision> => {
    if (!win) return 'BLOCK';
    win.webContents.send('security:git-push-request', request);
    return new Promise((resolve) => {
      ipcMain.once(`security:git-push-response:${request.command}`, (_event, decision: GitGuardDecision) => {
        resolve(decision);
      });
      setTimeout(() => resolve('BLOCK'), 60000);
    });
  }
});

function ensureCopernicusDirectory() {
  try {
    if (!fs.existsSync(COPERNICUS_HOME)) fs.mkdirSync(COPERNICUS_HOME, { recursive: true });
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const preferencesPath = path.join(COPERNICUS_HOME, 'preferences.json');
    if (!fs.existsSync(preferencesPath)) isFirstRun = true;
  } catch (error) {
    console.error('Failed to initialize .copernicus directory:', error);
  }
}

function createWindow() {
  const isDebug = process.env.COPERNICUS_DEBUG === 'true';

  // Cohesive Single Window for both setup and IDE
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    frame: false,
    backgroundColor: '#050505',
    titleBarStyle: 'hiddenInset',
    title: isFirstRun ? (isDebug ? 'COPERNICUS SETUP [DEBUG]' : 'COPERNICUS SETUP') : (isDebug ? 'COPERNICUS IDE [DEBUG]' : 'COPERNICUS'),
    trafficLightPosition: { x: 12, y: 3 },
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  })

  if (isDebug) {
    win.webContents.openDevTools();
    log.transports.file.level = 'debug';
  }

  storiesManager.setWindow(win)
  julesMonitor.setWindow(win)
  julesMonitor.resumeWatching()

  if (process.platform === 'darwin') {
    const settings = loadSettings()
    const tbConfig = { ...DEFAULT_TOUCH_BAR_CONFIG, ...(settings?.touchBar as any ?? {}) }
    touchBarCleanup = createTouchBar(win, tbConfig)
  }

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Load appropriate view based on first run status
  if (isFirstRun) {
     if (VITE_DEV_SERVER_URL) {
        win.loadURL(`${VITE_DEV_SERVER_URL}?window=wizard`)
     } else {
        win.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { window: 'wizard' } })
     }
  } else {
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST!, 'index.html'))
    }
  }
}

function setupAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();
}

function registerIpcHandlers() {
  ipcMain.handle('settings:save', (_event, patch: unknown) => handleIpc(async () => {
    if (typeof patch === 'object' && patch !== null) saveSettings(patch as Record<string, unknown>)
    return true
  }))

  ipcMain.handle('settings:load', () => handleIpc(() => loadSettings()))

  ipcMain.handle('app:open-log', () => handleIpc(() => {
    const logFilePath = path.join(LOG_DIR, 'copernicus.log')
    return shell.openPath(logFilePath)
  }))

  ipcMain.handle('app:open-external', (_event, url: string) => handleIpc(() => shell.openExternal(url)))

  // ── Anthropic OAuth (Claude.ai Session) ──────────────────────────────────
  const ANTHROPIC_OAUTH_PORT = 47323

  ipcMain.handle('oauth:start-anthropic', () => handleIpc(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const state = randomBytes(16).toString('hex')
      const server = createServer(async (req, res) => {
        if (!req.url?.startsWith('/callback')) { res.end(); return }

        const url = new URL(req.url, `http://localhost:${ANTHROPIC_OAUTH_PORT}`)
        const token = url.searchParams.get('token') || url.searchParams.get('sessionKey')
        const returnedState = url.searchParams.get('state')

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="background:#050505;color:#4ADE80;font-family:monospace;padding:2rem"><p>Anthropic Session Authenticated ✓ — you can close this tab.</p></body></html>')
        server.close()

        if (!token || returnedState !== state) {
          const err = { provider: 'anthropic', ok: false, error: 'Auth session capture failed' }
          win?.webContents.send('oauth:callback', err)
          resolve({ ok: false, error: err.error })
          return
        }

        try {
          await authManager.storeApiKey('anthropic', token, undefined, 'session', { label: 'Web Session' })
          win?.webContents.send('oauth:callback', { provider: 'anthropic', ok: true, type: 'session' })
          if (win) { win.show(); win.focus(); }
          resolve({ ok: true })
        } catch (err: any) {
          const msg = err?.message ?? 'Unknown error'
          win?.webContents.send('oauth:callback', { provider: 'anthropic', ok: false, error: msg })
          resolve({ ok: false, error: msg })
        }
      })

      server.listen(ANTHROPIC_OAUTH_PORT, () => {
        const loginUrl = `https://claude.ai/login?prompt=login&state=${state}&returnTo=${encodeURIComponent(`http://localhost:${ANTHROPIC_OAUTH_PORT}/callback?state=${state}`)}`
        shell.openExternal(loginUrl)
      })

      setTimeout(() => {
        server.close()
        resolve({ ok: false, error: 'Anthropic login timed out' })
      }, 5 * 60 * 1000)
    })
  }))

  // ── OpenRouter OAuth ──────────────────────────────────────────────────────
  const OPENROUTER_OAUTH_PORT = 47324

  ipcMain.handle('oauth:start-openrouter', () => handleIpc(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const state = randomBytes(16).toString('hex')
      const server = createServer(async (req, res) => {
        if (!req.url?.startsWith('/callback')) { res.end(); return }

        const url = new URL(req.url, `http://localhost:${OPENROUTER_OAUTH_PORT}`)
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="background:#050505;color:#4ADE80;font-family:monospace;padding:2rem"><p>OpenRouter Authenticated ✓ — you can close this tab.</p></body></html>')
        server.close()

        if (!code || returnedState !== state) {
          const err = { provider: 'openrouter', ok: false, error: 'OAuth state mismatch' }
          win?.webContents.send('oauth:callback', err)
          resolve({ ok: false, error: err.error })
          return
        }

        try {
          await authManager.storeApiKey('openrouter', code, undefined, 'oauth', { label: 'OAuth Token' })
          win?.webContents.send('oauth:callback', { provider: 'openrouter', ok: true, type: 'oauth' })
          if (win) { win.show(); win.focus(); }
          resolve({ ok: true })
        } catch (err: any) {
          const msg = err?.message ?? 'Unknown error'
          win?.webContents.send('oauth:callback', { provider: 'openrouter', ok: false, error: msg })
          resolve({ ok: false, error: msg })
        }
      })

      server.listen(OPENROUTER_OAUTH_PORT, () => {
        const loginUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(`http://localhost:${OPENROUTER_OAUTH_PORT}/callback?state=${state}`)}&state=${state}`
        shell.openExternal(loginUrl)
      })

      setTimeout(() => { server.close(); resolve({ ok: false, error: 'OpenRouter auth timed out' }) }, 5 * 60 * 1000)
    })
  }))

  // ── Google OAuth PKCE ─────────────────────────────────────────────────────
  const GOOGLE_OAUTH_PORT = 47322

  function generatePKCE() {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    return { verifier, challenge }
  }

  async function exchangeGoogleToken(code: string, verifier: string, clientId: string) {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      code_verifier: verifier,
      redirect_uri: `http://localhost:${GOOGLE_OAUTH_PORT}/callback`,
      grant_type: 'authorization_code',
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await res.json() as any
    if (!data.access_token) throw new Error(data.error_description ?? 'Token exchange failed')
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    const user = await userRes.json() as any
    return { access_token: data.access_token as string, email: (user.email ?? '') as string }
  }

  ipcMain.handle('app:start-oauth-listener', () => handleIpc(() => {
    const clientId = (settingsStore.get('googleOAuthClientId', '') as string).trim() || 'copernicus-ide-default.apps.googleusercontent.com';

    return new Promise<{ ok: boolean }>((resolve, reject) => {
      const { verifier, challenge } = generatePKCE()
      const state = randomBytes(16).toString('hex')

      const server = createServer(async (req, res) => {
        if (!req.url?.startsWith('/callback')) { res.end(); return }

        const url = new URL(req.url, `http://localhost:${GOOGLE_OAUTH_PORT}`)
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="background:#050505;color:#4ADE80;font-family:monospace;padding:2rem"><p>Authenticated ✓ — you can close this tab.</p></body></html>')
        server.close()

        if (!code || returnedState !== state) {
          win?.webContents.send('oauth:google-complete', { ok: false, error: 'OAuth state mismatch' })
          resolve({ ok: false })
          return
        }

        try {
          const { access_token, email } = await exchangeGoogleToken(code, verifier, clientId)
          await authManager.storeApiKey('google', access_token, undefined, 'oauth', { email })

          const geminiDir = path.join(os.homedir(), '.gemini')
          if (!fs.existsSync(geminiDir)) fs.mkdirSync(geminiDir, { recursive: true })
          const geminiCreds = {
            access_token,
            client_id: clientId,
            token_type: 'Bearer',
            expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
            email
          }
          fs.writeFileSync(path.join(geminiDir, 'oauth_creds.json'), JSON.stringify(geminiCreds, null, 2))

          win?.webContents.send('oauth:google-complete', { ok: true, email })
          if (win) { win.show(); win.focus(); }
          resolve({ ok: true })
        } catch (err: any) {
          const msg = err?.message ?? 'Unknown error'
          win?.webContents.send('oauth:google-complete', { ok: false, error: msg })
          resolve({ ok: false })
        }
      })

      server.listen(GOOGLE_OAUTH_PORT, () => {
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: `http://localhost:${GOOGLE_OAUTH_PORT}/callback`,
          response_type: 'code',
          scope: 'openid email https://www.googleapis.com/auth/generative-language',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
          access_type: 'offline',
          prompt: 'select_account consent',
        })
        shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
      })

      setTimeout(() => {
        server.close()
        reject(new Error('OAuth timed out — please try again'))
      }, 5 * 60 * 1000)
    })
  }))

  ipcMain.handle('oauth:start-google', () => handleIpc(() => {
    throw new Error('Use app:start-oauth-listener instead')
  }))

  // Wizard Handlers
  ipcMain.handle('check-cli-tools', () => handleIpc(async () => {
    const tools = ['claude', 'gemini', 'git', 'node'];
    const results: Record<string, boolean> = {};
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const extraPaths = [
      '/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin',
      `${process.env.HOME}/.local/bin`, `${process.env.HOME}/.nvm/versions/node/current/bin`,
    ].join(':')
    const env = { ...process.env, PATH: `${process.env.PATH ?? ''}:${extraPaths}` }
    results['node'] = true;
    await Promise.all(
      tools.filter(t => t !== 'node').map(tool => new Promise<void>(resolve => {
        execFile(cmd, [tool], { env }, (error) => { results[tool] = !error; resolve(); });
      }))
    );
    return results;
  }));

  ipcMain.handle('select-folder', () => handleIpc(async () => {
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return canceled ? null : filePaths[0];
  }));

  ipcMain.handle('fs:select-file', () => handleIpc(async () => {
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { 
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Text Files', extensions: ['txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'py', 'json'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
      ]
    });
    return canceled ? null : filePaths[0];
  }));

  // Workflow Handlers
  ipcMain.handle('workflow:update-node-data', (_e, { nodeId, field, value }: any) => handleIpc(() => {
    // This is primarily for external persistence if needed, 
    // but the renderer currently manages the graph state.
    console.log(`[Workflow] Update Node ${nodeId}: ${field} = ${value}`);
    return true;
  }));

  ipcMain.handle('save-preferences', (_event, preferences: any) => handleIpc(async () => {
    const { keys, workspace, ...settings } = preferences;
    if (keys) {
        if (keys.anthropic && keys.anthropic !== 'saved' && keys.anthropic !== 'oauth') await authManager.storeApiKey('anthropic', keys.anthropic, undefined, 'apikey');
        if (keys.google && keys.google !== 'saved' && keys.google !== 'oauth') await authManager.storeApiKey('google', keys.google, undefined, 'apikey');
        if (keys.openrouter && keys.openrouter !== 'saved' && keys.openrouter !== 'oauth') await authManager.storeApiKey('openrouter', keys.openrouter, undefined, 'apikey');
        if (keys.deepinfra && keys.deepinfra !== 'saved') await authManager.storeApiKey('deepinfra', keys.deepinfra, undefined, 'apikey');
    }
    if (workspace) {
      fsManager.setRootPath(workspace);
      storiesManager.setProjectRoot(workspace);
      // Immediately start indexing for the new workspace
      codebaseIndexer.startIndexing(workspace).catch(console.error)
    }
    saveSettings({ ...settings, workspace });
    const preferencesPath = path.join(COPERNICUS_HOME, 'preferences.json');
    fs.writeFileSync(preferencesPath, JSON.stringify({ ...settings, workspace, completedAt: new Date().toISOString() }, null, 2));
    return true;
  }));

  ipcMain.handle('restart-app', () => handleIpc(() => { app.relaunch(); app.exit(0); }));

  // Auth Handlers
  ipcMain.handle('auth:status', () => handleIpc(async () => authManager.getAuthStatus()));
  ipcMain.handle('auth:store-api-key', (_, provider: string, apiKey: string, baseUrl?: string) => 
    handleIpc(() => authManager.storeApiKey(provider, apiKey, baseUrl, 'apikey')));
  ipcMain.handle('auth:revoke', (_, provider: string) => 
    handleIpc(() => authManager.revokeApiKey(provider)));
  ipcMain.handle('auth:get-api-key', (_, provider: string) => handleIpc(() => {
    if (provider === 'openai' || provider === 'openrouter' || provider === 'deepinfra') {
       const resolved = authManager.resolveOpenAICompatibleKey();
       return resolved ? resolved.key : null;
    }
    return authManager.getApiKey(provider);
  }));
  ipcMain.handle('auth:resolve-openai-config', () => handleIpc(() => authManager.resolveOpenAICompatibleKey()));

  // Model Handlers
  ipcMain.handle('models:list', () => handleIpc(() => modelRegistry.getModels()));
  ipcMain.handle('models:active', () => handleIpc(() => modelRegistry.getActiveModel()));
  ipcMain.handle('models:set-active', (_, modelId: string) => handleIpc(() => modelRegistry.setActiveModel(modelId)));
  ipcMain.handle('models:list-ollama', () => handleIpc(async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return { ok: false, error: 'OLLAMA_NOT_RUNNING', models: [] };

      const json = await response.json() as { models: Array<{ name: string }> };
      const models = json.models.map(m => ({
        id: m.name,
        name: m.name,
        provider: 'ollama' as const,
        contextWindow: 0,
      }));

      models.forEach(m => modelRegistry.registerModel(m));
      return { ok: true, models };
    } catch {
      return { ok: false, error: 'OLLAMA_NOT_RUNNING', models: [] };
    }
  }));

  ipcMain.handle('workflow:ollama-status', () => handleIpc(async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(2000),
      });
      return { online: res.ok };
    } catch {
      return { online: false };
    }
  }));

  // Security Handlers
  registerSecurityHandlers(ipcMain, settingsStore);

  // Git Handlers
  ipcMain.handle('git:branch', () => handleIpc(async () => {
    return new Promise((resolve) => {
      execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], (error: any, stdout: string) => {
        if (error) resolve('unknown');
        else resolve(stdout.trim());
      });
    });
  }));

  // Story Handlers
  ipcMain.handle('stories:list', () => handleIpc(() => storiesManager.listStories()))
  ipcMain.handle('stories:sync', () => handleIpc(() => storiesManager.syncFromDisk()))
  ipcMain.handle('stories:is-repo-targeted', () => handleIpc(() => storiesManager.isRepoTargeted()))
  ipcMain.handle('stories:create', (_event, args) => handleIpc(() => {
    const { title, type, epic, priority } = typeof args === 'string'
      ? { title: args, type: undefined, epic: undefined, priority: undefined }
      : args
    return storiesManager.createStory({ title, type, epic, priority })
  }))
  ipcMain.handle('stories:get-content', (_event, id) => handleIpc(() => storiesManager.getStoryContent(id)))
  ipcMain.handle('stories:update-content', (_event, { id, content }) => handleIpc(() => storiesManager.updateStoryContent(id, content)))
  ipcMain.handle('stories:set-field', (_event, { id, field, value }) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return
    return storiesManager.setField(id, field, value)
  }))
  ipcMain.handle('stories:update', (_event, id, status) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return;
    return storiesManager.updateStoryStatus(id, status)
  }))
  ipcMain.handle('stories:hydrate', (_event, id) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return;
    const content = storiesManager.getStoryContent(id)
    const filePath = storiesManager.getStoryPath(id)
    win?.webContents.send('editor:open', { path: filePath, content })
    return true
  }))

  // Devtime Handlers
  ipcMain.handle('devtime:start', (_event, data) => handleIpc(() => {
    if (data.repo_path) {
      storiesManager.setProjectRoot(data.repo_path)
    }
    return devtimeManager.startSession(data)
  }));
  ipcMain.handle('devtime:status', () => handleIpc(() => ({
    session: devtimeManager.getActiveSession(),
    total: devtimeManager.getTotalMonthValue(),
    isRepoTargeted: storiesManager.isRepoTargeted()
  })));
  ipcMain.handle('devtime:close', (_event, data) => handleIpc(() => devtimeManager.closeSession(data)));
  ipcMain.handle('devtime:defaults', () => handleIpc(() => devtimeManager.getDefaults()));
  ipcMain.handle('devtime:report', () => handleIpc(() => devtimeManager.getReport()));
  ipcMain.handle('devtime:list-stories', (_event, repoPath: string) => handleIpc(() => devtimeManager.listStories(repoPath)));

  // CAPEX Analytics (Story 162)
  ipcMain.handle('devtime:run-tests', () => handleIpc(async () => {
    const { execSync } = require('child_process')
    const start = Date.now()
    const raw = execSync(
      'npx vitest run --reporter=json',
      { cwd: path.join(__dirname, '..'), encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const result = JSON.parse(raw)
    const record = {
      total_tests: result.numTotalTests ?? 0,
      passed:      result.numPassedTests ?? 0,
      failed:      result.numFailedTests ?? 0,
      skipped:     result.numPendingTests ?? 0,
      coverage_pct: result.coverageMap ? computeCoveragePct(result.coverageMap) : null,
      duration_ms: Date.now() - start,
    }
    stateLedger.upsertTestRun(record)
    return record
  }))

  ipcMain.handle('devtime:test-history', (_e, limit: number = 20) =>
    handleIpc(() => stateLedger.getTestRunHistory(limit)))

  ipcMain.handle('ledger:daily-costs', (_e, days: number = 30) => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT date(created_at) as day,
             SUM(cost_usd) as total_cost,
             SUM(tokens_in + tokens_out) as total_tokens
      FROM model_calls
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at) ORDER BY day ASC
    `).all(days)
  ))

  ipcMain.handle('ledger:cost-by-model', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT model_id, provider,
             SUM(cost_usd) as total_cost,
             COUNT(*) as call_count,
             SUM(tokens_in) as tokens_in,
             SUM(tokens_out) as tokens_out
      FROM model_calls GROUP BY model_id, provider ORDER BY total_cost DESC
    `).all()
  ))

  ipcMain.handle('ledger:cost-by-story', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT panel_id as story_id,
             SUM(cost_usd) as total_cost,
             COUNT(*) as call_count,
             SUM(tokens_in + tokens_out) as total_tokens
      FROM model_calls
      WHERE panel_id IS NOT NULL AND panel_id != 'chat'
      GROUP BY panel_id ORDER BY total_cost DESC LIMIT 50
    `).all()
  ))

  ipcMain.handle('stories:throughput', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT strftime('%Y-W%W', updated_at) as week, COUNT(*) as completed
      FROM stories WHERE status = 'COMPLETE' AND updated_at >= date('now', '-84 days')
      GROUP BY week ORDER BY week ASC
    `).all()
  ))

  ipcMain.handle('stories:status-distribution', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT status, COUNT(*) as count FROM stories GROUP BY status ORDER BY count DESC
    `).all()
  ))

  ipcMain.handle('stories:bugs-by-assignee', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT COALESCE(assigned_to, 'unassigned') as assignee, COUNT(*) as bug_count
      FROM stories WHERE type = 'bug' GROUP BY assigned_to ORDER BY bug_count DESC
    `).all()
  ))

  ipcMain.handle('devtime:weekly-velocity', (_e, weeks: number = 8) => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT strftime('%Y-W%W', start_time) as week,
             SUM(duration_hours) as hours,
             COUNT(DISTINCT story_id) as stories
      FROM dev_sessions
      WHERE start_time >= date('now', '-' || (? * 7) || ' days')
      GROUP BY week ORDER BY week ASC
    `).all(weeks)
  ))

  // Makefile Handlers
  ipcMain.handle('makefile:list', () => handleIpc(() => parseMakefile(fsManager.getRootPath())))
  ipcMain.handle('makefile:run', (_event, target) => handleIpc(() => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (!ALLOWED.includes(target)) return;
    const child = spawn('make', [target], { cwd: fsManager.getRootPath() })
    child.stdout.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.stderr.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.on('close', (code) => win?.webContents.send('terminal:data', `\n[Process exited with code ${code}]`))
    return true
  }))

  // System Execution
  ipcMain.on('system:make', (_, target: string) => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (ALLOWED.includes(target)) spawn('make', [target], { cwd: fsManager.getRootPath() })
  });

  // Terminal IPC
  ipcMain.on('terminal-create', (_event, { id, cols, rows, cwd }) => {
    const resolvedCwd = path.resolve(cwd || os.homedir());
    const isSafe = resolvedCwd.startsWith(fsManager.getRootPath() + path.sep) || resolvedCwd === fsManager.getRootPath() || resolvedCwd.startsWith(os.homedir());
    if (win && isSafe) ptyManager.create(id, cols, rows, resolvedCwd, win);
  });
  ipcMain.on('terminal-resize', (_event, { id, cols, rows }) => ptyManager.resize(id, cols, rows));
  ipcMain.on('terminal-write', (_event, payload: any) => {
    if (payload?.id && payload?.data) ptyManager.write(payload.id, payload.data);
  });
  ipcMain.on('terminal-kill', (_event, { id }) => ptyManager.kill(id));
  ipcMain.on('terminal:spawn-agent', (_event, { agentId }: any) => {
    if (!/^[a-z0-9_-]+$/.test(agentId)) return;
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('terminal:activate-tab', { agentId }));
  })

  // Database IPC
  ipcMain.handle('db:log-intent', (_, content, status, agentId) => handleIpc(() => stateLedger.logIntent(content, status, agentId)));
  ipcMain.handle('db:get-intents', (_, limit) => handleIpc(() => stateLedger.getRecentIntents(limit)));
  ipcMain.handle('db:log-event', (_, type, content, metadata, agentId) => handleIpc(() => stateLedger.logEvent(type, content, metadata, agentId)));
  ipcMain.handle('db:get-events', (_, limit) => handleIpc(() => stateLedger.getRecentEvents(limit)));
  ipcMain.handle('db:add-memory', (_, content, tags, agentId) => handleIpc(() => stateLedger.addMemory(content, tags, agentId)));
  ipcMain.handle('db:search-memory', (_, query) => handleIpc(() => stateLedger.searchMemory(query)));
  ipcMain.handle('db:vacuum', () => handleIpc(() => {
    stateLedger.vacuum();
    return true;
  }));

  // GitHub Handlers
  ipcMain.handle('github:set-trust', (_e, repoName: string, trusted: boolean) => handleIpc(() => {
    const trusted_repos: string[] = settingsStore.get('github:trusted-repos', []) as string[]
    if (trusted) {
      if (!trusted_repos.includes(repoName)) trusted_repos.push(repoName)
    } else {
      const idx = trusted_repos.indexOf(repoName)
      if (idx > -1) trusted_repos.splice(idx, 1)
    }
    settingsStore.set('github:trusted-repos', trusted_repos)
    return { ok: true }
  }))

  ipcMain.handle('github:add-repo', (_e, repoName: string) => handleIpc(() => {
    const tracked: string[] = settingsStore.get('github:tracked-repos', []) as string[]
    if (!tracked.includes(repoName)) {
      tracked.push(repoName)
      settingsStore.set('github:tracked-repos', tracked)
    }
    return { ok: true, tracked }
  }))

  ipcMain.handle('github:remove-repo', (_e, repoName: string) => handleIpc(() => {
    const tracked: string[] = settingsStore.get('github:tracked-repos', []) as string[]
    const trusted: string[] = settingsStore.get('github:trusted-repos', []) as string[]
    const filteredTracked = tracked.filter(r => r !== repoName)
    const filteredTrusted = trusted.filter(r => r !== repoName)
    settingsStore.set('github:tracked-repos', filteredTracked)
    settingsStore.set('github:trusted-repos', filteredTrusted)
    return { ok: true }
  }))

  ipcMain.handle('github:get-trust-list', () => handleIpc(() => {
    return {
      trusted: settingsStore.get('github:trusted-repos', []) as string[],
      tracked: settingsStore.get('github:tracked-repos', []) as string[],
    }
  }))

  ipcMain.handle('github:test-connection', () => handleIpc(async () => {
    const token = authManager.getApiKey('github')
    if (!token) throw new Error('NO_TOKEN')
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'COPERNICUS-IDE' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const user = await res.json() as any
    return { login: user.login, avatar_url: user.avatar_url }
  }))

  // Git Handlers
  ipcMain.handle('git:init-workspace', (_e, opts: any) => handleIpc(async () => {
    const root = fsManager.getRootPath()
    if (!root) throw new Error('NO_ROOT')
    const { execSync } = await import('child_process')
    if (!fs.existsSync(path.join(root, '.git'))) {
      execSync('git init', { cwd: root })
    }
    if (opts.gitignoreTemplate && opts.gitignoreTemplate !== 'None') {
      const content = `# gitignore for ${opts.gitignoreTemplate}\nnode_modules/\ndist/\n.env\n`
      fs.writeFileSync(path.join(root, '.gitignore'), content)
    }
    if (opts.authorName) execSync(`git config user.name "${opts.authorName}"`, { cwd: root })
    if (opts.authorEmail) execSync(`git config user.email "${opts.authorEmail}"`, { cwd: root })
    return true
  }))

  // MCP Handlers
  ipcMain.handle('mcp:list-servers', () => handleIpc(() => {
    const configPath = path.join(COPERNICUS_HOME, 'mcp_config.json')
    if (!fs.existsSync(configPath)) return []
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  }))

  ipcMain.handle('mcp:save-servers', (_e, servers: any[]) => handleIpc(() => {
    const configPath = path.join(COPERNICUS_HOME, 'mcp_config.json')
    fs.writeFileSync(configPath, JSON.stringify(servers, null, 2))
    return true
  }))

  ipcMain.handle('mcp:test-server', (_e, server: any) => handleIpc(async () => {
    if (server.transport === 'sse') {
      const res = await fetch(server.url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
      return res.ok
    }
    return true
  }))

  // Environment Handlers
  ipcMain.handle('env:scan', () => handleIpc(async () => {
    const check = async (bin: string): Promise<{ found: boolean; version?: string }> => {
      try {
        const { execSync } = await import('child_process')
        const v = execSync(`${bin} --version 2>/dev/null || ${bin} -v 2>/dev/null`,
                           { timeout: 3000 }).toString().trim()
        return { found: true, version: v.split('\n')[0].trim() }
      } catch {
        return { found: false }
      }
    }

    const TOOLS = ['node', 'git', 'python3', 'make', 'bun', 'gh', 'curl']
    const toolchain = Object.fromEntries(
      await Promise.all(TOOLS.map(async t => [t, await check(t)]))
    )

    const copernicusRoot = path.join(app.getAppPath(), '..')
    const checkNpmDep = (pkg: string) => {
      const p = path.join(copernicusRoot, 'node_modules', pkg, 'package.json')
      if (!fs.existsSync(p)) return { installed: false }
      try {
        const meta = JSON.parse(fs.readFileSync(p, 'utf-8'))
        return { installed: true, version: meta.version }
      } catch { return { installed: false } }
    }

    const IDE_DEPS = ['playwright-core', 'eslint', 'vitest']
    const ideDeps = Object.fromEntries(IDE_DEPS.map(d => [d, checkNpmDep(d)]))

    return { toolchain, ideDeps }
  }))

  ipcMain.handle('env:install', (_e, opts: { id: string; label: string; command: string; cwd?: string }) => handleIpc(async () => {
    if (!/^[a-zA-Z0-9 _./-]+$/.test(opts.command)) {
      throw new Error('INVALID_COMMAND')
    }
    const termId = `env-install-${opts.id}-${Date.now()}`
    const cwd = opts.cwd ?? fsManager.getRootPath()
    if (win) {
      win.webContents.send('terminal:spawn', { id: termId, label: opts.label, ephemeral: true })
      ptyManager.createEphemeral(termId, opts.command, cwd, win)
    }
    return termId
  }))

  ipcMain.handle('env:get-versions', () => handleIpc(() => ({
    node: process.versions.node,
    electron: process.versions.electron ?? '',
    appVersion: app.getVersion(),
    platform: process.platform,
  })))

  // LLM Chat
  ipcMain.handle('chat:send', (_event, payload: any) => handleIpc(async () => {
    llmService.streamChat(payload).catch(err => console.error('[LLM] streamChat error:', err))
    return true
  }))

  // Review
  ipcMain.handle('review:log', (_event, { verdicts }: any) => handleIpc(() => {
    stateLedger.logIntent(`REVIEW: [Claude: ${verdicts.claude}] [Gemini: ${verdicts.gemini}]`, 'COMPLETED', 'sentinel')
    return true
  }))

  // Slash Commands
  setupDispatcherHandlers();

  // Codebase Indexing
  ipcMain.handle('codebase:index-status', () => handleIpc(() => codebaseIndexer.getStatus()))
  ipcMain.handle('codebase:search', async (_event, query: string) => handleIpc(() => codebaseIndexer.search(query)))

  // File System
  ipcMain.handle('fs:list-dir', (_event, dirPath: string) => handleIpc(() => fsManager.listDir(dirPath)))
  ipcMain.handle('fs:open-file', (_event, filePath: string) => handleIpc(() => fsManager.readFile(filePath)))
  ipcMain.handle('fs:read-file', (_event, filePath: string) => handleIpc(() => {
    const res = fsManager.readFile(filePath)
    return res.ok ? res.data : ''
  }))
  ipcMain.handle('fs:save-file', (_event, { filePath, content }: any) => handleIpc(() => {
    const res = fsManager.writeFile(filePath, content)
    if (res.ok) codebaseIndexer.indexFile(filePath).catch(console.error)
    return res
  }))
  ipcMain.handle('app:get-root-path', () => handleIpc(() => fsManager.getRootPath()))

  ipcMain.handle('app:get-user-guide', () => handleIpc(() => {
    const guidePath = path.join(app.getAppPath(), 'docs/help/USER_GUIDE.md')
    try {
      const content = fs.readFileSync(guidePath, 'utf-8')
      return content
    } catch {
      try {
        const fallback = path.join(__dirname, '../../../docs/help/USER_GUIDE.md')
        return fs.readFileSync(fallback, 'utf-8')
      } catch {
        return '# User Guide\n\nGuide not found in packaged app resources.'
      }
    }
  }))

  // Canvas Handlers (Story 153)
  let canvasIframeBounds: { x: number; y: number; width: number; height: number } | null = null

  ipcMain.on('canvas:iframe-bounds', (_event, bounds) => {
    canvasIframeBounds = bounds
  })

  ipcMain.handle('canvas:get-iframe-bounds', () => handleIpc(() => canvasIframeBounds))

  ipcMain.handle('canvas:capture-screenshot', (_event, options?: { x?: number; y?: number; width?: number; height?: number }) => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    const rect = options?.width
      ? { x: options.x ?? 0, y: options.y ?? 0, width: options.width, height: options.height ?? 400 }
      : undefined
    const image = await win.webContents.capturePage(rect)
    return `data:image/png;base64,${image.toPNG().toString('base64')}`
  }))

  ipcMain.handle('canvas:screenshot-preview', () => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    if (!canvasIframeBounds) throw new Error('IFRAME_BOUNDS_UNKNOWN')
    const image = await win.webContents.capturePage(canvasIframeBounds)
    const dataUrl = `data:image/png;base64,${image.toPNG().toString('base64')}`
    win.webContents.send('canvas:render', { content: `<img src="${dataUrl}" style="max-width:100%;display:block;" />` })
    return dataUrl
  }))

  ipcMain.handle('canvas:execute-js', (_event, script: string) => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    const result = await win.webContents.executeJavaScript(script, true)
    return JSON.stringify(result)
  }))

  ipcMain.handle('canvas:send-input', (_event, event: any) => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    win.webContents.sendInputEvent(event)
    return true
  }))

  // ── Browser Handlers (Story 155) ──────────────────────────────────────────
  ipcMain.handle('browser:launch', (_event, opts?: { headless?: boolean; executablePath?: string }) => handleIpc(async () => {
    const { chromium } = await getPlaywright()
    if (browserSession.browser) await browserSession.browser.close()
    browserSession.browser = await chromium.launch({
      headless: opts?.headless ?? true,
      executablePath: opts?.executablePath,
    })
    const context = await browserSession.browser.newContext()
    browserSession.page = await context.newPage()
    return true
  }))

  ipcMain.handle('browser:navigate', (_event, url: string) => handleIpc(async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    await browserSession.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    return browserSession.page.url()
  }))

  ipcMain.handle('browser:screenshot', (_event, opts?: { selector?: string }) => handleIpc(async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    let buffer: Buffer
    if (opts?.selector) {
      const el = await browserSession.page.$(opts.selector)
      if (!el) throw new Error(`Selector not found: ${opts.selector}`)
      buffer = await el.screenshot()
    } else {
      buffer = await browserSession.page.screenshot({ fullPage: false })
    }
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
    if (win) {
      win.webContents.send('canvas:render', { content: `<img src="${dataUrl}" style="max-width:100%;display:block;margin:auto;" />` })
    }
    return dataUrl
  }))

  ipcMain.handle('browser:click', (_event, selector: string) => handleIpc(async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    await browserSession.page.click(selector, { timeout: 5000 })
    return true
  }))

  ipcMain.handle('browser:fill', (_event, { selector, value }: { selector: string; value: string }) => handleIpc(async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    await browserSession.page.fill(selector, value)
    return true
  }))

  ipcMain.handle('browser:evaluate', (_event, script: string) => handleIpc(async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    const result = await browserSession.page.evaluate(script)
    return JSON.stringify(result)
  }))

  ipcMain.handle('browser:close', () => handleIpc(async () => {
    if (browserSession.browser) {
      await browserSession.browser.close()
      browserSession.browser = null
      browserSession.page = null
    }
    return true
  }))

  // ── Jules Handlers (Story 161) ──────────────────────────────────────────
  ipcMain.handle('jules:dispatch-session', (_e, storyId: string) => handleIpc(async () => {
    const story = stateLedger.getStoryById(storyId)
    if (!story) throw new Error('STORY_NOT_FOUND')

    const apiKey = authManager.getApiKey('jules')
    if (!apiKey) throw new Error('JULES_API_KEY_MISSING')

    const repo = authManager.getBaseUrl?.('jules') ?? ''
    if (!repo) throw new Error('JULES_REPO_NOT_CONFIGURED')

    const result = await dispatchJulesSession({
      story, repo, branch: 'main', apiKey,
      requirePlanApproval: false,
    })

    if (result.ok && result.sessionId) {
      julesMonitor.startWatching(result.sessionId)
    }

    return result
  }))

  ipcMain.handle('jules:list-sessions', (_e, status?: string) => handleIpc(() =>
    stateLedger.listJulesSessions(status)))

  ipcMain.handle('jules:story-sessions', (_e, storyId: string) => handleIpc(() =>
    stateLedger.getJulesSessionsByStory(storyId)))

  ipcMain.handle('jules:retry-session', (_e, storyId: string) => handleIpc(async () => {
    const story = stateLedger.getStoryById(storyId)
    if (!story) throw new Error('STORY_NOT_FOUND')
    const apiKey = authManager.getApiKey('jules')
    if (!apiKey) throw new Error('NO_KEY')
    const repo = authManager.getBaseUrl?.('jules') ?? ''
    const result = await dispatchJulesSession({ story, repo, branch: 'main', apiKey })
    if (result.ok && result.sessionId) julesMonitor.startWatching(result.sessionId)
    return result
  }))

  ipcMain.handle('touchbar:rebuild', (_e, config: TouchBarConfig) => handleIpc(() => {
    if (process.platform !== 'darwin' || !win) return
    touchBarCleanup?.remove()
    touchBarCleanup = createTouchBar(win, config)
    return true
  }))

  // Workflow
  workflowEngine.setServices({
    authManager,
    modelRegistry,
    ptyManager,
    stateLedger,
    fsManager,
    win: win!, // Added for Story 153
  });

  ipcMain.handle('workflow:run', (_event, graph) => handleIpc(() => workflowEngine.runGraph(graph)))
  ipcMain.handle('workflow:status', () => handleIpc(() => ({
    state: workflowEngine.getState(),
    nodeStatuses: workflowEngine.getNodeStatusDetails(),
    context: workflowEngine.getContext(),
  })))
  ipcMain.handle('workflow:list-templates', () => handleIpc(() =>
    WORKFLOW_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }))
  ))
  ipcMain.handle('workflow:get-template', (_event, id: string) => handleIpc(() => {
    const tpl = WORKFLOW_TEMPLATES.find(t => t.id === id)
    if (!tpl) throw new Error('NOT_FOUND')
    return tpl
  }))
  ipcMain.handle('workflow:reset', () => handleIpc(() => {
    workflowEngine.reset()
    return true
  }))

  ipcMain.handle('app:quit', () => handleIpc(() => { app.quit(); }));
}

app.on('window-all-closed', () => {
  ptyManager.killAll();
  stateLedger.close();
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('will-quit', () => { globalShortcut.unregisterAll() })

app.on('before-quit', async () => {
  if (browserSession.browser) await browserSession.browser.close().catch(() => {})
})

app.whenReady().then(() => {
  registerIpcHandlers();

  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'COPERNICUS',
      applicationVersion: '0.1.0',
      copyright: '© 2026 COPERNICUS IDE Team',
      credits: 'Professional Phosphor Edition',
    });
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-eval' blob: file:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://openrouter.ai https://api.openai.com https://generativelanguage.googleapis.com https://api.github.com; worker-src 'self' blob: file:;"]
      }
    })
  })

  // Determine actual project root
  const settings = loadSettings();
  let workspaceRoot = settings.workspace as string;

  if (!workspaceRoot) {
    workspaceRoot = path.join(app.getPath('documents'), 'Copernicus');
    if (!fs.existsSync(workspaceRoot)) {
      try {
        fs.mkdirSync(workspaceRoot, { recursive: true });
      } catch (e) {
        console.error('Failed to create default workspace directory:', e);
        workspaceRoot = os.homedir();
      }
    }
  }

  // Update managers with the true workspace path
  fsManager.setRootPath(workspaceRoot);
  storiesManager.setProjectRoot(workspaceRoot);

  ensureCopernicusDirectory();
  createWindow();

  globalShortcut.register('CommandOrControl+P', () => win?.webContents.send('layout:open-palette', { mode: 'all' }))
  globalShortcut.register('CommandOrControl+Shift+P', () => win?.webContents.send('layout:open-palette', { mode: 'commands' }))

  codebaseIndexer.startIndexing(fsManager.getRootPath()).catch(console.error)
  if (app.isPackaged) setupAutoUpdater();
})

app.on('browser-window-focus', () => {
  const synced = storiesManager.syncFromDisk()
  if (synced > 0) {
    console.log(`[StoriesManager] Synced ${synced} external story edits on focus`)
    win?.webContents.send('stories:updated', storiesManager.listStories())
  }
})
