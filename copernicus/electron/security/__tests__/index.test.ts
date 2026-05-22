import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerSecurityHandlers,
  buildSafeEnv,
  PTYAuditor,
  PatternDetector,
  GitGuard,
  SandboxManager,
  SecurityManager,
} from '../index';
import log from '../../utils/logger';

vi.mock('../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../env-sanitizer', () => ({
  buildSafeEnv: vi.fn().mockReturnValue({ PATH: '/usr/bin' }),
  getStrippedVars: vi.fn().mockReturnValue([]),
  STRIP_PATTERNS: [/^TEST_$/],
  PASSTHROUGH_VARS: ['PATH'],
  VALUE_PATTERNS: { PATH: /.*/ },
}));

vi.mock('../pty-auditor', () => ({
  PTYAuditor: vi.fn().mockImplementation(() => ({
    log: vi.fn(),
    rotateLogs: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../pattern-detector', () => ({
  PatternDetector: vi.fn().mockImplementation(() => ({
    detect: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('../git-guard', () => ({
  GitGuard: vi.fn().mockImplementation(() => ({
    check: vi.fn(),
  })),
}));

vi.mock('../sandbox-manager', () => ({
  SandboxManager: vi.fn().mockImplementation(() => ({
    generateProfile: vi.fn(),
  })),
}));

vi.mock('../security-manager', () => ({
  SecurityManager: vi.fn().mockImplementation(() => ({
    prepareSecureExecution: vi.fn(),
    analyseData: vi.fn(),
    checkGitCommand: vi.fn(),
    detector: {},
    sandbox: {},
    gitGuard: {},
  })),
  initializeSecurityManager: vi.fn(),
}));

describe('security index', () => {
  describe('exports', () => {
    it('should export all security modules', () => {
      expect(buildSafeEnv).toBeDefined();
      expect(PTYAuditor).toBeDefined();
      expect(PatternDetector).toBeDefined();
      expect(GitGuard).toBeDefined();
      expect(SandboxManager).toBeDefined();
      expect(SecurityManager).toBeDefined();
      expect(registerSecurityHandlers).toBeDefined();
    });
  });

  describe('registerSecurityHandlers', () => {
    let mockIpcMain: any;
    let mockStore: any;

    beforeEach(() => {
      vi.clearAllMocks();
      mockStore = {
        get: vi.fn(),
        set: vi.fn(),
      };
      mockIpcMain = {
        handle: vi.fn(),
      };
    });

    it('should log when registering handlers', () => {
      registerSecurityHandlers(mockIpcMain, mockStore);

      expect(log.info).toHaveBeenCalledWith('[Security] Registering security IPC handlers');
    });

    it('should register security:get-env-allowlist handler', () => {
      registerSecurityHandlers(mockIpcMain, mockStore);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'security:get-env-allowlist',
        expect.any(Function)
      );
    });

    it('should register security:add-env-var handler', () => {
      registerSecurityHandlers(mockIpcMain, mockStore);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'security:add-env-var',
        expect.any(Function)
      );
    });

    it('should register security:remove-env-var handler', () => {
      registerSecurityHandlers(mockIpcMain, mockStore);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'security:remove-env-var',
        expect.any(Function)
      );
    });

    it('should register security:get-sandbox-enabled handler', () => {
      registerSecurityHandlers(mockIpcMain, mockStore);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'security:get-sandbox-enabled',
        expect.any(Function)
      );
    });

    it('should register security:set-sandbox-enabled handler', () => {
      registerSecurityHandlers(mockIpcMain, mockStore);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'security:set-sandbox-enabled',
        expect.any(Function)
      );
    });

    describe('handler: security:get-env-allowlist', () => {
      it('should return allowlist from store', async () => {
        mockStore.get.mockReturnValue(['PATH', 'HOME']);

        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:get-env-allowlist'
        )[1];

        const result = await handler(null);

        expect(result).toEqual({ ok: true, data: ['PATH', 'HOME'] });
        expect(mockStore.get).toHaveBeenCalledWith('security.envAllowlist', []);
      });
    });

    describe('handler: security:add-env-var', () => {
      it('should add new variable to allowlist and log', async () => {
        mockStore.get.mockReturnValueOnce(['PATH']).mockReturnValue(['PATH', 'CUSTOM_VAR']);

        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:add-env-var'
        )[1];

        const result = await handler(null, 'CUSTOM_VAR');

        expect(result).toEqual({ ok: true, data: ['PATH', 'CUSTOM_VAR'] });
        expect(mockStore.set).toHaveBeenCalledWith('security.envAllowlist', ['PATH', 'CUSTOM_VAR']);
        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Added CUSTOM_VAR to environment allowlist')
        );
      });

      it('should not add duplicate variable', async () => {
        mockStore.get.mockReturnValue(['PATH', 'EXISTING']);

        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:add-env-var'
        )[1];

        const result = await handler(null, 'EXISTING');

        expect(result).toEqual({ ok: true, data: ['PATH', 'EXISTING'] });
        // Since 'EXISTING' is already in the list, set and log should not be called
        // (log.info is called during registration, so we only check for additional calls)
        expect(mockStore.set).not.toHaveBeenCalled();
        expect(log.info).toHaveBeenCalledTimes(1); // Only the registration log
      });
    });

    describe('handler: security:remove-env-var', () => {
      it('should remove variable from allowlist and log', async () => {
        // store.get is called twice in the handler - first to get list, second in condition check
        mockStore.get.mockReturnValueOnce(['PATH', 'CUSTOM_VAR'])
          .mockReturnValueOnce(['PATH', 'CUSTOM_VAR'])
          .mockReturnValue(['PATH']);

        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:remove-env-var'
        )[1];

        const result = await handler(null, 'CUSTOM_VAR');

        expect(result).toEqual({ ok: true, data: ['PATH'] });
        expect(mockStore.set).toHaveBeenCalledWith('security.envAllowlist', ['PATH']);
        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Removed CUSTOM_VAR from environment allowlist')
        );
      });

      it('should return unchanged list if variable not found', async () => {
        // store.get is called twice in the handler - both need to return same list
        mockStore.get.mockReturnValue(['PATH']);

        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:remove-env-var'
        )[1];

        const result = await handler(null, 'NONEXISTENT');

        expect(result).toEqual({ ok: true, data: ['PATH'] });
        // Since NONEXISTENT is not in list, filtered list equals original, set not called
        expect(mockStore.set).not.toHaveBeenCalled();
        expect(log.info).toHaveBeenCalledTimes(1); // Only the registration log
      });
    });

    describe('handler: security:get-sandbox-enabled', () => {
      it('should return sandbox enabled status for agent', async () => {
        mockStore.get.mockReturnValue(true);

        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:get-sandbox-enabled'
        )[1];

        const result = await handler(null, 'claude');

        expect(result).toEqual({ ok: true, data: true });
        expect(mockStore.get).toHaveBeenCalledWith('security.sandbox.claude', false);
      });

      it('should return false by default', async () => {
        mockStore.get.mockReturnValue(false);

        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:get-sandbox-enabled'
        )[1];

        const result = await handler(null, 'gemini');

        expect(result).toEqual({ ok: true, data: false });
      });
    });

    describe('handler: security:set-sandbox-enabled', () => {
      it('should set sandbox enabled and log when enabling', async () => {
        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:set-sandbox-enabled'
        )[1];

        const result = await handler(null, 'claude', true);

        expect(result).toEqual({ ok: true, data: true });
        expect(mockStore.set).toHaveBeenCalledWith('security.sandbox.claude', true);
        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Sandbox enabled for claude')
        );
      });

      it('should set sandbox disabled and log when disabling', async () => {
        registerSecurityHandlers(mockIpcMain, mockStore);
        const handler = mockIpcMain.handle.mock.calls.find(
          (call: any[]) => call[0] === 'security:set-sandbox-enabled'
        )[1];

        const result = await handler(null, 'claude', false);

        expect(result).toEqual({ ok: true, data: false });
        expect(mockStore.set).toHaveBeenCalledWith('security.sandbox.claude', false);
        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('Sandbox disabled for claude')
        );
      });
    });
  });
});
