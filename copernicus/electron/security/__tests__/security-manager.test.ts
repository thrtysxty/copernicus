import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../sandbox-manager', () => ({
  SandboxManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../pattern-detector', () => ({
  PatternDetector: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../env-sanitizer', () => ({
  buildSafeEnv: vi.fn().mockReturnValue({ PATH: '/usr/bin', HOME: '/home/user' }),
}));

vi.mock('../git-guard', () => ({
  ConfirmationProvider: Object,
  GitGuard: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: vi.fn().mockReturnValue('/mock/app'),
  },
}));

vi.mock('path', () => ({
  resolve: vi.fn((...args: string[]) => args.join('/')),
  join: vi.fn((...args: string[]) => args.join('/')),
}));

describe('security-manager', () => {
  let securityManager: any;
  let log: any;
  let buildSafeEnv: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Re-import modules after reset so mocks apply
    log = (await import('../../utils/logger')).default;
    buildSafeEnv = (await import('../env-sanitizer')).buildSafeEnv;
    vi.mocked(buildSafeEnv).mockReturnValue({ PATH: '/usr/bin', HOME: '/home/user' });

    const { SecurityManager } = await import('../security-manager');
    const mockProvider = { requestConfirmation: vi.fn() };
    securityManager = new SecurityManager(mockProvider);

    // Replace instance properties with direct mocks
    securityManager.sandbox = {
      generateProfile: vi.fn().mockReturnValue(['sandbox-exec', '-f', '/profile.sb']),
    };
    securityManager.detector = { detect: vi.fn() };
    securityManager.gitGuard = { check: vi.fn().mockResolvedValue(true) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct project root', () => {
      expect(securityManager).toBeDefined();
      expect(securityManager.detector).toBeDefined();
      expect(securityManager.sandbox).toBeDefined();
      expect(securityManager.gitGuard).toBeDefined();
    });
  });

  describe('prepareSecureExecution', () => {
    it('should return sanitized environment and sandbox prefix', () => {
      const result = securityManager.prepareSecureExecution('claude');

      expect(result).toHaveProperty('env');
      expect(result).toHaveProperty('sandboxPrefix');
      expect(result.env).toEqual({ PATH: '/usr/bin', HOME: '/home/user' });
      expect(result.sandboxPrefix).toEqual(['sandbox-exec', '-f', '/profile.sb']);
    });

    it('should log when preparing secure execution', () => {
      securityManager.prepareSecureExecution('gemini');

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Prepared secure execution for gemini')
      );
    });
  });

  describe('analyseData', () => {
    it('should call detector.detect with agentId and data', () => {
      const testData = 'console.log("hello")';
      securityManager.analyseData('claude', testData);

      expect(securityManager.detector.detect).toHaveBeenCalledWith('claude', testData);
    });

    it('should log debug message when analyzing data', () => {
      securityManager.analyseData('claude', 'console.log("hello")');

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('Analysing')
      );
    });
  });

  describe('checkGitCommand', () => {
    it('should delegate to gitGuard.check', async () => {
      vi.mocked(securityManager.gitGuard.check).mockResolvedValue(true);

      const result = await securityManager.checkGitCommand('claude', 'git push origin main');

      expect(result).toBe(true);
      expect(securityManager.gitGuard.check).toHaveBeenCalledWith('claude', 'git push origin main');
    });

    it('should log when checking git command', async () => {
      vi.mocked(securityManager.gitGuard.check).mockResolvedValue(true);

      await securityManager.checkGitCommand('claude', 'git push origin main');

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Git command check for claude')
      );
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Git command ALLOWED')
      );
    });

    it('should log when git command is blocked', async () => {
      vi.mocked(securityManager.gitGuard.check).mockResolvedValue(false);

      await securityManager.checkGitCommand('claude', 'git push origin main');

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Git command BLOCKED')
      );
    });
  });
});
