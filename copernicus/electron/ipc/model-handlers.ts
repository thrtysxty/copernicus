import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'

import { IpcHandlerDeps } from './deps'

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const { modelRegistry, codebaseIndexer, hybridRetriever, runRAGBenchmark, lspManager, settingsStore } = deps

  // Registry Handlers
  ipcMain.handle('registry:list-models', () => handleIpc('registry:list-models', [], () => modelRegistry.getModels()))
  ipcMain.handle('registry:list-personas', () => handleIpc('registry:list-personas', [], async () => {
    try {
      const response = await fetch('http://localhost:5001/api/registry/personas');
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }))

  // Model Handlers
  ipcMain.handle('models:list', () => handleIpc('models:list', [], () => modelRegistry.getModels()));
  ipcMain.handle('models:active', () => handleIpc('models:active', [], () => modelRegistry.getActiveModel()));
  ipcMain.handle('models:set-active', (_, modelId: string) => handleIpc('models:set-active', [modelId], () => modelRegistry.setActiveModel(modelId)));
  ipcMain.handle('models:set-default', (_e, { role, value }: { role: string, value: string }) =>
    handleIpc('models:set-default', [role, value], () => {
      const defaults = settingsStore.get<Record<string, string>>('modelDefaults', {})
      defaults[role] = value
      settingsStore.set('modelDefaults', defaults)
      return { ok: true }
    })
  )
  ipcMain.handle('models:list-ollama', () => handleIpc('models:list-ollama', [], async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return { ok: false, error: 'OLLAMA_NOT_RUNNING', models: [] };

      const json = await response.json() as { models: Array<{ name: string }> };
      const models: any[] = [];
      json.models.forEach(m => {
        models.push({
          id: m.name,
          name: m.name,
          provider: 'ollama',
          contextWindow: 0,
        });
        models.push({
          id: m.name,
          name: `${m.name} (Anthropic API)`,
          provider: 'ollama-anthropic',
          contextWindow: 0,
        });
      });

      models.forEach(m => modelRegistry.registerModel(m));
      return { ok: true, models };
    } catch {
      return { ok: false, error: 'OLLAMA_NOT_RUNNING', models: [] };
    }
    }));

    // Review
    ipcMain.handle('review:log'
, (_event, { verdicts }: { verdicts: { claude: string; gemini: string } }) => handleIpc('review:log', [{ verdicts }], () => {
    deps.stateLedger.logIntent(`REVIEW: [Claude: ${verdicts.claude}] [Gemini: ${verdicts.gemini}]`, 'COMPLETED', 'sentinel')
    return true
  }))

  // Codebase Indexing
  ipcMain.handle('codebase:index-status', () => handleIpc('codebase:index-status', [], () => codebaseIndexer.getStatus()))
  ipcMain.handle('codebase:search-deep', async (_event, query: string) => handleIpc(() => hybridRetriever.search(query)))
  ipcMain.handle('codebase:search-fast', async (_event, query: string) => handleIpc(() => codebaseIndexer.search(query)))
  ipcMain.handle('codebase:run-benchmark', () => handleIpc('codebase:run-benchmark', [], () => runRAGBenchmark()))

  // LSP (Story 176)
  ipcMain.handle('lsp:status', () => handleIpc('lsp:status', [], () => {
    const state = lspManager.getStatus() as any
    return {
      ...state,
      serverName: state.serverName ?? 'typescript-language-server'
    }
  }))
  ipcMain.handle('lsp:request', (_e, { method, params }: { method: string; params: unknown }) => handleIpc('lsp:request', [{ method, params }], () => lspManager.sendRequest(method, params)))
  ipcMain.handle('lsp:notify', (_e, { method, params }: { method: string; params: unknown }) => handleIpc('lsp:notify', [{ method, params }], () => { lspManager.sendNotify(method, params) }))
  // LSP file lifecycle + diagnostics (Story 189)
  ipcMain.handle('lsp:open-file', (_e, { filePath, content }: { filePath: string; content: string }) => handleIpc('lsp:open-file', [{ filePath, content }], () => lspManager.openFile(filePath, content)))
  ipcMain.handle('lsp:close-file', (_e, filePath: string) => handleIpc('lsp:close-file', [filePath], () => lspManager.closeFile(filePath)))
  ipcMain.handle('lsp:get-diagnostics', (_e, filePath: string) => handleIpc('lsp:get-diagnostics', [filePath], () => lspManager.getDiagnostics(filePath)))
  ipcMain.handle('lsp:check-file', (_e, filePath: string) => handleIpc('lsp:check-file', [filePath], () => lspManager.getDiagnostics(filePath)))

  // Ledger Stats (Story 324)
  ipcMain.handle('ledger:stats-by-role-session', (_e, sessionId: string) =>
    handleIpc('ledger:stats-by-role-session', [sessionId], () => deps.stateLedger.getSessionStatsByRole(sessionId))
  )
  ipcMain.handle('ledger:stats-by-role-alltime', () =>
    handleIpc('ledger:stats-by-role-alltime', [], () => deps.stateLedger.getAllTimeStatsByRole())
  )
}
