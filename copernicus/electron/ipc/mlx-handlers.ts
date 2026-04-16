import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { mlxProvider } from '../mlx-provider';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function getFolderSize(dirPath: string): number {
  let size = 0;
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      if (file.isDirectory()) {
        size += getFolderSize(path.join(dirPath, file.name));
      } else if (file.isFile()) {
        size += fs.statSync(path.join(dirPath, file.name)).size;
      }
    }
  } catch (e) {
    // Ignore permissions errors or not found
  }
  return size;
}

export function registerMlxHandlers() {
  const isAppleSilicon = process.arch === 'arm64' && process.platform === 'darwin';

  ipcMain.handle('mlx:download-model', (event, modelId: string) =>
    handleIpc(async () => {
      if (!isAppleSilicon) return { available: false };

      return new Promise((resolve, reject) => {
        const proc = spawn('huggingface-cli', ['download', modelId]);

        proc.on('error', (err) => {
          reject(new Error(`Failed to start huggingface-cli: ${err.message}`));
        });

        proc.stdout?.on('data', (data) => {
          const output = data.toString();
          // parse output to send progress if necessary
          event.sender.send('mlx:download-progress', { output });
        });

        proc.stderr?.on('data', (data) => {
          const output = data.toString();
          event.sender.send('mlx:download-progress', { output });
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, modelId });
          } else {
            reject(new Error(`Download failed with code ${code}`));
          }
        });
      });
    })
  );

  ipcMain.handle('mlx:list-installed', () =>
    handleIpc(() => {
      if (!isAppleSilicon) return { available: false };

      const hfCacheDir = path.join(os.homedir(), '.cache', 'huggingface', 'hub');
      let models: { id: string; size: number }[] = [];
      if (fs.existsSync(hfCacheDir)) {
        const entries = fs.readdirSync(hfCacheDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('models--')) {
            const modelId = entry.name.replace('models--', '').replace('--', '/');
            const modelDirPath = path.join(hfCacheDir, entry.name);
            const size = getFolderSize(modelDirPath);
            models.push({ id: modelId, size });
          }
        }
      }
      return { available: true, models };
    })
  );

  ipcMain.handle('mlx:delete-model', (_event, modelId: string) =>
    handleIpc(async () => {
      if (!isAppleSilicon) return { available: false };

      return new Promise((resolve, reject) => {
        // We can use huggingface-cli delete-cache for this, but it requires interactive prompt
        // For simplicity, we just delete the corresponding folder in ~/.cache/huggingface/hub
        const folderName = `models--${modelId.replace('/', '--')}`;
        const targetPath = path.join(os.homedir(), '.cache', 'huggingface', 'hub', folderName);
        if (fs.existsSync(targetPath)) {
          fs.rm(targetPath, { recursive: true, force: true }, (err) => {
            if (err) reject(err);
            else resolve({ success: true });
          });
        } else {
          resolve({ success: false, reason: 'Not found' });
        }
      });
    })
  );

  ipcMain.handle('mlx:get-perf', () =>
    handleIpc(() => {
      if (!isAppleSilicon) return { available: false };
      return { available: true, perf: mlxProvider.getLatestPerf() };
    })
  );

  ipcMain.handle('mlx:get-status', () =>
    handleIpc(() => {
      if (!isAppleSilicon) return { available: false };
      return {
        available: true,
        isRunning: mlxProvider.isRunning(),
        currentModel: mlxProvider.currentModel(),
        isMlxLmInstalled: mlxProvider.getPrerequisiteStatus()
      };
    })
  );

  ipcMain.handle('mlx:switch-model', (event, modelId: string) =>
    handleIpc(() => {
      if (!isAppleSilicon) return { available: false };
      mlxProvider.restart(modelId);
      event.sender.send('mlx:server-status-changed', { status: 'starting', modelId });
      return { success: true };
    })
  );
}
