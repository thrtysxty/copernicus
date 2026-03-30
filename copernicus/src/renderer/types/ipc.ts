/** Standard structured response from all IPC handlers */
export interface IpcResult<T = undefined> {
  ok: boolean
  data?: T
  error?: string
}

/** Unwrap the {ok, data} envelope returned by handleIpc() */
export function unwrapIpc<T>(result: unknown): T {
  if (!result || typeof result !== 'object') return result as T

  const res = result as IpcResult<T>
  if (res.ok === undefined) return result as T // Not an IpcResult envelope

  if (!res.ok) {
    throw new Error(res.error || 'IPC call failed')
  }
  return res.data as T
}

// Story 613: Workspace Environmental State
export interface WorkspaceState {
  path: string
  branch: string
  isDirty: boolean
  storiesCount: number
  gitRepoFound: boolean
  projectId: string // TODO story-614: replace with memoryService.activeProjectId
  lspStatus?: 'running' | 'stopped' | 'dead'
  worktreePolling?: 'active' | 'stopped'
  drift?: string[] // non-empty if any of the 5 state sources disagree
}

// === Generic types ===
export interface IpcRequestBase {
  channelId: string;
}

export interface IpcResponseBase {
  ok: boolean;
  error?: string;
}

export interface IpcEventBase {
  channelId: string;
  timestamp: number;
}

// === Authentication ===
export interface AuthStatusRequest extends IpcRequestBase {
  channelId: 'auth:status';
}

export interface AuthStatusResponse extends IpcResponseBase {
  statuses: Array<{
    provider: string;
    authenticated: boolean;
    email?: string;
    type?: string;
  }>;
}

export interface AuthStoreApiKeyRequest extends IpcRequestBase {
  channelId: 'auth:store-api-key';
  payload: { provider: string; apiKey: string; baseUrl?: string };
}

export interface AuthStoreApiKeyResponse extends IpcResponseBase {}

export interface AuthGetApiKeyRequest extends IpcRequestBase {
  channelId: 'auth:get-api-key';
  payload: { provider: string };
}

export interface AuthGetApiKeyResponse extends IpcResponseBase {
  key?: string | null;
}

export interface LspStatusResponse extends IpcResponseBase {
  running: boolean;
  version?: string;
}

export interface SettingsLoadResponse extends IpcResponseBase {
  [key: string]: unknown;
}

export interface CheckCliToolsResponse extends IpcResponseBase {
  claude?: boolean;
  git?: boolean;
  node?: boolean;
  [key: string]: any;
}

export interface McpStatusResponse extends IpcResponseBase {
  statuses: Array<{ name: string; status: 'connected' | 'disconnected' | 'error' }>;
}

export interface WorkflowListTemplatesResponse extends IpcResponseBase {
  templates: Array<{ id: string; name: string; description: string }>;
}

// ... (I'll add more as I go, for now I'll just write this to get started)
