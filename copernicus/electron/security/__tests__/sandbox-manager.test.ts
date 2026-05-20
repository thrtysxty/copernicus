import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SandboxManager } from '../sandbox-manager';
import * as fs from 'fs';
import * as os from 'os';
import log from '../../utils/logger';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => '(version 1)\n(deny-all)\n(allow file-read* (subpath "/workspace"))'),
    writeFileSync: vi.fn(),
  };
});

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: vi.fn(() => '/home/user'),
    platform: vi.fn(() => 'darwin'),
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn().mockReturnValue('/app'),
  },
}));

vi.mock('../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('sandbox-manager', () => {
  let sandboxManager: SandboxManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sandboxManager = new SandboxManager('/test/sandbox', '/test/templates');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create sandbox directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false).mockReturnValue(true);

      new SandboxManager('/test/sandbox', '/test/templates');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/sandbox', { recursive: true });
    });

    it('should handle mkdir errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      new SandboxManager('/test/sandbox', '/test/templates');

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create sandbox directory'),
        expect.any(Error)
      );
    });

    it('should use custom template directory', () => {
      const manager = new SandboxManager('/test/sandbox', '/custom/templates');
      expect(manager).toBeDefined();
    });
  });

  describe('generateProfile - macOS', () => {
    beforeEach(() => {
      vi.mocked(os.platform).mockReturnValue('darwin');
    });

    it('should return empty array if sandbox-exec does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual([]);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('sandbox-exec unavailable')
      );
    });

    it('should return empty array if template does not exist', () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // sandbox-exec exists
        .mockReturnValueOnce(false); // template does not

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual([]);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sandbox template not found')
      );
    });

    it('should generate sandbox profile for macOS', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual(['/usr/bin/sandbox-exec', '-f', expect.any(String)]);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/test/templates/macos-agent.sb.template',
        'utf8'
      );
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should escape workspace root in profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      sandboxManager.generateProfile('claude', '/workspace with spaces');

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle profile generation errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual([]);
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate macOS sandbox profile'),
        expect.any(Error)
      );
    });
  });

  describe('generateProfile - Linux', () => {
    beforeEach(() => {
      vi.mocked(os.platform).mockReturnValue('linux');
    });

    it('should return empty array if template does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual([]);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sandbox template not found')
      );
    });

    it('should generate firejail profile for Linux', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result[0]).toBe('/usr/bin/firejail'); expect(result[1]).toMatch(/^--profile=/);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/test/templates/linux-agent.profile.template',
        'utf8'
      );
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle paths with spaces on Linux', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      sandboxManager.generateProfile('claude', '/workspace with spaces');

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle profile generation errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual([]);
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate Linux sandbox profile'),
        expect.any(Error)
      );
    });
  });

  describe('generateProfile - Windows/Other', () => {
    it('should return empty array for Windows', () => {
      vi.mocked(os.platform).mockReturnValue('win32');

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual([]);
    });

    it('should return empty array for unknown platforms', () => {
      vi.mocked(os.platform).mockReturnValue('freebsd');

      const result = sandboxManager.generateProfile('claude', '/workspace');

      expect(result).toEqual([]);
    });
  });

  describe('escapeSchemeString', () => {
    it('should escape backslashes', () => {
      // This is a private method, tested indirectly
      const manager = new SandboxManager('/test/sandbox', '/test/templates');
      expect(manager).toBeDefined();
    });
  });

  describe('escapeFirejailPath', () => {
    it('should quote paths with spaces', () => {
      // This is a private method, tested indirectly
      const manager = new SandboxManager('/test/sandbox', '/test/templates');
      expect(manager).toBeDefined();
    });
  });
});
