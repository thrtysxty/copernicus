import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalModelManager } from './LocalModelManager';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import { modelRegistry } from '../models/model-registry';
import { authManager } from '../auth-manager';

vi.mock('fs');
vi.mock('os');
vi.mock('child_process');
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));
vi.mock('../models/model-registry', () => ({
  modelRegistry: {
    registerModel: vi.fn()
  }
}));
vi.mock('../auth-manager', () => ({
  authManager: {
    setBaseUrl: vi.fn()
  }
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn().mockReturnValue('/app/path'),
    getPath: vi.fn()
  }
}));

describe('LocalModelManager', () => {
  let manager: LocalModelManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new LocalModelManager();
    // Stub os.homedir
    vi.spyOn(os, 'homedir').mockReturnValue('/mock/home');
  });

  describe('isModelCached', () => {
    it('returns true if cache directory exists and is not empty', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValue(['file1', 'file2'] as any);

      expect(manager.isModelCached()).toBe(true);

      expect(fs.existsSync).toHaveBeenCalledWith('/mock/home/.cache/huggingface/hub/models--mlx-community--gemma-4-8b-it-4bit');
      expect(fs.readdirSync).toHaveBeenCalledWith('/mock/home/.cache/huggingface/hub/models--mlx-community--gemma-4-8b-it-4bit');
    });

    it('returns false if cache directory does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(manager.isModelCached()).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledWith('/mock/home/.cache/huggingface/hub/models--mlx-community--gemma-4-8b-it-4bit');
      expect(fs.readdirSync).not.toHaveBeenCalled();
    });

    it('returns false if cache directory exists but is empty', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValue([] as any);

      expect(manager.isModelCached()).toBe(false);
    });

    it('returns false and handles errors gracefully', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation(() => { throw new Error('Permission denied'); });

      expect(manager.isModelCached()).toBe(false);
    });
  });

  describe('start', () => {
    it('spawns mlx_lm.server with correct arguments', async () => {
      // Mock findEphemeralPort to return a fixed port
      vi.spyOn(manager as any, 'findEphemeralPort').mockResolvedValue(12345);

      const mockChildProcess = {
        on: vi.fn(),
        kill: vi.fn()
      };

      // we need to mock the exported spawn, because vitest might not intercept bare import correctly if not mocked perfectly. Actually `child_process` is already mocked at module level. Let's make sure `spawn` from `child_process` gets the mock value.
      const spawnMock = vi.mocked(child_process.spawn).mockReturnValue(mockChildProcess as any);

      // Mock fetch for health check
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await manager.start();

      expect(spawnMock).toHaveBeenCalledWith(
        'python3',
        [
          '-m', 'mlx_lm.server',
          '--model', 'mlx-community/gemma-4-8b-it-4bit',
          '--port', '12345',
          '--host', '127.0.0.1'
        ],
        expect.objectContaining({
          stdio: 'inherit',
          windowsHide: true
        })
      );

      // Verify registry update
      expect(modelRegistry.registerModel).toHaveBeenCalledWith({
        id: 'gemma4-e4b',
        provider: 'ollama',
        name: 'Gemma 4 e4b (MLX)',
        contextWindow: 131072,
        costPer1kIn: 0,
        costPer1kOut: 0
      });

      // Verify auth manager update
      expect(authManager.setBaseUrl).toHaveBeenCalledWith('ollama', 'http://localhost:12345');
    });
  });
});
