import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import log from '../../utils/logger';

// Use vi.hoisted to define mock functions before vi.mock factory (hoisted to top)
const {
  mockExistsSync,
  mockMkdirSync,
  mockReaddir,
  mockStat,
  mockUnlink,
  mockCreateWriteStream,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => true),
  mockMkdirSync: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockUnlink: vi.fn(),
  mockCreateWriteStream: vi.fn(() => ({
    write: vi.fn(() => true),
    on: vi.fn(),
    end: vi.fn(),
  })),
}));

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  createWriteStream: mockCreateWriteStream,
  promises: {
    readdir: mockReaddir,
    stat: mockStat,
    unlink: mockUnlink,
  },
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user'),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('pty-auditor', () => {
  let auditor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockMkdirSync.mockReturnValue(undefined);
    mockReaddir.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);

    const { PTYAuditor } = await import('../pty-auditor');
    auditor = new PTYAuditor('/test/logs', 500, 30);

    // Wait for constructor's fire-and-forget rotateLogs to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Reset rotation cooldown so tests can call rotateLogs freely
    auditor.lastRotation = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create log directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const { PTYAuditor } = await import('../pty-auditor');
      new PTYAuditor('/test/logs2', 500, 30);

      expect(mockMkdirSync).toHaveBeenCalledWith('/test/logs2', { recursive: true });
    });

    it('should handle mkdir errors gracefully', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { PTYAuditor } = await import('../pty-auditor');
      new PTYAuditor('/test/logs3', 500, 30);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create log directory'),
        expect.any(Error)
      );
    });
  });

  describe('log', () => {
    it('should create write stream for new agent/date combination', () => {
      mockCreateWriteStream.mockReturnValue({
        write: vi.fn(() => true),
        on: vi.fn(),
        end: vi.fn(),
      } as any);
      auditor.log('claude', 'IN', 'ls -la\n');
      expect(mockCreateWriteStream).toHaveBeenCalledWith(
        expect.stringContaining('pty-claude-'),
        { flags: 'a' }
      );
    });

    it('should reuse existing write stream', () => {
      const mockStream = { write: vi.fn(() => true), on: vi.fn(), end: vi.fn() };
      mockCreateWriteStream.mockReturnValue(mockStream as any);
      auditor.log('claude', 'IN', 'first');
      auditor.log('claude', 'IN', 'second');
      expect(mockCreateWriteStream).toHaveBeenCalledTimes(1);
    });

    it('should strip ANSI codes from logged data', () => {
      const mockStream = { write: vi.fn(() => true), on: vi.fn(), end: vi.fn() };
      mockCreateWriteStream.mockReturnValue(mockStream as any);
      auditor.log('claude', 'OUT', '\x1b[31mred text\x1b[0m');
      expect(mockStream.write).toHaveBeenCalledWith(expect.stringContaining('red text'));
    });

    it('should log with correct JSON structure', () => {
      const mockStream = { write: vi.fn(() => true), on: vi.fn(), end: vi.fn() };
      mockCreateWriteStream.mockReturnValue(mockStream as any);
      auditor.log('gemini', 'IN', 'pwd');
      expect(mockStream.write).toHaveBeenCalledWith(expect.stringContaining('"agent":"gemini"'));
    });

    it('should handle stream backpressure', () => {
      const mockStream = { write: vi.fn(() => false), on: vi.fn(), end: vi.fn() };
      mockCreateWriteStream.mockReturnValue(mockStream as any);
      auditor.log('claude', 'IN', 'test');
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should handle stream errors', () => {
      const mockStream = {
        write: vi.fn(() => true),
        on: vi.fn((event: string, cb: (e: Error) => void) => {
          if (event === 'error') cb(new Error('Stream error'));
        }),
        end: vi.fn(),
      };
      mockCreateWriteStream.mockReturnValue(mockStream as any);
      auditor.log('claude', 'IN', 'test');
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Error writing to audit log'),
        expect.any(Error)
      );
    });
  });

  describe('rotateLogs', () => {
    it('should delete files older than retention period', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      mockReaddir.mockResolvedValue(['pty-old.log']);
      mockStat.mockImplementation(async () => ({ mtimeMs: oldDate.getTime(), size: 1000 } as any));
      await auditor.rotateLogs();
      expect(mockUnlink).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Deleted old log file'));
    });

    it('should delete oldest files when over size limit', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1);
      mockReaddir.mockResolvedValue(['pty-large.log']);
      mockStat.mockImplementation(async () => ({ mtimeMs: recentDate.getTime(), size: 600 * 1024 * 1024 } as any));
      await auditor.rotateLogs();
      expect(mockUnlink).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Deleted log file to free space'));
    });

    it('should skip when log directory does not exist', async () => {
      // Clear any prior readdir calls from constructor
      mockReaddir.mockClear();
      mockExistsSync.mockReturnValue(false);
      await auditor.rotateLogs();
      expect(mockReaddir).not.toHaveBeenCalled();
    });

    it('should handle stat errors gracefully', async () => {
      mockReaddir.mockResolvedValue(['pty-test.log']);
      mockStat.mockRejectedValue(new Error('ENOENT'));
      await auditor.rotateLogs();
      expect(auditor).toBeDefined();
    });

    it('should handle rotation errors gracefully', async () => {
      mockReaddir.mockRejectedValue(new Error('Permission denied'));
      await auditor.rotateLogs();
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during log rotation'),
        expect.any(Error)
      );
    });

    it('should close streams before deleting files', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      const mockStream = { write: vi.fn(() => true), on: vi.fn(), end: vi.fn() };
      auditor.activeStreams.set('/test/logs/pty-old.log', mockStream);
      mockReaddir.mockResolvedValue(['pty-old.log']);
      mockStat.mockImplementation(async () => ({ mtimeMs: oldDate.getTime(), size: 1000 } as any));
      await auditor.rotateLogs();
      expect(mockStream.end).toHaveBeenCalled();
      expect(auditor.activeStreams.has('/test/logs/pty-old.log')).toBe(false);
    });
  });

  describe('close', () => {
    it('should close all active streams', () => {
      const mockStream1 = { end: vi.fn() };
      const mockStream2 = { end: vi.fn() };
      auditor.activeStreams.set('file1.log', mockStream1);
      auditor.activeStreams.set('file2.log', mockStream2);
      auditor.close();
      expect(mockStream1.end).toHaveBeenCalled();
      expect(mockStream2.end).toHaveBeenCalled();
      expect(auditor.activeStreams.size).toBe(0);
    });
  });
});
