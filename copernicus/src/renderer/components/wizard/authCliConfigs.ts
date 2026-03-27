export interface AuthCliConfig {
  providerId: string;
  detectCmd: string;
  detectSuccessPattern: RegExp;
  installCmd: string;
  authCmd: string;
  authSuccessPattern: RegExp;
  breadcrumbs: {
    detecting: string;
    installing: string;
    authenticating: string;
    done: string;
  };
}

// Simple platform check for frontend safely
const getPlatform = () => {
  if (typeof navigator !== 'undefined') {
    if (navigator.userAgent.includes('Win')) return 'win32';
    if (navigator.userAgent.includes('Mac')) return 'darwin';
  }
  return 'linux';
};

export const AUTH_CLI_CONFIGS: Record<string, AuthCliConfig> = {
  anthropic: {
    providerId: 'anthropic',
    detectCmd: 'claude --version',
    detectSuccessPattern: /.*/,
    installCmd: 'npm install -g @anthropic-ai/claude-code',
    authCmd: 'claude login',
    authSuccessPattern: /Successfully authenticated/i,
    breadcrumbs: {
      detecting: 'Checking for claude CLI…',
      installing: 'Installing @anthropic-ai/claude-code…',
      authenticating: 'Logging in to Anthropic…',
      done: 'Anthropic CLI Authentication Complete'
    }
  },
  google: {
    providerId: 'google',
    detectCmd: 'gemini --version',
    detectSuccessPattern: /.*/,
    installCmd: 'npm install -g @google/gemini-cli',
    authCmd: 'gemini auth login',
    authSuccessPattern: /Successfully authenticated/i,
    breadcrumbs: {
      detecting: 'Checking for gemini CLI…',
      installing: 'Installing @google/gemini-cli…',
      authenticating: 'Logging in to Google Gemini…',
      done: 'Google CLI Authentication Complete'
    }
  },
  github: {
    providerId: 'github',
    detectCmd: 'gh --version',
    detectSuccessPattern: /.*/,
    installCmd: getPlatform() === 'darwin' ? 'brew install gh' : getPlatform() === 'win32' ? 'winget install --id GitHub.cli' : 'sudo apt-get install gh',
    authCmd: 'gh auth login',
    authSuccessPattern: /Logged in as/i,
    breadcrumbs: {
      detecting: 'Checking for gh CLI…',
      installing: 'Installing GitHub CLI…',
      authenticating: 'Logging in to GitHub…',
      done: 'GitHub CLI Authentication Complete'
    }
  }
};