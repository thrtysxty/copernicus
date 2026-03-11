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
import { BrowserSession } from '../browser-session'
import { JulesMonitor } from '../jules/monitor'
import { JulesManager } from '../jules/jules-manager'
import { LspManager } from '../lsp/lsp-manager'
import { BackendManager } from '../backend-manager'
import { SocketManager } from '../socket-manager'
import { GenesisRunner } from '../genesis/genesis-runner'
import { SnapshotManager } from '../workflow/snapshot-manager'

export interface IpcHandlerDeps {
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
  llmService: any; // TODO: Type this
  lspManager: LspManager;
  backendManager: BackendManager;
  julesMonitor: JulesMonitor;
  julesManager: JulesManager;
  genesisRunner: GenesisRunner;
  applyAndVerifyPatch: any;
  reversePatch: any;
  runRAGBenchmark: any;
  getPlaywright: any;
  computeCoveragePct: any;
  LOG_DIR: string;
  dispatchJulesSession: any;
  createTouchBar: any;
  DEFAULT_TOUCH_BAR_CONFIG: any;
  touchBarCleanup: { remove: () => void } | null;
  isFirstRun: boolean;
  spawn: any;
  getCanvasIframeBounds?: () => any;
}
