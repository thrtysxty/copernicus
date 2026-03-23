import { ipcMain, BrowserWindow } from 'electron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const execAsync = promisify(exec)
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'
import { memoryService } from '../memory/memoryService'
import { stateLedger } from '../db/state-ledger'

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const cwd = () => deps.settingsStore.get<string>('workspace', process.cwd())

  ipcMain.handle('git:status', () => handleIpc('git:status', [], async () => {
    const { stdout } = await execAsync('git status --short', { cwd: cwd() })
    return stdout.trim().split('\n').filter(Boolean).map(line => ({
      status: line.slice(0, 2).trim(),
      file: line.slice(3).trim()
    }))
  }))

  ipcMain.handle('git:stage', (_e, { file }: { file: string }) => handleIpc('git:stage', [file], async () => {
    await execAsync(`git add "${file}"`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:unstage', (_e, { file }: { file: string }) => handleIpc('git:unstage', [file], async () => {
    await execAsync(`git reset HEAD "${file}"`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:commit', (_e, { message }: { message: string }) => handleIpc('git:commit', [message], async () => {
    await execAsync(`git commit -m ${JSON.stringify(message)}`, { cwd: cwd() })
    
    // Log work using memoryService as a fire-and-forget hook
    const rootPath = cwd();
    const projectId = rootPath ? (stateLedger.getProjectByPath(rootPath)?.id ?? 'default') : 'default';
    
    Promise.all([
      execAsync('git rev-parse HEAD', { cwd: rootPath }),
      execAsync('git diff-tree --no-commit-id --name-only -r HEAD', { cwd: rootPath })
    ]).then(([shaRes, diffRes]) => {
      const commitSha = shaRes.stdout.trim();
      const changedFiles = diffRes.stdout.trim().split('\n').filter(Boolean);
      return memoryService.logWork({
        projectId,
        bankId: 'orchestrator',
        eventType: 'git_commit',
        meta: { sha: commitSha, message, files: changedFiles }
      });
    }).catch(console.warn);

    return { ok: true }
  }))

  ipcMain.handle('git:current-branch', () => handleIpc('git:current-branch', [], async () => {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: cwd() })
      return stdout.trim()
    } catch {
      return 'unknown'
    }
  }))

  ipcMain.handle('git:list-branches', () => handleIpc('git:list-branches', [], async () => {
    const { stdout } = await execAsync('git branch', { cwd: cwd() })
    return stdout.trim().split('\n').map(b => ({
      name: b.replace(/^\*?\s+/, ''),
      active: b.startsWith('*')
    }))
  }))

  ipcMain.handle('git:branches', () => handleIpc('git:branches', [], async () => {
    const { stdout } = await execAsync('git branch', { cwd: cwd() })
    return stdout.trim().split('\n').map(b => ({
      name: b.replace(/^\*?\s+/, ''),
      active: b.startsWith('*')
    }))
  }))

  ipcMain.handle('git:checkout', (_e, { branch }: { branch: string }) => handleIpc('git:checkout', [branch], async () => {
    // Basic validation to prevent shell injection, though execSync child_process needs it when passing directly into shell without an array
    if (/[^a-zA-Z0-9_\-./]/.test(branch)) {
      throw new Error('Invalid branch name')
    }
    await execAsync(`git checkout ${branch}`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:new-branch', (_e, { name }: { name: string }) => handleIpc('git:new-branch', [name], async () => {
    await execAsync(`git checkout -b ${name}`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:diff-file', (_e, { file }: { file: string }) => handleIpc('git:diff-file', [file], async () => {
    try {
      const { stdout } = await execAsync(`git diff HEAD -- "${file}"`, { cwd: cwd() })
      return stdout
    } catch { return '' }
  }))

  ipcMain.handle('github:list-prs', () => handleIpc('github:list-prs', [], async () => {
    // Read owner/repo from git remote
    try {
      const { stdout: remote } = await execAsync('git remote get-url origin', { cwd: cwd() })
      const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
      if (!match) return []
      const repo = match[1]
      const token = deps.authManager.getApiKey('github') ?? ''
      const headers: Record<string,string> = { Accept: 'application/vnd.github+json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=20`, { headers })
      if (!res.ok) return []
      const prs = await res.json() as any[]
      return prs.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login,
        url: pr.html_url,
        ciStatus: pr.head?.sha ? 'unknown' : 'none'
      }))
    } catch { return [] }
  }))
}
