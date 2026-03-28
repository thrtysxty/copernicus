import { ipcMain, BrowserWindow, shell, app, dialog } from 'electron'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { assertSafePath } from '../utils/path-guard'
import { setupCommandHandlers as setupDispatcherHandlers } from '../commands/dispatcher'
import { addRecentProject } from '../utils/recent-projects'

import { IpcHandlerDeps } from './deps'

const execFileAsync = promisify(execFile)

function computeCoveragePct(coverageMap: Record<string, any>): number {
  const files = Object.values(coverageMap)
  if (!files.length) return 0
  const total   = files.reduce((acc: number, f: any) => acc + (f.s?.total   ?? 0), 0)
  const covered = files.reduce((acc: number, f: any) => acc + (f.s?.covered ?? 0), 0)
  return total > 0 ? Math.round((covered / total) * 100 * 10) / 10 : 0
}

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const {
    settingsStore, 
    LOG_DIR, 
    devtimeManager, 
    storiesManager, 
    stateLedger, 
    fsManager, 
    workflowEngine,
    authManager,
    codebaseIndexer,
    lspManager,
    ptyManager, // Re-added ptyManager
    createTouchBar,
  } = deps

  ipcMain.handle('settings:save', (_event, patch: unknown) => handleIpc('settings:save', [patch], async () => {
    if (typeof patch === 'object' && patch !== null) settingsStore.setAll(patch as Record<string, any>)
    return true
  }))

  ipcMain.handle('settings:load', () => handleIpc('settings:load', [], () => settingsStore.getAll()))

  ipcMain.handle('app:open-log', () => handleIpc('app:open-log', [], () => {
    const logFilePath = path.join(LOG_DIR, 'copernicus.log')
    return shell.openPath(logFilePath)
  }))

  ipcMain.handle('app:open-external', (_event, url: string) => handleIpc('app:open-external', [url], async () => {
    let parsed: URL
    try { parsed = new URL(url) } catch { throw new Error(`Invalid URL: ${url}`) }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Blocked external URL with protocol: ${parsed.protocol}`)
    }
    return shell.openExternal(url)
  }))

  ipcMain.handle('restart-app', () => handleIpc('restart-app', [], () => { app.relaunch(); app.exit(0); }));

  // Devtime Handlers
  ipcMain.handle('devtime:start', (_event, data: any) => handleIpc('devtime:start', [data], () => {
    if (data.repo_path) {
      storiesManager.setProjectRoot(data.repo_path)
    }
    return devtimeManager.startSession(data)
  }));
  ipcMain.handle('devtime:status', () => handleIpc('devtime:status', [], () => ({
    session: devtimeManager.getActiveSession(),
    total: devtimeManager.getTotalMonthValue(),
    isRepoTargeted: storiesManager.isRepoTargeted()
  })));
  ipcMain.handle('devtime:close', (_event, data: any) => handleIpc('devtime:close', [data], () => devtimeManager.closeSession(data)));
  ipcMain.handle('devtime:defaults', () => handleIpc('devtime:defaults', [], () => devtimeManager.getDefaults()));
  ipcMain.handle('devtime:report', () => handleIpc('devtime:report', [], () => devtimeManager.getReport()));
  ipcMain.handle('devtime:list-stories', (_event, repoPath: string) => handleIpc('devtime:list-stories', [repoPath], () => devtimeManager.listStories(repoPath)));

  // CAPEX Analytics (Story 162)
  ipcMain.handle('devtime:run-tests', () => handleIpc('devtime:run-tests', [], async () => {
    const start = Date.now()
    const { stdout } = await execFileAsync(
      'npx',
      ['vitest', 'run', '--reporter=json'],
      { cwd: path.join(__dirname, '..'), encoding: 'utf-8', timeout: 120_000, shell: false }
    )
    const result = JSON.parse(stdout.toString())
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

  ipcMain.handle('devtime:run-playwright', (_e, { file } = {} as { file?: string }) => handleIpc('devtime:run-playwright', [{ file }], async () => {
    return new Promise((resolve, reject) => {
      const args = ['playwright', 'test', '--reporter=json']
      if (file) {
        assertSafePath(file);
        args.push(file);
      }
      
      const child = spawn('npx', args, {
        cwd: fsManager.getRootPath(),
        shell: false,
        env: { ...process.env, CI: 'true' }
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', d => stdout += d.toString())
      child.stderr.on('data', d => stderr += d.toString())
      
      child.on('close', () => {
        try {
          const data = JSON.parse(stdout)
          const results: any[] = []
          
          const flatten = (items: any[]) => {
            items.forEach(suite => {
              if (suite.specs) {
                suite.specs.forEach((spec: any) => {
                  spec.tests.forEach((test: any) => {
                    test.results.forEach((res: any) => {
                      results.push({
                        title: spec.title,
                        status: res.status === 'passed' ? 'PASS' : 'FAIL',
                        duration: res.duration
                      })
                    })
                  })
                })
              }
              if (suite.suites) flatten(suite.suites)
            })
          }
          if (data.suites) flatten(data.suites)
          resolve({ results })
        } catch (err) {
          log.error('[playwright] Failed to parse output:', stdout, stderr)
          resolve({ results: [] })
        }
      })
      
      child.on('error', err => reject(err))
    })
  }))

  ipcMain.handle('devtime:test-history', (_e, limit: number = 20) => handleIpc('devtime:test-history', [limit], () => stateLedger.getTestRunHistory(limit)))

  ipcMain.handle('ledger:daily-costs', (_e, days: number = 30) => handleIpc('ledger:daily-costs', [days], () => stateLedger.getDailyCosts(days)))

  ipcMain.handle('ledger:cost-by-model', () => handleIpc('ledger:cost-by-model', [], () => stateLedger.getCostByModel()))

  ipcMain.handle('ledger:cost-by-story', () => handleIpc('ledger:cost-by-story', [], () => stateLedger.getCostByStory()))

  ipcMain.handle('devtime:weekly-velocity', (_e, weeks: number = 8) => handleIpc('devtime:weekly-velocity', [weeks], () => stateLedger.getWeeklyVelocity(weeks)))

  // Model Call Ledger — AC-3 (Story 178)
  ipcMain.handle('ledger:session-stats', (_e, session_id: string) => handleIpc('ledger:session-stats', [session_id], () => stateLedger.getSessionStats(session_id))
  )
  ipcMain.handle('ledger:recent-calls', (_e, limit = 100, panel_id?: string) => handleIpc('ledger:recent-calls', [limit, panel_id], () => stateLedger.getRecentCalls(limit, panel_id))
  )
  ipcMain.handle('ledger:all-time-cost', () => handleIpc('ledger:all-time-cost', [], () => stateLedger.getAllTimeCost())
  )

  ipcMain.handle('ledger:heatmap-data', () => handleIpc('ledger:heatmap-data', [], () => {
    return stateLedger.getCostHeatmapData()
  }))

  // Splash ready — renderer signals splash/wizard complete
  ipcMain.handle('splash-ready', (_e) => handleIpc('splash-ready', [], () => ({ ready: true })))

  // Database IPC
  ipcMain.handle('db:log-intent', (_, content, status, agentId) => handleIpc('db:log-intent', [content, status, agentId], () => stateLedger.logIntent(content, status, agentId)));
  ipcMain.handle('db:get-intents', (_, limit) => handleIpc('db:get-intents', [limit], () => stateLedger.getRecentIntents(limit)));
  ipcMain.handle('db:log-event', (_, type, content, metadata, agentId) => handleIpc('db:log-event', [type, content, metadata, agentId], () => stateLedger.logEvent(type, content, metadata, agentId)));
  ipcMain.handle('db:get-events', (_, limit) => handleIpc('db:get-events', [limit], () => stateLedger.getRecentEvents(limit)));

  ipcMain.handle('db:add-memory', (_e, payload: { content: string, importance?: number, source: string }) =>
    handleIpc('db:add-memory', [payload], () => stateLedger.addProjectMemory(payload))
  )
  ipcMain.handle('db:search-memory', (_e, limit?: number) =>
    handleIpc('db:search-memory', [limit], () => stateLedger.searchProjectMemory(limit ?? 5))
  )

  ipcMain.handle('db:vacuum', () => handleIpc('db:vacuum', [], () => {
    stateLedger.vacuum();
    return true;
  }));



  ipcMain.handle('app:quit', () => handleIpc('app:quit', [], () => { app.quit(); }));

  ipcMain.handle('app:get-recent-projects', () => handleIpc('app:get-recent-projects', [], () => {
    return settingsStore.get('recentProjects', [])
  }))

  ipcMain.handle('app:open-folder-dialog', () => handleIpc('app:open-folder-dialog', [], async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return { path: filePaths[0] }
  }))

  ipcMain.handle('app:switch-workspace', (_e, { path: dirPath }: { path: string }) => handleIpc('app:switch-workspace', [dirPath], async () => {
    if (!fs.existsSync(dirPath)) throw new Error('Path does not exist')
    
    assertSafePath(dirPath);
    
    // Check for .git dir - log warning but don't block
    if (!fs.existsSync(path.join(dirPath, '.git'))) {
      log.warn(`No .git directory found in workspace: ${dirPath}`);
    }

    addRecentProject(dirPath, settingsStore);
    settingsStore.set('workspace', dirPath);
    settingsStore.set('workingDir', dirPath);
    fsManager.setRootPath(dirPath);
    storiesManager.setProjectRoot(dirPath);
    
    // Derived from app:set-root-path
    codebaseIndexer.startIndexing(dirPath).catch(log.error)
    lspManager.stop()
    lspManager.start(dirPath)
    
    const name = path.basename(dirPath) || dirPath
    win.setTitle(name)
    
    // Notify renderer so workingDir stays in sync
    win.webContents.send('app:workspace-changed', { path: dirPath, name })
    return true
  }))

  // Command Center (Story 184)
  ipcMain.handle('command:request-telemetry', () => handleIpc('command:request-telemetry', [], () => {
    const swarms = (workflowEngine as any).getActiveSessions?.() ?? []
    const tasks = (workflowEngine as any).getRunningGraphs?.() ?? []
    win?.webContents.send('command:telemetry-update', { agentSwarms: swarms, activeTasks: tasks, mcpUsage: [] })
    return true
  }))

  // MCP Handlers (Story 190)
  ipcMain.handle('mcp:list-servers', () => handleIpc('mcp:list-servers', [], () => {
    const settings = settingsStore.getAll()
    return (settings.mcp as any)?.servers || []
  }))

  ipcMain.handle('mcp:save-servers', (_e, servers: any[]) => handleIpc('mcp:save-servers', [servers], () => {
    settingsStore.setAll({ mcp: { servers } })
    return true
  }))

  ipcMain.handle('mcp:get-status', (_e) => handleIpc('mcp:get-status', [], () => {
    // Return amber status for all configured servers until MCP runtime is wired
    const settings = settingsStore.getAll()
    const servers: Array<{ name: string }> = settings?.mcp?.servers ?? []
    return servers.map(s => ({ name: s.name, status: 'disconnected' }))
  }))

  ipcMain.handle('mcp:test-server', (_e, server: any) => handleIpc('mcp:test-server', [server], async () => {
    if (server.transport === 'sse') {
      const res = await fetch(server.url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
      return res.ok
    }
    return true
  }))

  // Environment Handlers
  ipcMain.handle('env:scan', () => handleIpc('env:scan', [], async () => {
    const check = async (bin: string): Promise<{ found: boolean; version?: string }> => {
      try {
        const ALLOWED_BINS = ['git', 'node', 'python3', 'gemini', 'npm', 'npx', 'make', 'bun', 'gh', 'curl']
        if (!ALLOWED_BINS.includes(bin)) throw new Error(`Disallowed binary: ${bin}`)
        const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 3000, shell: false })
        const v = stdout.toString().trim()
        return { found: true, version: v.split('\n')[0]?.trim() ?? '' }
      } catch {
        return { found: false }
      }
    }

    const TOOLS = ['node', 'git', 'python3', 'make', 'bun', 'gh', 'curl']
    const toolchain = Object.fromEntries(
      await Promise.all(TOOLS.map(async t => [t, await check(t)]))
    )

    const copernicusRoot = path.join(app.getAppPath(), '..')
    const checkNpmDep = async (pkg: string) => {
      const p = path.join(copernicusRoot, 'node_modules', pkg, 'package.json')
      if (!fs.existsSync(p)) return { installed: false }
      try {
        const meta = JSON.parse(await fs.promises.readFile(p, 'utf-8'))
        return { installed: true, version: meta.version }
      } catch { return { installed: false } }
    }

    const IDE_DEPS = ['playwright-core', 'eslint', 'vitest']
    const ideDeps = Object.fromEntries(await Promise.all(IDE_DEPS.map(async d => [d, await checkNpmDep(d)])))

    return { toolchain, ideDeps }
  }))

  ipcMain.handle('env:install', (_e, opts: { id: string; label: string; command: string; cwd?: string }) => handleIpc('env:install', [opts], async () => {
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

  ipcMain.handle('env:get-versions', () => handleIpc('env:get-versions', [], () => ({
    node: process.versions.node,
    electron: process.versions.electron ?? '',
    appVersion: app.getVersion(),
    platform: process.platform,
  })))

  ipcMain.handle('touchbar:rebuild', (_e, config: any) => handleIpc('touchbar:rebuild', [config], () => {
    if (process.platform !== 'darwin' || !win) return
    deps.touchBarCleanup?.remove()
    deps.touchBarCleanup = createTouchBar(win, config)
    return true
  }))

  // Git Handlers
  ipcMain.handle('git:branch', () => handleIpc('git:branch', [], async () => {
    return new Promise((resolve) => {
      execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { shell: false }, (error: any, stdout: string) => {
        if (error) resolve('unknown');
        else resolve(stdout.trim());
      });
    });
  }));

  ipcMain.handle('git:init-workspace', (_e, opts: any) => handleIpc('git:init-workspace', [opts], async () => {
    const root = fsManager.getRootPath()
    if (!root) throw new Error('NO_ROOT')
    if (!fs.existsSync(path.join(root, '.git'))) {
      await execFileAsync('git', ['init'], { cwd: root, shell: false })
    }
    if (opts.gitignoreTemplate && opts.gitignoreTemplate !== 'None') {
      const content = `# gitignore for ${opts.gitignoreTemplate}\nnode_modules/\ndist/\n.env\n`
      await fs.promises.writeFile(path.join(root, '.gitignore'), content)
    }
    if (opts.authorName) await execFileAsync('git', ['config', 'user.name', opts.authorName], { cwd: root, shell: false })
    if (opts.authorEmail) await execFileAsync('git', ['config', 'user.email', opts.authorEmail], { cwd: root, shell: false })
    return true
  }))

  ipcMain.handle('app:set-root-path', (_e, dirPath: string) => handleIpc('app:set-root-path', [dirPath], async () => {
    assertSafePath(dirPath);
    settingsStore.set('workspace', dirPath);
    fsManager.setRootPath(dirPath);
    storiesManager.setProjectRoot(dirPath);
    // Immediately start indexing and LSP for the new workspace
    codebaseIndexer.startIndexing(dirPath).catch(log.error)
    lspManager.stop()
    lspManager.start(dirPath)
    // Auto-init git if not already a repo
    const gitDir = path.join(dirPath, '.git')
    if (!fs.existsSync(gitDir)) {
      try { await execFileAsync('git', ['init'], { cwd: dirPath, shell: false }) } catch { /* non-fatal */ }
    }
    // Notify renderer so workingDir stays in sync
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('app:workspace-changed', { path: dirPath }))
    return true;
  }));

  ipcMain.handle('app:get-root-path', () => handleIpc('app:get-root-path', [], () => {
    // Return null when no workspace is configured (first-run state triggers wizard)
    return (settingsStore.get('workspace', null) as string | null) || null;
  }))

  ipcMain.handle('app:get-user-guide', () => handleIpc('app:get-user-guide', [], async () => {
    const guidePath = path.join(app.getAppPath(), 'docs/help/USER_GUIDE.md')
    try {
      const content = await fs.promises.readFile(guidePath, 'utf-8')
      return content
    } catch {
      try {
        const fallback = path.join(__dirname, '../../../docs/help/USER_GUIDE.md')
        return await fs.promises.readFile(fallback, 'utf-8')
      } catch {
        return '# User Guide\n\nGuide not found in packaged app resources.'
      }
    }
  }))

  ipcMain.handle('check-cli-tools', () => handleIpc('check-cli-tools', [], async () => {
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
        execFile(cmd, [tool], { env, shell: false }, (error) => { results[tool] = !error; resolve(); });
      }))
    );
    return results;
  }));

  ipcMain.handle('save-preferences', (_event, preferences: any) => handleIpc('save-preferences', [preferences], async () => {
    const { keys, workspace, ...settings } = preferences;
    if (keys) {
        if (keys.anthropic && keys.anthropic !== 'saved' && keys.anthropic !== 'oauth') await authManager.storeApiKey('anthropic', keys.anthropic, undefined, 'apikey');
        if (keys.google && keys.google !== 'saved' && keys.google !== 'oauth') await authManager.storeApiKey('google', keys.google, undefined, 'apikey');
        if (keys.openrouter && keys.openrouter !== 'saved' && keys.openrouter !== 'oauth') await authManager.storeApiKey('openrouter', keys.openrouter, undefined, 'apikey');
        if (keys.deepinfra && keys.deepinfra !== 'saved') await authManager.storeApiKey('deepinfra', keys.deepinfra, undefined, 'apikey');
    }
    
    settingsStore.setAll({ ...settings, workspace });

    if (workspace) {
      fsManager.setRootPath(workspace);
      storiesManager.setProjectRoot(workspace);
      // Immediately start indexing and LSP for the new workspace
      codebaseIndexer.startIndexing(workspace).catch(log.error)
      lspManager.stop()
      lspManager.start(workspace)
    }
    return true;
  }));

  // Slash Commands
  setupDispatcherHandlers();

  let lastReviewSession: any = null
  ipcMain.handle('review:session-complete', (_e, data: any) => handleIpc('review:session-complete', [data], () => {
    lastReviewSession = data
    win.webContents.send('review:session-complete', data)
    return { ok: true, session: lastReviewSession }
  }))

  ipcMain.handle('chat:send-system', (_e, message: string) => handleIpc('chat:send-system', [message], () => {
    win.webContents.send('chat:receive-system', {
      id: `sys-${Date.now()}`,
      role: 'copernicus',
      content: message,
      created_at: new Date().toISOString()
    })
    return true
  }))

  ipcMain.handle('window:exit-fullscreen', () => handleIpc('window:exit-fullscreen', [], () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w?.isFullScreen()) {
      w.setFullScreen(false)
    }
  }))

  ipcMain.handle('layout:goto-line', (_e, { file, line, col }) => handleIpc('layout:goto-line', [{ file, line, col }], () => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('layout:goto-line', { file, line, col })
  }))

  ipcMain.handle('wizard:get-username', () => handleIpc('wizard:get-username', [], () => {
    try {
      return os.userInfo().username;
    } catch {
      return null;
    }
  }))
}
