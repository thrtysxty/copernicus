import log from '../utils/logger'
import { spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { BrowserWindow } from 'electron'
import { AgentWorktree } from '../../src/renderer/types/worktree'

export class WorktreeManager {
  private db: Database.Database
  private repoRoot: string
  private worktreesDir: string
  private pollingInterval: NodeJS.Timeout | null = null
  private mainWindow: BrowserWindow | null = null
  private isStopped: boolean = false

  constructor(db: Database.Database, repoRoot: string) {
    this.db = db
    this.repoRoot = repoRoot
    this.worktreesDir = repoRoot ? path.join(this.repoRoot, '.agent-worktrees') : ''
    if (this.worktreesDir) {
      fs.mkdirSync(this.worktreesDir, { recursive: true })
    }
  }

  create(
    branch: string,
    storyId: string | null,
    nodeId: string | null,
    mergeMode: 'gated' | 'yolo',
  ): AgentWorktree {
    const worktreePath = path.join(this.worktreesDir, branch)
    this.execGit(['worktree', 'add', '-b', branch, worktreePath])


    const stmt = this.db.prepare(`
      INSERT INTO agent_worktrees (id, branch, story_id, node_id, worktree_path, status, merge_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const id = `wt-${Date.now()}`
    stmt.run(
      id,
      branch,
      storyId,
      nodeId,
      worktreePath,
      'active',
      mergeMode,
      new Date().toISOString(),
    )

    return this.getById(id)!
  }

  list(): AgentWorktree[] {
    const stmt = this.db.prepare('SELECT * FROM agent_worktrees')
    return stmt.all().map(this.mapRowToAgentWorktree)
  }

  getById(id: string): AgentWorktree | undefined {
    const stmt = this.db.prepare('SELECT * FROM agent_worktrees WHERE id = ?')
    const row = stmt.get(id)
    return row ? this.mapRowToAgentWorktree(row) : undefined
  }

  getDiff(id: string): { files: string[]; diff: string } {
    const worktree = this.getById(id)
    if (!worktree) throw new Error(`Worktree with id ${id} not found`)

    const diff = this.execGit(['diff', `main...${worktree.branch}`])
    const files = this.execGit(['diff', `main...${worktree.branch}`, '--name-only'])
      .split('\n').filter(Boolean)
    return { files, diff }
  }

  merge(id: string): AgentWorktree {
    const worktree = this.getById(id)
    if (!worktree) throw new Error(`Worktree with id ${id} not found`)

    // Ensure we are on main branch for merge
    this.execGit(['checkout', 'main'])
    this.execGit(['merge', '--squash', worktree.branch])
    this.execGit(['commit', '-m', `feat(agent): squash merge ${worktree.branch}`])
    this._cleanup(worktree.branch, worktree.worktreePath)

    const stmt = this.db.prepare(
      'UPDATE agent_worktrees SET status = ?, completed_at = ? WHERE id = ?',
    )
    stmt.run('merged', new Date().toISOString(), id)

    const updatedWorktree = this.getById(id)!
    this.mainWindow?.webContents.send('worktree:merged', updatedWorktree)
    return updatedWorktree
  }

  remove(id: string) {
    const worktree = this.getById(id)
    if (!worktree) throw new Error(`Worktree with id ${id} not found`)

    this._cleanup(worktree.branch, worktree.worktreePath)

    const stmt = this.db.prepare('DELETE FROM agent_worktrees WHERE id = ?')
    stmt.run(id)
  }

  _cleanup(branch: string, worktreePath: string) {
    try {
      this.execGit(['worktree', 'remove', '--force', worktreePath])
    } catch (error: any) {
      log.error(`Error removing worktree ${worktreePath}:`, error.message)
    }
    try {
      this.execGit(['branch', '-D', branch])
    } catch (error: any) {
      log.error(`Error deleting branch ${branch}:`, error.message)
    }
  }

  poll() {
    if (this.isStopped) return
    const currentRepoRoot = this.repoRoot
    const activeWorktrees = this.list().filter((wt) => wt.status === 'active')

    for (const wt of activeWorktrees) {
      if (this.isStopped || this.repoRoot !== currentRepoRoot) return
      try {
        const logOutput = this.execGit(
          ['log', `main..${wt.branch}`, '--oneline'],
          wt.worktreePath,
        )
        const commitCount = logOutput.split('\n').filter(Boolean).length

        if (commitCount > 0) {
          const latestCommitSha = this.execGit(
            ['rev-parse', wt.branch],
            wt.worktreePath,
          ).trim()

          const stmt = this.db.prepare(`
            UPDATE agent_worktrees
            SET status = ?, commit_sha = ?, commit_count = ?, completed_at = ?
            WHERE id = ?
          `)
          stmt.run(
            'completed',
            latestCommitSha,
            commitCount,
            new Date().toISOString(),
            wt.id,
          )

          const completedWorktree = this.getById(wt.id)!
          this.mainWindow?.webContents.send('worktree:completed', completedWorktree)

          if (wt.mergeMode === 'yolo') {
            this.merge(wt.id)
          }
        }
      } catch (error: any) {
        log.error(`Error polling worktree ${wt.branch}:`, error.message)
        const stmt = this.db.prepare(
          'UPDATE agent_worktrees SET status = ?, completed_at = ? WHERE id = ?',
        )
        stmt.run('failed', new Date().toISOString(), wt.id)
        this.mainWindow?.webContents.send('worktree:completed', this.getById(wt.id)!) // Send failed status
      }
    }
  }

  startPolling(win: BrowserWindow, intervalMs = 30000) {
    this.mainWindow = win
    this.isStopped = false
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }
    this.pollingInterval = setInterval(() => this.poll(), intervalMs)
    this.poll() // Run once immediately
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  stop() {
    this.stopPolling()
    this.isStopped = true
  }

  setRepoRoot(newPath: string) {
    this.repoRoot = newPath
    this.worktreesDir = newPath ? path.join(newPath, '.agent-worktrees') : ''
    if (this.worktreesDir) {
      fs.mkdirSync(this.worktreesDir, { recursive: true })
    }
    this.isStopped = false
    if (this.mainWindow) {
      this.startPolling(this.mainWindow)
    }
  }

  get isPollingStopped(): boolean {
    return this.isStopped
  }

  private execGit(args: string[], cwd?: string): string {
    const root = cwd || this.repoRoot
    log.info(`Executing: git -C ${root} ${args.join(' ')}`)
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
    if (result.status !== 0) {
      const msg = result.stderr?.trim() || result.error?.message || 'unknown error'
      log.error(`Git command failed: git -C ${root} ${args.join(' ')}`)
      throw new Error(`Git command failed: ${args.join(' ')}. Error: ${msg}`)
    }
    return (result.stdout || '').trim()
  }

  private mapRowToAgentWorktree(row: any): AgentWorktree {
    return {
      id: row.id,
      branch: row.branch,
      storyId: row.story_id,
      nodeId: row.node_id,
      worktreePath: row.worktree_path,
      status: row.status,
      mergeMode: row.merge_mode,
      commitSha: row.commit_sha,
      commitCount: row.commit_count,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }
  }
}
