import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitGuard, ConfirmationProvider } from '../git-guard';
import { execSync } from 'node:child_process';
import log from '../../utils/logger';

vi.mock('node:child_process', () => {
  return {
    execSync: vi.fn(),
    default: { execSync: vi.fn() },
  };
});

vi.mock('../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('git-guard', () => {
  let mockProvider: ConfirmationProvider;
  let gitGuard: GitGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      requestConfirmation: vi.fn(),
    };
    gitGuard = new GitGuard(mockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('check', () => {
    it('should hard block force push commands', async () => {
      const result = await gitGuard.check('claude', 'git push origin main --force');
      expect(result).toBe(false);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Hard block'));
    });

    it('should hard block force with lease', async () => {
      const result = await gitGuard.check('claude', 'git push origin main --force-with-lease');
      expect(result).toBe(false);
    });

    it('should hard block short force flag', async () => {
      const result = await gitGuard.check('claude', 'git push origin main -f');
      expect(result).toBe(false);
    });

    it('should hard block adding remotes', async () => {
      const result = await gitGuard.check('claude', 'git remote add evil https://evil.com/repo');
      expect(result).toBe(false);
    });

    it('should hard block config user changes', async () => {
      const result = await gitGuard.check('claude', 'git config user.name "Evil User"');
      expect(result).toBe(false);
    });

    it('should allow non-push git commands', async () => {
      const result = await gitGuard.check('claude', 'git status');
      expect(result).toBe(true);
    });

    it('should allow git pull', async () => {
      const result = await gitGuard.check('claude', 'git pull origin main');
      expect(result).toBe(true);
    });

    it('should allow git fetch', async () => {
      const result = await gitGuard.check('claude', 'git fetch origin');
      expect(result).toBe(true);
    });

    it('should request confirmation for git push and allow once', async () => {
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_ONCE');
      vi.mocked(execSync).mockReturnValue('Audit passed');

      const result = await gitGuard.check('claude', 'git push origin main');
      expect(result).toBe(true);
      expect(mockProvider.requestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'claude',
          command: 'git push origin main',
          remote: 'origin',
          branch: 'main',
        })
      );
    });

    it('should request confirmation for git push and allow session', async () => {
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_SESSION');
      vi.mocked(execSync).mockReturnValue('Audit passed');

      const result1 = await gitGuard.check('claude', 'git push origin main');
      expect(result1).toBe(true);

      // Same command should be allowed without confirmation
      const result2 = await gitGuard.check('claude', 'git push origin main');
      expect(result2).toBe(true);
      expect(mockProvider.requestConfirmation).toHaveBeenCalledTimes(1);
    });

    it('should block when user chooses BLOCK', async () => {
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('BLOCK');
      vi.mocked(execSync).mockReturnValue('Audit passed');

      const result = await gitGuard.check('claude', 'git push origin main');
      expect(result).toBe(false);
    });

    it('should handle audit script failure', async () => {
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_ONCE');
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('Audit failed') as any;
        error.stdout = Buffer.from('Audit REJECTED: Credential leak');
        throw error;
      });

      const result = await gitGuard.check('claude', 'git push origin main');
      expect(result).toBe(true); // Still allows if user confirms
      expect(mockProvider.requestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          auditResult: expect.stringContaining('REJECTED'),
        })
      );
    });

    it('should parse remote and branch from push command', async () => {
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_ONCE');
      vi.mocked(execSync).mockReturnValue('Audit passed');

      await gitGuard.check('claude', 'git push upstream feature-branch');

      expect(mockProvider.requestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          remote: 'upstream',
          branch: 'feature-branch',
        })
      );
    });

    it('should handle push with only remote', async () => {
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_ONCE');
      vi.mocked(execSync).mockReturnValue('Audit passed');

      await gitGuard.check('claude', 'git push origin');

      expect(mockProvider.requestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          remote: 'origin',
          branch: undefined,
        })
      );
    });

    it('should clear session allowlist on new instance', async () => {
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_SESSION');
      vi.mocked(execSync).mockReturnValue('Audit passed');

      await gitGuard.check('claude', 'git push origin main');

      // New instance should not have the session allowlist
      const newGitGuard = new GitGuard(mockProvider);
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_ONCE');

      await newGitGuard.check('claude', 'git push origin main');
      expect(mockProvider.requestConfirmation).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseGitPush', () => {
    it('should extract remote and branch', async () => {
      // This is tested indirectly through check()
      // The private method is tested via the public interface
      vi.mocked(mockProvider.requestConfirmation).mockResolvedValue('ALLOW_ONCE');
      vi.mocked(execSync).mockReturnValue('Audit passed');

      await gitGuard.check('claude', 'git push --set-upstream origin develop');

      expect(mockProvider.requestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          remote: 'origin',
          branch: 'develop',
        })
      );
    });
  });
});
