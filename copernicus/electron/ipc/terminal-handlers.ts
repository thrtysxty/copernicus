import { ipcMain, BrowserWindow } from 'electron'
import os from 'node:os'
import { execFile } from 'node:child_process'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { GeminiAgent } from '../agents/gemini-agent'
import { assertSafePath } from '../utils/path-guard'

import { IpcHandlerDeps } from './deps'

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const { ptyManager, browserSession, fsManager, getPlaywright } = deps

  // Terminal IPC
  ipcMain.on('terminal-create', (_event, { id, cols, rows, cwd }: { id: string; cols: number; rows: number; cwd?: string }) => {
    const cwdOrHome = cwd || os.homedir();
    let resolvedCwd: string;
    try {
      resolvedCwd = assertSafePath(cwdOrHome);
    } catch {
      resolvedCwd = os.homedir();
    }
    if (win) ptyManager.create(id, cols, rows, resolvedCwd, win);
  });

  ipcMain.handle('terminal:resize', (_e, { id, cols, rows }: { id: string; cols: number; rows: number }) => handleIpc('terminal:resize', [{ id, cols, rows }], () => ptyManager.resize(id, cols, rows)));

  ipcMain.handle('terminal:input', (_e, { id, data }: { id: string; data: string }) =>
    handleIpc('terminal:input', [id, data], async () => {
      await ptyManager.write(id, data)
      return { ok: true }
    })
  )

  ipcMain.on('terminal-write', (_event, payload: { id: string; data: string }) => {
    if (payload?.id && payload?.data) ptyManager.write(payload.id, payload.data);
  });

  ipcMain.on('terminal-kill', (_event, { id }: { id: string }) => ptyManager.kill(id));

  ipcMain.handle('terminal:stop-agent', (_event, { id }: { id: string }) => handleIpc('terminal:stop-agent', [{ id }], () => ptyManager.kill(id)));

  ipcMain.handle('terminal:spawn', (_e, { command, cwd, label, id }: { command: string; cwd: string; label: string; id?: string }) => handleIpc('terminal:spawn', [{ command, cwd, label, id }], async () => {
    const termId = id || `term-${Date.now()}`
    const resolvedCwd = assertSafePath(cwd)
    if (win) {
      win.webContents.send('terminal:spawn', { id: termId, label, ephemeral: true })
      ptyManager.createEphemeral(termId, command, resolvedCwd, win)
    }
    return termId
  }))

  ipcMain.on('terminal:spawn-agent', (_event, { agentId }: { agentId: string }) => {
    if (!/^[a-z0-9_-]+$/.test(agentId)) return;
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('terminal:activate-tab', { agentId }));
  })

  // System Execution
  ipcMain.on('system:make', (_, target: string) => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (ALLOWED.includes(target)) deps.spawn('make', [target], { cwd: fsManager.getRootPath(), shell: false })
  });

  // ── Browser Handlers (Story 155) ──────────────────────────────────────────
  ipcMain.handle('browser:launch', (_event, opts?: { headless?: boolean; executablePath?: string }) => handleIpc('browser:launch', [opts], async () => {
    const { chromium } = await getPlaywright()
    if (browserSession.browser) await browserSession.browser.close()
    const browser = await chromium.launch({
      headless: opts?.headless ?? true,
      executablePath: opts?.executablePath,
    })
    browserSession.browser = browser
    const context = await browser.newContext()
    browserSession.page = await context.newPage()
    return true
  }))

  ipcMain.handle('browser:navigate', (_event, url: string) => handleIpc('browser:navigate', [url], async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    await browserSession.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    return browserSession.page.url()
  }))

  ipcMain.handle('browser:screenshot', (_event, opts?: { selector?: string }) => handleIpc('browser:screenshot', [opts], async () => {
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

  ipcMain.handle('browser:click', (_event, selector: string) => handleIpc('browser:click', [selector], async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    await browserSession.page.click(selector, { timeout: 5000 })
    return true
  }))

  ipcMain.handle('browser:fill', (_event, { selector, value }: { selector: string; value: string }) => handleIpc('browser:fill', [{ selector, value }], async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    await browserSession.page.fill(selector, value)
    return true
  }))

  ipcMain.handle('browser:evaluate', (_event, script: string) => handleIpc('browser:evaluate', [script], async () => {
    if (!browserSession.page) throw new Error('NO_BROWSER')
    const result = await browserSession.page.evaluate(script)
    return JSON.stringify(result)
  }))

  ipcMain.handle('browser:close', () => handleIpc('browser:close', [], async () => {
    if (browserSession.browser) {
      await browserSession.browser.close()
      browserSession.browser = null
      browserSession.page = null
    }
    return true
  }))

  // Container Runtime Handlers
  ipcMain.handle('runtime:list-containers', () => handleIpc('runtime:list-containers', [], async () => {
    return new Promise((resolve) => {
      execFile('docker', ['ps', '-a', '--format', '{{json .}}'], { shell: false }, (error: any, stdout: string) => {
        if (error) {
          log.error('Failed to list containers:', error);
          resolve([]);
          return;
        }

        try {
          const lines = stdout.trim().split('\n').filter(Boolean);
          const containers = lines.map(line => JSON.parse(line));
          resolve(containers);
        } catch (e) {
          log.error('Failed to parse container list:', e);
          resolve([]);
        }
      });
    });
  }));

  ipcMain.handle('runtime:manage-container', (_event, { id, action }: { id: string, action: 'start' | 'stop' | 'logs' }) => handleIpc('runtime:manage-container', [{ id, action }], async () => {
    if (action === 'logs') {
      const termId = `logs-${id}-${Date.now()}`;
      if (win) {
        win.webContents.send('terminal:spawn', { id: termId, label: `Logs: ${id.substring(0, 8)}`, ephemeral: true });
        ptyManager.createEphemeral(termId, `docker logs -f ${id}`, fsManager.getRootPath(), win);
      }
      return { ok: true, termId };
    }

    return new Promise((resolve, reject) => {
      execFile('docker', [action, id], { shell: false }, (error: any, _stdout: string, stderr: string) => {
        if (error) {
          log.error(`Failed to ${action} container ${id}:`, error, stderr);
          reject(new Error(stderr || error.message));
        } else {
          resolve({ ok: true });
        }
      });
    });
  }));

  // ── Gemini PTY Agent (Story 195) ──────────────────────────────────────────
  const geminiAgents = new Map<string, GeminiAgent>()

  ipcMain.handle('gemini:spawn', (_e, opts: { cwd: string }) => handleIpc('gemini:spawn', [opts], async () => {
      let spawnCwd: string
      try {
        spawnCwd = opts.cwd ? assertSafePath(opts.cwd) : fsManager.getRootPath()
      } catch {
        spawnCwd = fsManager.getRootPath()
      }
      const agent = new GeminiAgent({
        cwd: spawnCwd,
        onOutput: (chunk) => {
          win?.webContents.send('gemini:output', { sessionId: agent.sessionId, chunk })
        },
      })
      await agent.spawn()
      geminiAgents.set(agent.sessionId, agent)
      agent.on('exit', () => geminiAgents.delete(agent.sessionId))
      return { sessionId: agent.sessionId }
    })
  )

  ipcMain.handle('gemini:send-prompt', (_e, { sessionId, text }: { sessionId: string; text: string }) => handleIpc('gemini:send-prompt', [{ sessionId, text }], async () => {
      const agent = geminiAgents.get(sessionId)
      if (!agent) throw new Error(`No Gemini session: ${sessionId}`)
      const response = await agent.sendPrompt(text)
      return { response }
    })
  )

  ipcMain.handle('gemini:close', (_e, sessionId: string) => handleIpc('gemini:close', [sessionId], () => {
      geminiAgents.get(sessionId)?.close()
      geminiAgents.delete(sessionId)
      return null
    })
  )

  ipcMain.handle('gemini:status', () =>
    handleIpc(async () => ({
      available: await GeminiAgent.isAvailable(),
      activeSessions: Array.from(geminiAgents.keys()),
    }))
  )
}
