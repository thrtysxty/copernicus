import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import yaml from 'js-yaml';
import log from './utils/logger';

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'deepinfra' | 'ollama' | 'ollama-cloud' | string;
export type AuthType = 'oauth' | 'apikey' | 'session' | 'file' | 'env' | 'cli';

export interface AuthConfig {
  provider: ProviderType;
  encryptedKey?: string;
  baseUrl?: string;
  type: AuthType;
  metadata?: {
    email?: string;
    label?: string;
  };
  isActive: boolean;
}

export class AuthManager {
  private configPath: string;
  private authState: Map<ProviderType, AuthConfig> = new Map();

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'auth-config.json');
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data);
        if (Array.isArray(config)) {
          config.forEach(c => {
            this.authState.set(c.provider, c);
          });
        }
      }
    } catch (error) {
      log.error('Failed to load auth config:', error);
    }
  }

  private saveConfig() {
    try {
      const config = Array.from(this.authState.values());
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      log.error('Failed to save auth config:', error);
    }
  }

  public async storeApiKey(
    provider: ProviderType,
    apiKey: string,
    baseUrl?: string,
    type: AuthType = 'apikey',
    metadata?: AuthConfig['metadata']
  ): Promise<boolean> {
    if (!safeStorage.isEncryptionAvailable()) {
      log.error('SafeStorage is not available');
      return false;
    }

    const encryptedKey = safeStorage.encryptString(apiKey).toString('hex');
    const config: AuthConfig = {
      provider,
      encryptedKey,
      baseUrl,
      type,
      metadata,
      isActive: true
    };

    this.authState.set(provider, config);
    this.saveConfig();
    return true;
  }

  public findClaudeCli(): string | null {
    const { execFileSync } = require('child_process')
    const candidates = ['/usr/local/bin/claude', '/opt/homebrew/bin/claude', '/usr/bin/claude']
    for (const p of candidates) {
      try { execFileSync(p, ['--version'], { timeout: 3000, stdio: 'ignore' }); return p } catch { /* skip */ }
    }
    try {
      const result = execFileSync('which', ['claude'], { timeout: 3000 }).toString().trim()
      if (result) return result
    } catch { /* not in PATH */ }
    return null
  }

  public getAnthropicMethod(): 'cli' | 'apikey' | null {
    const config = this.authState.get('anthropic')
    if (!config) return null
    if (config.type === 'cli') return 'cli'
    if (config.encryptedKey) return 'apikey'
    return null
  }

  public async revokeApiKey(provider: ProviderType): Promise<boolean> {
    const deleted = this.authState.delete(provider);
    if (deleted) {
      this.saveConfig();
      // Special cleanup for file-based providers
      if (provider === 'google' || provider === 'jules') {
        const geminiPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
        if (fs.existsSync(geminiPath)) fs.unlinkSync(geminiPath);
      }
    }
    return deleted;
  }

  public revokeKey(provider: string): void {
    const deleted = this.authState.delete(provider);
    if (deleted) {
      this.saveConfig();
      if (provider === 'google' || provider === 'jules') {
        const geminiPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
        if (fs.existsSync(geminiPath)) fs.unlinkSync(geminiPath);
      }
    }
  }

  public getApiKey(provider: ProviderType): string | null {
    // 1. Check Secure Storage (Highest priority as it's user-explicit)
    const config = this.authState.get(provider);
    if (config && config.encryptedKey) {
      if (safeStorage.isEncryptionAvailable()) {
        try {
          const buffer = Buffer.from(config.encryptedKey, 'hex');
          return safeStorage.decryptString(buffer);
        } catch (error) {
          log.error(`Failed to decrypt key for ${provider}:`, error);
        }
      }
    }

    // 2. Check Environment
    const envKey = this.getEnvKey(provider);
    if (envKey) return envKey;

    // 3. Check File-based creds (Google/Anthropic defaults)
    const fileKey = this.getFileKey(provider);
    if (fileKey) return fileKey;

    return null;
  }

  public getBaseUrl(provider: ProviderType): string | undefined {
    const stored = this.authState.get(provider)?.baseUrl;
    if (stored) return stored;

    // Fallbacks
    if (provider === 'ollama-cloud') return process.env.OLLAMA_CLOUD_HOST || process.env.OLLAMA_CLOUD_URL || 'https://ollama.com';
    // Local takes priority if set; cloud URL is the fallback for users without a local instance
    if (provider === 'ollama') return process.env.OLLAMA_LOCAL_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_CLOUD_URL || 'http://localhost:11434';
    if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
    if (provider === 'openai') return 'https://api.openai.com/v1';
    if (provider === 'deepinfra') return 'https://api.deepinfra.com/v1/openai';

    return undefined;
  }

  public setBaseUrl(provider: ProviderType, baseUrl: string): void {
    const config = this.authState.get(provider);
    if (config) {
      config.baseUrl = baseUrl;
      this.authState.set(provider, config);
      this.saveConfig();
    } else {
      // Create a dummy config if none exists, though usually we expect one
      this.authState.set(provider, {
        provider,
        baseUrl,
        type: 'apikey',
        isActive: true
      });
      this.saveConfig();
    }
  }

  private getEnvKey(provider: ProviderType): string | undefined {
    switch (provider) {
      case 'openai': return process.env.OPENAI_API_KEY;
      case 'anthropic': return process.env.ANTHROPIC_API_KEY;
      case 'google': return process.env.GOOGLE_API_KEY;
      case 'openrouter': return process.env.OPENROUTER_API_KEY;
      case 'deepinfra': return process.env.DEEPINFRA_API_KEY;
      case 'github': return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      case 'ollama': return process.env.OLLAMA_API_KEY || process.env.OLLAMA_CLOUD_TOKEN;
      case 'ollama-cloud': return process.env.OLLAMA_CLOUD_TOKEN || process.env.OLLAMA_API_KEY;
      default: return undefined;
    }
  }

  private getFileKey(provider: ProviderType): string | null {
    if (provider === 'google' || provider === 'jules') {
      const geminiPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
      if (fs.existsSync(geminiPath)) {
        try {
          const content = fs.readFileSync(geminiPath, 'utf-8');
          const parsed = JSON.parse(content);
          return parsed.access_token || parsed.token || content;
        } catch {
          return fs.readFileSync(geminiPath, 'utf-8');
        }
      }
    }
    if (provider === 'anthropic') {
      const anthropicPath = path.join(os.homedir(), '.anthropic', 'credentials');
      if (fs.existsSync(anthropicPath)) {
        return fs.readFileSync(anthropicPath, 'utf-8');
      }
    }
    if (provider === 'github') {
        const ghConfigPath = path.join(os.homedir(), '.config', 'gh', 'hosts.yml');
        if (fs.existsSync(ghConfigPath)) {
            try {
                const content = fs.readFileSync(ghConfigPath, 'utf-8');
                const parsed = yaml.load(content) as any;
                const hosts = Object.keys(parsed);
                const host = hosts[0];
                if (!host) return null;
                return parsed[host]?.oauth_token || null;
            } catch (e) {
                log.error('Failed to parse gh hosts.yml:', e);
            }
        }
    }
    return null;
  }

  public async getAuthStatus() {
    const defaultProviders = ['openai', 'anthropic', 'google', 'jules', 'openrouter', 'deepinfra', 'github', 'ollama', 'ollama-cloud'];
    const allProviders = new Set([...defaultProviders, ...this.authState.keys()]);

    const statuses = await Promise.all(Array.from(allProviders).map(async p => {
      if (p === 'ollama') {
        try {
          const res = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(2000),
          });
          return { provider: p, hasKey: true, source: 'none', type: 'env' as const, isActive: res.ok };
        } catch {
          return { provider: p, hasKey: false, source: 'none', type: 'none' as const, isActive: false };
        }
      }

      const config = this.authState.get(p);
      if (config) {
        return {
          provider: p,
          hasKey: true,
          source: 'storage',
          type: config.type,
          metadata: config.metadata,
          baseUrl: config.baseUrl,
          isActive: true
        };
      }

      const envKey = this.getEnvKey(p);
      if (envKey) return { provider: p, hasKey: true, source: 'env', type: 'env' as const, isActive: true };

      const fileKey = this.getFileKey(p);
      if (fileKey) return { provider: p, hasKey: true, source: 'file', type: 'file' as const, isActive: true };

      return { provider: p, hasKey: false, source: 'none', type: 'none' as const, isActive: false };
    }));

    return statuses;
  }

  // Resolution chain: OPENROUTER -> OPENAI -> DEEPINFRA
  public resolveOpenAICompatibleKey() {
    const res = this.getApiKey('openrouter');
    if (res) return { key: res, baseUrl: 'https://openrouter.ai/api/v1', provider: 'openrouter', headers: this.getProviderHeaders('openrouter') };

    const res2 = this.getApiKey('openai');
    if (res2) return { key: res2, provider: 'openai' };

    const res3 = this.getApiKey('deepinfra');
    if (res3) return { key: res3, baseUrl: 'https://api.deepinfra.com/v1/openai', provider: 'deepinfra' };

    const ollamaUrl = process.env.OLLAMA_LOCAL_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_CLOUD_URL || 'http://localhost:11434'
    return {
      key: 'ollama',
      baseUrl: ollamaUrl.replace(/\/$/, '') + '/v1',
      provider: 'ollama',
      headers: {},
    }
  }

  public resolveForProvider(provider: 'deepinfra' | 'openai' | 'openrouter' | 'ollama') {
    switch (provider) {
      case 'openrouter': {
        const key = this.getApiKey('openrouter');
        if (!key) return null;
        return { key, baseUrl: 'https://openrouter.ai/api/v1', provider: 'openrouter', headers: this.getProviderHeaders('openrouter') };
      }
      case 'openai': {
        const key = this.getApiKey('openai');
        if (!key) return null;
        return { key, baseUrl: 'https://api.openai.com/v1', provider: 'openai', headers: {} };
      }
      case 'deepinfra': {
        const key = this.getApiKey('deepinfra');
        if (!key) return null;
        return { key, baseUrl: 'https://api.deepinfra.com/v1/openai', provider: 'deepinfra', headers: {} };
      }
      case 'ollama': {
        const url = process.env.OLLAMA_LOCAL_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_CLOUD_URL || 'http://localhost:11434';
        return { key: 'ollama', baseUrl: url.replace(/\/$/, '') + '/v1', provider: 'ollama', headers: {} };
      }
      default:
        return null;
    }
  }

  private getProviderHeaders(provider: string) {
    const headers: Record<string, string> = {};
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://copernicus.ide';
      headers['X-Title'] = 'COPERNICUS IDE';
    }
    return headers;
  }
}

export const authManager = new AuthManager();
