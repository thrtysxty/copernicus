export const STRIP_PATTERNS: RegExp[] = [
  /^SSH_AUTH_SOCK$/,
  /^SSH_AGENT_PID$/,
  /^SSH_TTY$/,
  /^AWS_/,
  /^AZURE_/,
  /^ARM_/,
  /^GOOGLE_APPLICATION_CREDENTIALS$/,
  /^GITHUB_TOKEN$/,
  /^GH_TOKEN$/,
  /^NPM_TOKEN$/,
  /^PYPI_TOKEN$/,
  /^.*_TOKEN$/,
  /^.*_SECRET$/,
  /^.*_PASSWORD$/,
  /^.*_PRIVATE_KEY$/,
  /^DATABASE_URL$/,
  /^POSTGRES_/,
  /^MYSQL_/,
];

export const PASSTHROUGH = [
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL',
  'TERM', 'COLORTERM', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TMPDIR', 'TMP', 'TEMP',
  'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'DISPLAY', 'WAYLAND_DISPLAY',
  'EDITOR', 'VISUAL', 'PAGER',
  'MANPATH', 'INFOPATH',
  'NODE_ENV',
];

export function buildSafeEnv(agentId: string, allowlist: string[] = []): Record<string, string> {
  const safeEnv: Record<string, string> = { ...process.env }; // Start with full env
  const stripped: string[] = [];

  for (const key of Object.keys(safeEnv)) {
    // Check allowlist first (user opt-in overrides stripping)
    if (allowlist.includes(key)) continue;

    // Check pass-through list
    if (PASSTHROUGH.includes(key)) continue;

    // Check strip patterns
    let matchesStrip = false;
    for (const pattern of STRIP_PATTERNS) {
      if (pattern.test(key)) {
        matchesStrip = true;
        break;
      }
    }

    if (matchesStrip) {
      delete safeEnv[key];
      stripped.push(key);
    }
  }

  console.log(`[Security] Sanitized env for agent ${agentId}. Stripped: ${stripped.length} vars.`);
  return safeEnv;
}
