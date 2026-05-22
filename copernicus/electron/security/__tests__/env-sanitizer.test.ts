import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSafeEnv, getStrippedVars, STRIP_PATTERNS, PASSTHROUGH_VARS, VALUE_PATTERNS } from '../env-sanitizer';
import log from '../../utils/logger';

vi.mock('../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('env-sanitizer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('STRIP_PATTERNS', () => {
    it('should match SSH variables', () => {
      expect(STRIP_PATTERNS.some(p => p.test('SSH_AUTH_SOCK'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('SSH_AGENT_PID'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('SSH_TTY'))).toBe(true);
    });

    it('should match cloud provider variables', () => {
      expect(STRIP_PATTERNS.some(p => p.test('AWS_ACCESS_KEY_ID'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('AWS_SECRET_ACCESS_KEY'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('AZURE_SUBSCRIPTION_ID'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('GOOGLE_APPLICATION_CREDENTIALS'))).toBe(true);
    });

    it('should match token and secret variables', () => {
      expect(STRIP_PATTERNS.some(p => p.test('GITHUB_TOKEN'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('NPM_TOKEN'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('API_SECRET'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('DB_PASSWORD'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('RSA_PRIVATE_KEY'))).toBe(true);
    });

    it('should match database variables', () => {
      expect(STRIP_PATTERNS.some(p => p.test('DATABASE_URL'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('POSTGRES_PASSWORD'))).toBe(true);
      expect(STRIP_PATTERNS.some(p => p.test('MYSQL_ROOT_PASSWORD'))).toBe(true);
    });
  });

  describe('PASSTHROUGH_VARS', () => {
    it('should include essential shell variables', () => {
      expect(PASSTHROUGH_VARS).toContain('PATH');
      expect(PASSTHROUGH_VARS).toContain('HOME');
      expect(PASSTHROUGH_VARS).toContain('USER');
      expect(PASSTHROUGH_VARS).toContain('SHELL');
      expect(PASSTHROUGH_VARS).toContain('TERM');
    });

    it('should include display variables', () => {
      expect(PASSTHROUGH_VARS).toContain('DISPLAY');
      expect(PASSTHROUGH_VARS).toContain('WAYLAND_DISPLAY');
    });

    it('should include XDG variables', () => {
      expect(PASSTHROUGH_VARS).toContain('XDG_RUNTIME_DIR');
      expect(PASSTHROUGH_VARS).toContain('XDG_CONFIG_HOME');
      expect(PASSTHROUGH_VARS).toContain('XDG_DATA_HOME');
    });
  });

  describe('buildSafeEnv', () => {
    it('should include passthrough variables that exist', () => {
      process.env.PATH = '/usr/bin';
      process.env.HOME = '/home/user';
      process.env.TERM = 'xterm-256color';

      const safeEnv = buildSafeEnv('test-agent');

      expect(safeEnv.PATH).toBe('/usr/bin');
      expect(safeEnv.HOME).toBe('/home/user');
      expect(safeEnv.TERM).toBe('xterm-256color');
    });

    it('should exclude sensitive variables by default', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.GITHUB_TOKEN = 'ghp_xxxxxxxxxxxx';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/db';

      const safeEnv = buildSafeEnv('test-agent');

      expect(safeEnv.AWS_ACCESS_KEY_ID).toBeUndefined();
      expect(safeEnv.GITHUB_TOKEN).toBeUndefined();
      expect(safeEnv.DATABASE_URL).toBeUndefined();
    });

    it('should include user-allowed variables with valid values', () => {
      process.env.CUSTOM_VAR = 'valid_value';
      process.env.NODE_ENV = 'development';

      const safeEnv = buildSafeEnv('test-agent', ['CUSTOM_VAR', 'NODE_ENV']);

      expect(safeEnv.CUSTOM_VAR).toBeUndefined(); // No pattern defined
      expect(safeEnv.NODE_ENV).toBe('development');
    });

    it('should exclude allowed variables with invalid values', () => {
      process.env.NODE_ENV = 'invalid_env';
      process.env.PATH = '/usr/bin;rm -rf /'; // Invalid chars

      const logWarn = vi.mocked(log.warn);
      const safeEnv = buildSafeEnv('test-agent', ['NODE_ENV', 'PATH']);

      expect(safeEnv.NODE_ENV).toBeUndefined();
      expect(safeEnv.PATH).toBeUndefined();
      expect(logWarn).toHaveBeenCalledWith(
        expect.stringContaining('NODE_ENV excluded: invalid value format')
      );
    });

    it('should set default HOME if not present', () => {
      delete process.env.HOME;

      const safeEnv = buildSafeEnv('test-agent');

      expect(safeEnv.HOME).toBeDefined();
    });

    it('should set default TERM if not present', () => {
      delete process.env.TERM;

      const safeEnv = buildSafeEnv('test-agent');

      expect(safeEnv.TERM).toBe('xterm-256color');
    });

    it('should set default COLORTERM if not present', () => {
      delete process.env.COLORTERM;

      const safeEnv = buildSafeEnv('test-agent');

      expect(safeEnv.COLORTERM).toBe('truecolor');
    });

    it('should validate VITE_DEV_SERVER_URL format', () => {
      process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173';
      const safeEnv = buildSafeEnv('test-agent', ['VITE_DEV_SERVER_URL']);
      expect(safeEnv.VITE_DEV_SERVER_URL).toBe('http://localhost:5173');

      process.env.VITE_DEV_SERVER_URL = 'http://evil.com/malicious';
      const safeEnv2 = buildSafeEnv('test-agent', ['VITE_DEV_SERVER_URL']);
      expect(safeEnv2.VITE_DEV_SERVER_URL).toBeUndefined();
    });
  });

  describe('getStrippedVars', () => {
    it('should return list of variables that would be stripped', () => {
      process.env.SAFE_VAR = 'safe';
      process.env.AWS_SECRET_KEY = 'secret';
      process.env.GITHUB_TOKEN = 'token';
      process.env.NORMAL_PATH = '/usr/bin';

      const stripped = getStrippedVars();

      expect(stripped).toContain('AWS_SECRET_KEY');
      expect(stripped).toContain('GITHUB_TOKEN');
      expect(stripped).not.toContain('SAFE_VAR');
      expect(stripped).not.toContain('NORMAL_PATH');
    });

    it('should return only variables matching strip patterns', () => {
      // Set up a controlled test environment
      process.env.SAFE_VAR = 'safe';
      process.env.NORMAL_PATH = '/usr/bin';
      // Clear any existing sensitive vars first
      const sensitiveVars = [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_SESSION_TOKEN',
        'GITHUB_TOKEN',
        'GH_TOKEN',
        'NPM_TOKEN',
        'SSH_AUTH_SOCK',
        'SSH_AGENT_PID',
        'SSH_TTY',
        'DATABASE_URL',
        'AZURE_SUBSCRIPTION_ID',
        'GOOGLE_APPLICATION_CREDENTIALS',
        'PYPI_TOKEN',
        'ARM_SUBSCRIPTION_ID',
        'AZURE_TENANT_ID',
      ];
      for (const v of sensitiveVars) {
        delete process.env[v];
      }

      const stripped = getStrippedVars();

      // Should only contain vars matching STRIP_PATTERNS
      for (const varName of stripped) {
        const matchesPattern = STRIP_PATTERNS.some(p => p.test(varName));
        expect(matchesPattern).toBe(true);
      }
    });
  });

  describe('VALUE_PATTERNS', () => {
    it('should have patterns for all PASSTHROUGH_VARS', () => {
      for (const key of PASSTHROUGH_VARS) {
        expect(VALUE_PATTERNS[key]).toBeDefined();
      }
    });

    it('should validate PATH correctly', () => {
      const pattern = VALUE_PATTERNS.PATH!;
      expect(pattern.test('/usr/bin:/bin')).toBe(true);
      expect(pattern.test('/usr/local/bin')).toBe(true);
      expect(pattern.test('; rm -rf /')).toBe(false);
    });

    it('should validate USER correctly', () => {
      const pattern = VALUE_PATTERNS.USER!;
      expect(pattern.test('john')).toBe(true);
      expect(pattern.test('user_123')).toBe(true);
      expect(pattern.test('Root')).toBe(false); // uppercase
      expect(pattern.test('user;rm')).toBe(false);
    });

    it('should validate NODE_ENV correctly', () => {
      const pattern = VALUE_PATTERNS.NODE_ENV!;
      expect(pattern.test('development')).toBe(true);
      expect(pattern.test('production')).toBe(true);
      expect(pattern.test('test')).toBe(true);
      expect(pattern.test('staging')).toBe(false);
    });
  });
});
