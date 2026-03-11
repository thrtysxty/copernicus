import { execSync } from 'child_process'
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
  constructor(private db: Database.Database, private repoPath: string) {}

  capture(workflowId: string, nodeId: string, workflowState: object): number {
    const git_sha = execSync('git rev-parse HEAD', { cwd: this.repoPath }).toString().trim()
    const info = this.db.prepare(
      `INSERT INTO workflow_snapshots (workflow_id, node_id, git_sha, workflow_state) VALUES (?, ?, ?, ?)`
    ).run(workflowId, nodeId, git_sha, JSON.stringify(workflowState))
    return info.lastInsertRowid as number
  }

  getForWorkflow(workflowId: string): WorkflowSnapshot[] {
    return this.db.prepare(
      `SELECT * FROM workflow_snapshots WHERE workflow_id = ? ORDER BY captured_at DESC`
    ).all(workflowId) as WorkflowSnapshot[]
  }

  get(snapshotId: number): WorkflowSnapshot | null {
    return this.db.prepare(`SELECT * FROM workflow_snapshots WHERE id = ?`).get(snapshotId) as WorkflowSnapshot | null
  }

  rewind(snapshotId: number): { git_sha: string; workflow_state: object } {
    const snap = this.get(snapshotId)
    if (!snap) throw new Error(`Snapshot ${snapshotId} not found`)
    execSync(`git checkout ${snap.git_sha}`, { cwd: this.repoPath })
    return { git_sha: snap.git_sha, workflow_state: JSON.parse(snap.workflow_state) }
  }
}
