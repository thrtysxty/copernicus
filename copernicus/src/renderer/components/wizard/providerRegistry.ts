import { Brain, Bot, Globe, HardDrive, ArrowLeftRight, Cpu, Github, Plug } from 'lucide-react';
import React from 'react';

export const CANONICAL_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'github',
  'openrouter',
  'deepinfra',
  'ollama',
  'ollama-cloud',
  'jules',
  'stitch',
  'tavily',
  'context7'
];

export const PROVIDER_ICONS: Record<string, React.FC<any>> = {
  anthropic:   Brain,
  openai:      Bot,
  google:      Globe,
  github:      Github,
  ollama:      HardDrive,
  'ollama-cloud': HardDrive,
  openrouter:  ArrowLeftRight,
  deepinfra:   Cpu,
  jules:       Globe, // Assuming Globe for Google Jules based on existing UI
  stitch:      Plug,
  tavily:      Plug,
  context7:    Plug,
};

export const getProviderIcon = (id: string): React.FC<any> => {
  return PROVIDER_ICONS[id] ?? Plug;
};

export interface ProviderMetadata {
  id: string;
  displayName: string;
  description: string;
}

export const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  anthropic: { id: 'anthropic', displayName: 'Anthropic', description: 'Provider: Anthropic' },
  openai: { id: 'openai', displayName: 'OpenAI', description: 'OpenAI' },
  google: { id: 'google', displayName: 'Google / Gemini', description: 'Google / Gemini' },
  github: { id: 'github', displayName: 'Repository Access (GitHub)', description: 'Repository Access (GitHub)' },
  openrouter: { id: 'openrouter', displayName: 'OpenRouter', description: 'OpenRouter' },
  deepinfra: { id: 'deepinfra', displayName: 'DeepInfra', description: 'DeepInfra' },
  ollama: { id: 'ollama', displayName: 'Local Inference (Ollama)', description: 'Local Inference (Ollama)' },
  'ollama-cloud': { id: 'ollama-cloud', displayName: 'High-Intelligence Tier (Ollama Cloud)', description: 'High-Intelligence Tier (Ollama Cloud)' },
  jules: { id: 'jules', displayName: 'Google Jules', description: 'Google Jules' },
  stitch: { id: 'stitch', displayName: 'Google Stitch', description: 'Google Stitch' },
  tavily: { id: 'tavily', displayName: 'Tavily', description: 'Tavily' },
  context7: { id: 'context7', displayName: 'Context7', description: 'Context7' },
};

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
