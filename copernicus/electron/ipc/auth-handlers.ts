import { ipcMain, BrowserWindow, shell } from 'electron'
import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { handleIpc } from '../utils/handle-ipc'

import { IpcHandlerDeps } from './deps'

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const { authManager, settingsStore, storiesManager, fsManager, ptyManager } = deps

  // ── Anthropic: API key only — no OAuth ────────
  ipcMain.handle('oauth:start-anthropic', () => handleIpc('oauth:start-anthropic', [], () => {
    throw new Error('Anthropic does not support OAuth. Paste your API key from console.anthropic.com/settings/keys into the Providers settings panel.')
  }))

  // ── OpenRouter OAuth ──────────────────────────────────────────────────────
  const OPENROUTER_OAUTH_PORT = 47324

  ipcMain.handle('oauth:start-openrouter', () => handleIpc('oauth:start-openrouter', [], () => {
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
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
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
    const data = await res.json() as { access_token?: string; error_description?: string }
    if (!data.access_token) throw new Error(data.error_description ?? 'Token exchange failed')
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    const user = await userRes.json() as { email?: string }
    return { access_token: data.access_token, email: (user.email ?? '') }
  }

  ipcMain.handle('app:start-oauth-listener', () => handleIpc('app:start-oauth-listener', [], () => {
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
          if (!fs.existsSync(geminiDir)) await fs.promises.mkdir(geminiDir, { recursive: true })
          const geminiCreds = {
            access_token,
            client_id: clientId,
            token_type: 'Bearer',
            expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
            email
          }
          await fs.promises.writeFile(path.join(geminiDir, 'oauth_creds.json'), JSON.stringify(geminiCreds, null, 2))

          win?.webContents.send('oauth:google-complete', { ok: true, email })
          if (win) { win.show(); win.focus(); }
          resolve({ ok: true })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
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

  ipcMain.handle('oauth:start-google', () => handleIpc('oauth:start-google', [], () => {
    throw new Error('Use app:start-oauth-listener instead')
  }))

  // Auth Handlers
  ipcMain.handle('auth:status', () => handleIpc(async () => authManager.getAuthStatus()));
  ipcMain.handle('auth:store-api-key', (_, provider: string, apiKey: string, baseUrl?: string) => handleIpc('auth:store-api-key', [provider, apiKey, baseUrl], () => authManager.storeApiKey(provider, apiKey, baseUrl, 'apikey')));
  ipcMain.handle('auth:revoke', (_, provider: string) => handleIpc('auth:revoke', [provider], () => authManager.revokeApiKey(provider)));
  ipcMain.handle('auth:get-api-key', (_, provider: string) => handleIpc('auth:get-api-key', [provider], () => {
    if (provider === 'openai' || provider === 'openrouter' || provider === 'deepinfra') {
       const resolved = authManager.resolveOpenAICompatibleKey();
       return resolved ? resolved.key : null;
    }
    return authManager.getApiKey(provider);
  }));
  ipcMain.handle('auth:resolve-openai-config', () => handleIpc('auth:resolve-openai-config', [], () => authManager.resolveOpenAICompatibleKey()));

  ipcMain.handle('auth:validate-ollama-cloud', () => handleIpc('auth:validate-ollama-cloud', [], async () => {
    const key = authManager.getApiKey('ollama')
    if (!key) return false
    const cloudHost = authManager.getBaseUrl('ollama') || 'https://ollama.com'
    const res = await fetch(`${cloudHost}/api/tags`, {
      headers: { Authorization: `Bearer ${key}` }
    }).catch(() => null)
    return res?.ok ?? false
  }))

  ipcMain.handle('auth:revoke-key', (_e, provider) => handleIpc('auth:revoke-key', [provider], () => authManager.revokeKey(provider)))

  // GitHub Handlers
  ipcMain.handle('github:set-trust', (_e, repoName: string, trusted: boolean) => handleIpc('github:set-trust', [repoName, trusted], () => {
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

  ipcMain.handle('github:add-repo', (_e, repoName: string) => handleIpc('github:add-repo', [repoName], () => {
    const tracked: string[] = settingsStore.get('github:tracked-repos', []) as string[]
    if (!tracked.includes(repoName)) {
      tracked.push(repoName)
      settingsStore.set('github:tracked-repos', tracked)
    }
    return { ok: true, tracked }
  }))

  ipcMain.handle('github:remove-repo', (_e, repoName: string) => handleIpc('github:remove-repo', [repoName], () => {
    const tracked: string[] = settingsStore.get('github:tracked-repos', []) as string[]
    const trusted: string[] = settingsStore.get('github:trusted-repos', []) as string[]
    const filteredTracked = tracked.filter(r => r !== repoName)
    const filteredTrusted = trusted.filter(r => r !== repoName)
    settingsStore.set('github:tracked-repos', filteredTracked)
    settingsStore.set('github:trusted-repos', filteredTrusted)
    return { ok: true }
  }))

  // GitHub trust list
  ipcMain.handle('github:get-trust-list', () => handleIpc('github:get-trust-list', [], () => {
    return {
      trusted: settingsStore.get('github:trusted-repos', []) as string[],
      tracked: settingsStore.get('github:tracked-repos', []) as string[],
    }
  }))

  ipcMain.handle('github:set-target-repo', (_e, repoName: string) => handleIpc('github:set-target-repo', [repoName], () => {
    settingsStore.set('github:target-repo', repoName)
    authManager.setBaseUrl('jules', repoName)
    
    // Resolve local path and update StoriesManager
    const rootPath = fsManager.getRootPath()
    const localName = repoName.split('/')[1] || repoName
    const projectPath = path.join(rootPath, localName)
    if (fs.existsSync(projectPath)) {
        storiesManager.targetProject(projectPath)
    }
    
    return { ok: true }
  }))

  ipcMain.handle('github:get-target-repo', () => handleIpc('github:get-target-repo', [], () => {
    return settingsStore.get('github:target-repo', null)
  }))

  ipcMain.handle('github:search', (_e, query: string) => handleIpc('github:search', [query], async () => {
    const token = authManager.getApiKey('github')
    if (!token) throw new Error('NO_TOKEN')
    const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`, {
      headers: { 
        Authorization: `Bearer ${token}`, 
        'User-Agent': 'COPERNICUS-IDE',
        'Accept': 'application/vnd.github+json'
      }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { items: unknown[] }
    return data.items
  }))

  ipcMain.handle('github:clone-repo', (_e, { repoUrl, repoName }: { repoUrl: string, repoName: string }) => handleIpc('github:clone-repo', [{ repoUrl, repoName }], async () => {
    if (!win) throw new Error('NO_WINDOW')
    const termId = `git-clone-${Date.now()}`
    const rootPath = fsManager.getRootPath()
    const targetPath = path.join(rootPath, repoName)
    win.webContents.send('terminal:spawn', { id: termId, label: `Clone ${repoName}`, ephemeral: true })
    ptyManager.createEphemeral(termId, `git clone ${repoUrl} ${targetPath}`, rootPath, win)
    return { ok: true, termId }
  }))

  ipcMain.handle('github:test-connection', () => handleIpc('github:test-connection', [], async () => {
    const token = authManager.getApiKey('github')
    if (!token) throw new Error('NO_TOKEN')
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'COPERNICUS-IDE' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const user = await res.json() as { login: string; avatar_url: string }
    return { login: user.login, avatar_url: user.avatar_url }
  }))
}
