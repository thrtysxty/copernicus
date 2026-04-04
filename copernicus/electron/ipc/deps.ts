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
  scaffoldRunner?: any;
  layoutStore: any;
  applyAndVerifyPatch: any;
  reversePatch: any;
  runRAGBenchmark: any;
  getPlaywright: any;
  LOG_DIR: string;
  dispatchJulesSession: any;
  createTouchBar: any;
  DEFAULT_TOUCH_BAR_CONFIG: any;
  touchBarCleanup: { remove: () => void } | null;
  isFirstRun: boolean;
  spawn: any;
  getCanvasIframeBounds?: () => any;
}
