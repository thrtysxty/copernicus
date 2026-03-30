import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { SettingsStore } from './settings-store';
import log from './utils/logger';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  }
}));

vi.mock('fs', async () => {
  const actualFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actualFs,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

vi.mock('./utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('SettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setAndVerify should return true when write is successful', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    let mockFileData = '{}';
    vi.mocked(fs.readFileSync).mockImplementation(() => mockFileData);
    vi.mocked(fs.writeFileSync).mockImplementation((_path, data) => {
      mockFileData = data as string;
    });

    const store = new SettingsStore();
    const result = store.setAndVerify('workspace', '/success/path');

    expect(result).toBe(true);
    expect(store.get('workspace')).toBe('/success/path');
  });

  it('setAndVerify should return false and log error when write fails silently', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // Write doesn't update the file content simulating silent failure
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ workspace: '/old/path' }));
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});

    const store = new SettingsStore();
    const result = store.setAndVerify('workspace', '/failed/path');

    expect(result).toBe(false);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('[SettingsStore] setAndVerify failed for key "workspace"'));
  });

  it('get with fromDisk=true should read from file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ workspace: '/disk/path' }));

    const store = new SettingsStore();
    const result = store.get('workspace', undefined, true);

    expect(result).toBe('/disk/path');
  });
});
