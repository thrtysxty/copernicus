import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'

export function register(_win: BrowserWindow, deps: any) {
  const { modelRegistry, llmService, codebaseIndexer, hybridRetriever, runRAGBenchmark, lspManager } = deps

  // Registry Handlers
  ipcMain.handle('registry:list-models', () => handleIpc('registry:list-models', [], () => modelRegistry.getModels()))
  ipcMain.handle('registry:list-personas', () => handleIpc('registry:list-personas', [], async () => {
    try {
      const response = await fetch('http://localhost:5001/api/registry/personas');
      if (!response.ok) return [];
      return await response.json();
    } catch (e) {
      return [];
    }
  }))

  // Model Handlers
  ipcMain.handle('models:list', () => handleIpc('models:list', [], () => modelRegistry.getModels()));
  ipcMain.handle('models:active', () => handleIpc('models:active', [], () => modelRegistry.getActiveModel()));
  ipcMain.handle('models:set-active', (_, modelId: string) => handleIpc('models:set-active', [modelId], () => modelRegistry.setActiveModel(modelId)));
  ipcMain.handle('models:list-ollama', () => handleIpc('models:list-ollama', [], async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return { ok: false, error: 'OLLAMA_NOT_RUNNING', models: [] };

      const json = await response.json() as { models: Array<{ name: string }> };
      const models = json.models.map(m => ({
        id: m.name,
        name: m.name,
        provider: 'ollama' as const,
        contextWindow: 0,
      }));

      models.forEach(m => modelRegistry.registerModel(m));
      return { ok: true, models };
    } catch {
      return { ok: false, error: 'OLLAMA_NOT_RUNNING', models: [] };
    }
  }));

  // LLM Chat
  ipcMain.handle('chat:send', (_event, payload: any) => handleIpc('chat:send', [payload], async () => {
    llmService.streamChat(payload).catch((err: any) => log.error('[LLM] streamChat error:', err))
    return true
  }))
  ipcMain.handle('chat:confirm-model-switch', (_e, payload) => handleIpc('chat:confirm-model-switch', [payload], async () => {
    // Notify all windows
    BrowserWindow.getAllWindows().forEach(w =>
      w.webContents.send('chat:model-switch-decision', payload))
    
    // Notify Python backend (Story 228 AC-3)
    try {
      await fetch('http://localhost:5001/api/orchestration/resolve-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: payload.request_id || payload.sessionId, // accommodate both naming conventions
          approved: payload.accepted
        })
      })
    } catch (err) {
      log.error('[Main] Failed to notify backend of model switch decision:', err)
    }
  }))

  // Review
  ipcMain.handle('review:log', (_event, { verdicts }: any) => handleIpc('review:log', [{ verdicts }], () => {
    deps.stateLedger.logIntent(`REVIEW: [Claude: ${verdicts.claude}] [Gemini: ${verdicts.gemini}]`, 'COMPLETED', 'sentinel')
    return true
  }))

  // Codebase Indexing
  ipcMain.handle('codebase:index-status', () => handleIpc('codebase:index-status', [], () => codebaseIndexer.getStatus()))
  ipcMain.handle('codebase:search-deep', async (_event, query: string) => handleIpc(() => hybridRetriever.search(query)))
  ipcMain.handle('codebase:search-fast', async (_event, query: string) => handleIpc(() => codebaseIndexer.search(query)))
  ipcMain.handle('codebase:run-benchmark', () => handleIpc('codebase:run-benchmark', [], () => runRAGBenchmark()))

  // LSP (Story 176)
  ipcMain.handle('lsp:status', () => handleIpc('lsp:status', [], () => lspManager.getStatus()))
  ipcMain.handle('lsp:request', (_e, { method, params }: { method: string; params: any }) => handleIpc('lsp:request', [{ method, params }], () => lspManager.sendRequest(method, params)))
  ipcMain.handle('lsp:notify', (_e, { method, params }: { method: string; params: any }) => handleIpc('lsp:notify', [{ method, params }], () => { lspManager.sendNotify(method, params) }))
  // LSP file lifecycle + diagnostics (Story 189)
  ipcMain.handle('lsp:open-file', (_e, { filePath, content }: { filePath: string; content: string }) => handleIpc('lsp:open-file', [{ filePath, content }], () => lspManager.openFile(filePath, content)))
  ipcMain.handle('lsp:close-file', (_e, filePath: string) => handleIpc('lsp:close-file', [filePath], () => lspManager.closeFile(filePath)))
  ipcMain.handle('lsp:get-diagnostics', (_e, filePath: string) => handleIpc('lsp:get-diagnostics', [filePath], () => lspManager.getDiagnostics(filePath)))
  ipcMain.handle('lsp:check-file', (_e, filePath: string) => handleIpc('lsp:check-file', [filePath], () => lspManager.getDiagnostics(filePath)))
}
