import * as os from 'os';

/**
 * Variables that should NEVER be passed to an agent process.
 * These protect the user's cloud identity and local secrets.
 */
const STRIP_PATTERNS: RegExp[] = [
  /^SSH_AUTH_SOCK$/,
  /^SSH_AGENT_PID$/,
  /^SSH_TTY$/,
  /^AWS_/,              // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.
  /^AZURE_/,
  /^ARM_/,              // Terraform Azure provider
  /^GOOGLE_APPLICATION_CREDENTIALS$/, // ADC path (AuthManager handles this)
  /^GITHUB_TOKEN$/,
  /^GH_TOKEN$/,
  /^NPM_TOKEN$/,
  /^PYPI_TOKEN$/,
  /^.*_TOKEN$/,         // Generic token catch-all
  /^.*_SECRET$/,        // Generic secret catch-all
  /^.*_PASSWORD$/,      // Generic password catch-all
  /^.*_PRIVATE_KEY$/,
  /^DATABASE_URL$/,
  /^POSTGRES_/,
  /^MYSQL_/,
];

/**
 * Variables that are safe and necessary for a functional shell.
 */
const PASSTHROUGH_VARS = new Set([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL',
  'TERM', 'COLORTERM', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TMPDIR', 'TMP', 'TEMP',
  'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'DISPLAY', 'WAYLAND_DISPLAY',
  'EDITOR', 'VISUAL', 'PAGER',
  'MANPATH', 'INFOPATH',
  'NODE_ENV',
]);

export function buildSafeEnv(agentId: string, allowList: string[] = []): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = {};
  const originalEnv = process.env;

  // 1. Start with passthrough variables
  for (const key of PASSTHROUGH_VARS) {
    if (originalEnv[key]) {
      safeEnv[key] = originalEnv[key];
    }
  }

  // 2. Add user-opted-in variables (from Settings)
  for (const key of allowList) {
    if (originalEnv[key]) {
      safeEnv[key] = originalEnv[key];
    }
  }

  // 3. Explicitly set critical vars if missing
  if (!safeEnv.HOME) safeEnv.HOME = os.homedir();
  if (!safeEnv.TERM) safeEnv.TERM = 'xterm-256color';
  if (!safeEnv.COLORTERM) safeEnv.COLORTERM = 'truecolor';

  return safeEnv;
}