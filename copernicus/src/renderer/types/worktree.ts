export interface AgentWorktree {
  id: string
  branch: string
  storyId: string | null
  nodeId: string | null
  worktreePath: string
  status: 'active' | 'completed' | 'merged' | 'failed'
  mergeMode: 'gated' | 'yolo'
  commitSha: string | null
  commitCount: number
  createdAt: string
  completedAt: string | null
}
