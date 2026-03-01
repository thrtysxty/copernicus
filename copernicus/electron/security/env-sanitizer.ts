import * as os from 'os';

/**
 * Variables that should NEVER be passed to an agent process.
 * These protect the user's cloud identity and local secrets.
 */
export const STRIP_PATTERNS: RegExp[] = [
  /^SSH_AUTH_SOCK$/,
  /^SSH_AGENT_PID$/,
  /^SSH_TTY$/,
  /^AWS_/,              // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.
  /^AZURE_/,
  /^ARM_/,              // Terraform Azure provider
  /^GOOGLE_APPLICATION_CREDENTIALS$/, // ADC path (Story 085 handles auth separately)
  /^GITHUB_TOKEN$/,
  /^GH_TOKEN$/,
  /^NPM_TOKEN$/,
  /^PYPI_TOKEN$/,
  /^.*_TOKEN$/,         // Any *_TOKEN variable
  /^.*_SECRET$/,        // Any *_SECRET variable
  /^.*_PASSWORD$/,      // Any *_PASSWORD variable
  /^.*_PRIVATE_KEY$/,
  /^DATABASE_URL$/,
  /^POSTGRES_/,
  /^MYSQL_/,
];

/**
 * Variables that are safe and necessary for a functional shell.
 */
export const PASSTHROUGH_VARS = [
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL',
  'TERM', 'COLORTERM', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TMPDIR', 'TMP', 'TEMP',
  'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'DISPLAY', 'WAYLAND_DISPLAY',  // Linux GUI
  'EDITOR', 'VISUAL', 'PAGER',
  'MANPATH', 'INFOPATH',
  'NODE_ENV',                    // dev tools may need this
];

/**
 * Constructs a clean environment for the agent process.
 *
 * @param agentId The ID of the agent (e.g., 'claude', 'gemini')
 * @param allowList List of variable names to explicitly include (from Settings)
 * @returns A sanitized environment object
 */
export function buildSafeEnv(_agentId: string, allowList: string[] = []): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = {};
  const originalEnv = process.env;

  // 1. Start with passthrough variables
  for (const key of PASSTHROUGH_VARS) {
    if (originalEnv[key] !== undefined) {
      safeEnv[key] = originalEnv[key];
    }
  }

  // 2. Add user-opted-in variables (from Settings)
  for (const key of allowList) {
    if (originalEnv[key] !== undefined) {
      safeEnv[key] = originalEnv[key];
    }
  }

  // 3. Explicitly set critical vars if missing to ensure basic shell functionality
  if (!safeEnv.HOME) safeEnv.HOME = os.homedir();
  if (!safeEnv.TERM) safeEnv.TERM = 'xterm-256color';
  // If COLORTERM wasn't passed through (e.g. not in original env), set default
  if (!safeEnv.COLORTERM) safeEnv.COLORTERM = 'truecolor';

  return safeEnv;
}

/**
 * Returns a list of variables that would be stripped from the current environment
 * based on STRIP_PATTERNS. Useful for auditing/logging.
 */
export function getStrippedVars(): string[] {
  const stripped: string[] = [];
  const originalEnv = process.env;

  for (const key in originalEnv) {
    for (const pattern of STRIP_PATTERNS) {
      if (pattern.test(key)) {
        stripped.push(key);
        break;
      }
    }
  }
  return stripped;
}
