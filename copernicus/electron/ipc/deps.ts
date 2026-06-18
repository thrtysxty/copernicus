import { AuthManager } from '../auth-manager'
import { ModelRegistry } from '../models/model-registry'
import { SettingsStore } from '../settings-store'
import { StoriesManager } from '../stories'
import { ptyManager } from '../pty-manager'
import { stateLedger } from '../db/state-ledger'
import { DevtimeManager } from '../devtime-manager'
import { GithubManager } from '../github-manager'
import { FSManager } from '../fs-manager'
import { WorkflowEngine } from '../workflow/engine'
import { CodebaseIndexer } from '../codebase-indexer'
import { HybridRetriever } from '../llm/hybrid-retrieval'
import { LLMService } from '../llm/service'
import { BrowserSession } from '../browser-session'
import { JulesMonitor } from '../jules/monitor'
import { JulesManager } from '../jules/jules-manager'
import { LspManager } from '../lsp/lsp-manager'
import { BackendManager } from '../backend-manager'
import { SocketManager } from '../socket-manager'
import { GenesisRunner } from '../genesis/genesis-runner'
import { SnapshotManager } from '../workflow/snapshot-manager'
import { JulesClient } from '../jules/jules-client'
import { WorktreeManager } from '../worktree/WorktreeManager'
import { applyAndVerifyPatch, reversePatch } from '../utils/patch-manager'
import { runRAGBenchmark } from '../utils/rag-benchmark'
import { createTouchBar } from '../touch-bar'
import { DEFAULT_TOUCH_BAR_CONFIG } from '../touch-bar-types'

export interface TerminalSession {
  id: string
  label: string
  isBusy: boolean
  ephemeral?: boolean
  cwd?: string
}

export interface IpcHandlerDeps {
  worktreeManager: WorktreeManager;
  authManager: AuthManager;
  githubManager: GithubManager;
  modelRegistry: ModelRegistry;
  settingsStore: SettingsStore;
  storiesManager: StoriesManager;
  devtimeManager: DevtimeManager;
  fsManager: FSManager;
  workflowEngine: WorkflowEngine;
  snapshotManager?: SnapshotManager;
  codebaseIndexer: CodebaseIndexer;
  hybridRetriever: HybridRetriever;
  browserSession: BrowserSession;
  ptyManager: typeof ptyManager;
  socketManager: SocketManager;
  stateLedger: typeof stateLedger;
  llmService: LLMService;
  lspManager: LspManager;
  backendManager: BackendManager;
  julesClient: JulesClient;
  julesMonitor: JulesMonitor;
  julesManager: JulesManager;
  genesisRunner: GenesisRunner;
  scaffoldRunner?: GenesisRunner;
  applyAndVerifyPatch: typeof applyAndVerifyPatch;
  reversePatch: typeof reversePatch;
  runRAGBenchmark: typeof runRAGBenchmark;
  LOG_DIR: string;
  dispatchJulesSession: typeof import('../jules/dispatcher').dispatchJulesSession;
  createTouchBar: typeof createTouchBar;
  DEFAULT_TOUCH_BAR_CONFIG: typeof DEFAULT_TOUCH_BAR_CONFIG;
  touchBarCleanup: { remove: () => void } | null;
  isFirstRun: boolean;
  spawn: typeof import('node:child_process').spawn;
  getCanvasIframeBounds?: () => { x: number; y: number; width: number; height: number } | undefined;
  // TODO(arch): layoutStore is a renderer-side Zustand store - should not be accessed from main process.
  // This is a design issue: terminal-agent-handlers.ts (main process) accesses renderer store.
  // Proper fix: move terminal agent logic to renderer or use IPC for terminal management.
  layoutStore?: any;
}