import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'

export interface DiagnosticItem {
  file: string; 
  line: number; 
  col: number; 
  severity: 'error' | 'warning'; 
  message: string;
}

export interface WorkspaceCheckResult {
  clean: boolean; 
  errorCount: number; 
  warningCount: number; 
  errors: DiagnosticItem[];
}

export function register(_win: BrowserWindow, deps: any) {
  ipcMain.handle('lsp:rename', (_e, params: { filePath: string, line: number, character: number, newName: string }) =>
    handleIpc('lsp:rename', [], async () => {
      const lspManager = deps.lspManager as any;

      const response = await lspManager.sendRequest('textDocument/rename', {
        textDocument: { uri: `file://${params.filePath}` },
        position: { line: params.line, character: params.character },
        newName: params.newName
      })

      if (!response) {
        return { filesChanged: [], errorCount: 0 }
      }

      const { filesChanged } = await lspManager.applyWorkspaceEdit(response)
      return { filesChanged, errorCount: 0 }
    })
  )

  ipcMain.handle('lsp:workspace-check', (_e) =>
    handleIpc('lsp:workspace-check', [], async () => {
      const lspManager = deps.lspManager as any;

      const allErrors: DiagnosticItem[] = [];
      let lspWarningCount = 0;

      // 1. Gather from LSP diagnosticsCache
      if (lspManager?.diagnosticsCache) {
        for (const [uri, diagnostics] of lspManager.diagnosticsCache.entries()) {
          const filePath = uri.replace('file://', '');
          for (const d of diagnostics) {
            if (d.severity === 1) {
              allErrors.push({
                file: filePath,
                line: (d.range?.start?.line ?? 0) + 1,
                col: (d.range?.start?.character ?? 0) + 1,
                severity: 'error',
                message: d.message
              });
            } else if (d.severity === 2) {
              lspWarningCount++;
            }
          }
        }
      }

      const totalErrorCount = allErrors.filter(e => e.severity === 'error').length;
      const totalWarningCount = allErrors.filter(e => e.severity === 'warning').length + lspWarningCount;

      const result: WorkspaceCheckResult = {
        clean: totalErrorCount === 0,
        errorCount: totalErrorCount,
        warningCount: totalWarningCount,
        errors: allErrors
      };

      return result;
    })
  );
}
