import { execFileSync } from 'child_process'
import Database from 'better-sqlite3'

export interface WorkflowSnapshot {
  id: number
  workflow_id: string
  node_id: string
  git_sha: string
  workflow_state: string
  captured_at: string
}

export class SnapshotManager {
  private cachedSha: string | null = null

  constructor(private db: Database.Database, private repoPath: string) {}

  beginRun(): void {
    this.cachedSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: this.repoPath }).toString().trim()
  }

  endRun(): void {
    this.cachedSha = null
  }

  capture(workflowId: string, nodeId: string, workflowState: object): number {
    if (!this.repoPath) throw new Error('SnapshotManager: repoPath not set — no workspace loaded')

    const git_sha = this.cachedSha ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: this.repoPath }).toString().trim()
    if (!/^[0-9a-f]{40}$/.test(git_sha)) {
      throw new Error('Unexpected git SHA format')
    }

    const info = this.db.prepare(
      `INSERT INTO workflow_snapshots (workflow_id, node_id, git_sha, workflow_state) VALUES (?, ?, ?, ?)`
    ).run(workflowId, nodeId, git_sha, JSON.stringify(workflowState))
    return info.lastInsertRowid as number
  }

  getForWorkflow(workflowId: string): WorkflowSnapshot[] {
    return this.db.prepare(
      `SELECT * FROM workflow_snapshots WHERE workflow_id = ? ORDER BY captured_at ASC`
    ).all(workflowId) as WorkflowSnapshot[]
  }

  get(snapshotId: number): WorkflowSnapshot | null {
    return this.db.prepare(`SELECT * FROM workflow_snapshots WHERE id = ?`).get(snapshotId) as WorkflowSnapshot | null
  }

  rewind(snapshotId: number): { git_sha: string; workflow_state: object } {
    if (!this.repoPath) throw new Error('SnapshotManager: repoPath not set — no workspace loaded')

    const snap = this.get(snapshotId)
    if (!snap) throw new Error(`Snapshot ${snapshotId} not found`)

    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: this.repoPath }).toString().trim()
    if (dirty) {
      throw new Error('Cannot rewind: working tree has uncommitted changes. Stash or commit first.')
    }

    if (!/^[0-9a-f]{40}$/.test(snap.git_sha)) {
      throw new Error('Invalid snapshot SHA — refusing checkout')
    }

    execFileSync('git', ['checkout', snap.git_sha], { cwd: this.repoPath })
    return { git_sha: snap.git_sha, workflow_state: JSON.parse(snap.workflow_state) }
  }
}
