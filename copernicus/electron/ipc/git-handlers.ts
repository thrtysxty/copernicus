import { ipcMain, BrowserWindow } from 'electron'
import { execSync } from 'node:child_process'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const cwd = () => deps.settingsStore.get<string>('workspace', process.cwd())

  ipcMain.handle('git:status', () => handleIpc('git:status', [], () => {
    const out = execSync('git status --short', { cwd: cwd(), encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean).map(line => ({
      status: line.slice(0, 2).trim(),
      file: line.slice(3).trim()
    }))
  }))

  ipcMain.handle('git:stage', (_e, { file }: { file: string }) => handleIpc('git:stage', [file], () => {
    execSync(`git add "${file}"`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:unstage', (_e, { file }: { file: string }) => handleIpc('git:unstage', [file], () => {
    execSync(`git reset HEAD "${file}"`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:commit', (_e, { message }: { message: string }) => handleIpc('git:commit', [message], () => {
    execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:current-branch', () => handleIpc('git:current-branch', [], () => {
    try {
      const out = execSync('git rev-parse --abbrev-ref HEAD', { cwd: cwd(), encoding: 'utf8' })
      return out.trim()
    } catch {
      return 'unknown'
    }
  }))

  ipcMain.handle('git:list-branches', () => handleIpc('git:list-branches', [], () => {
    const out = execSync('git branch', { cwd: cwd(), encoding: 'utf8' })
    return out.trim().split('\n').map(b => ({
      name: b.replace(/^\*?\s+/, ''),
      active: b.startsWith('*')
    }))
  }))

  ipcMain.handle('git:branches', () => handleIpc('git:branches', [], () => {
    const out = execSync('git branch', { cwd: cwd(), encoding: 'utf8' })
    return out.trim().split('\n').map(b => ({
      name: b.replace(/^\*?\s+/, ''),
      active: b.startsWith('*')
    }))
  }))

  ipcMain.handle('git:checkout', (_e, { branch }: { branch: string }) => handleIpc('git:checkout', [branch], () => {
    // Basic validation to prevent shell injection, though execSync child_process needs it when passing directly into shell without an array
    if (/[^a-zA-Z0-9_\-./]/.test(branch)) {
      throw new Error('Invalid branch name')
    }
    execSync(`git checkout ${branch}`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:new-branch', (_e, { name }: { name: string }) => handleIpc('git:new-branch', [name], () => {
    execSync(`git checkout -b ${name}`, { cwd: cwd() })
    return { ok: true }
  }))

  ipcMain.handle('git:diff-file', (_e, { file }: { file: string }) => handleIpc('git:diff-file', [file], () => {
    try {
      return execSync(`git diff HEAD -- "${file}"`, { cwd: cwd(), encoding: 'utf8' })
    } catch { return '' }
  }))

  ipcMain.handle('github:list-prs', () => handleIpc('github:list-prs', [], async () => {
    // Read owner/repo from git remote
    try {
      const remote = execSync('git remote get-url origin', { cwd: cwd(), encoding: 'utf8' }).trim()
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
