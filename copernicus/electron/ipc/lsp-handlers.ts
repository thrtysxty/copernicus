import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { execFile } from 'child_process'
import path from 'path'

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
  ipcMain.handle('lsp:workspace-check', (_e) =>
    handleIpc('lsp:workspace-check', [], async () => {
      const lspManager = deps.lspManager as any;
      const fsManager = deps.fsManager as any;
      const rootPath = fsManager.getRootPath();
      const copDir = path.join(rootPath, 'copernicus');

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

      // 2. Run tsc --noEmit
      const tscErrors = await new Promise<DiagnosticItem[]>((resolve) => {
        execFile('npx', ['tsc', '--noEmit', '--pretty', 'false'], { cwd: copDir, shell: true }, (_err, stdout, stderr) => {
          const diags: DiagnosticItem[] = [];
          const output = stdout + stderr;
          for (const line of output.split('\n')) {
            // Format: "file(line,col): error TSxxxx: msg"
            const m = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/);
            if (m && m[1] && m[2] && m[3] && m[4] && m[5]) {
              diags.push({
                file: path.resolve(copDir, m[1]),
                line: parseInt(m[2]),
                col: parseInt(m[3]),
                severity: m[4] as 'error' | 'warning',
                message: m[5]
              });
            }
          }
          resolve(diags);
        });
      });

      // 3. Merge and deduplicate
      for (const te of tscErrors) {
        const isDup = allErrors.some(ae => 
          ae.file === te.file && 
          ae.line === te.line && 
          ae.message === te.message
        );
        if (!isDup) {
          allErrors.push(te);
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
