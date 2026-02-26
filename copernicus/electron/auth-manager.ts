import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import yaml from 'js-yaml';

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'deepinfra' | string;

export interface AuthConfig {
  provider: ProviderType;
  encryptedKey?: string;
  baseUrl?: string;
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
      console.error('Failed to load auth config:', error);
    }
  }

  private saveConfig() {
    try {
      const config = Array.from(this.authState.values());
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save auth config:', error);
    }
  }

  public async storeApiKey(provider: ProviderType, apiKey: string, baseUrl?: string): Promise<boolean> {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('SafeStorage is not available');
      return false;
    }

    const encryptedKey = safeStorage.encryptString(apiKey).toString('hex');
    const config: AuthConfig = {
      provider,
      encryptedKey,
      baseUrl,
      isActive: true
    };

    this.authState.set(provider, config);
    this.saveConfig();
    return true;
  }

  public getApiKey(provider: ProviderType): string | null {
    // 1. Check Environment
    const envKey = this.getEnvKey(provider);
    if (envKey) return envKey;

    // 2. Check File-based creds (Google/Anthropic defaults)
    const fileKey = this.getFileKey(provider);
    if (fileKey) return fileKey;

    // 3. Check Secure Storage
    const config = this.authState.get(provider);
    if (config && config.encryptedKey) {
      if (safeStorage.isEncryptionAvailable()) {
        try {
          const buffer = Buffer.from(config.encryptedKey, 'hex');
          return safeStorage.decryptString(buffer);
        } catch (error) {
          console.error(`Failed to decrypt key for ${provider}:`, error);
        }
      }
    }

    return null;
  }

  private getEnvKey(provider: ProviderType): string | undefined {
    switch (provider) {
      case 'openai': return process.env.OPENAI_API_KEY;
      case 'anthropic': return process.env.ANTHROPIC_API_KEY;
      case 'google': return process.env.GOOGLE_API_KEY;
      case 'openrouter': return process.env.OPENROUTER_API_KEY;
      case 'deepinfra': return process.env.DEEPINFRA_API_KEY;
      case 'github': return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      default: return undefined;
    }
  }

  private getFileKey(provider: ProviderType): string | null {
    if (provider === 'google') {
      const geminiPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
      if (fs.existsSync(geminiPath)) {
        return fs.readFileSync(geminiPath, 'utf-8');
      }
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        return fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf-8');
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
                // Resolves AC 4: Use js-yaml for reliable parsing
                const content = fs.readFileSync(ghConfigPath, 'utf-8');
                const parsed = yaml.load(content) as any;
                // gh hosts.yml usually has a structure like:
                // github.com:
                //   user: name
                //   oauth_token: token
                const host = Object.keys(parsed)[0];
                return parsed[host]?.oauth_token || null;
            } catch (e) {
                console.error('Failed to parse gh hosts.yml:', e);
            }
        }
    }
    return null;
  }

  public getAuthStatus() {
    const defaultProviders = ['openai', 'anthropic', 'google', 'openrouter', 'deepinfra', 'github'];
    const allProviders = new Set([...defaultProviders, ...this.authState.keys()]);
    
    return Array.from(allProviders).map(p => {
      const envKey = this.getEnvKey(p);
      if (envKey) return { provider: p, hasKey: true, source: 'env' };
      
      const fileKey = this.getFileKey(p);
      if (fileKey) return { provider: p, hasKey: true, source: 'file' };
      
      const config = this.authState.get(p);
      if (config && config.encryptedKey) return { provider: p, hasKey: true, source: 'storage', baseUrl: config.baseUrl };
      
      return { provider: p, hasKey: false, source: 'none', baseUrl: config?.baseUrl };
    });
  }

  // Resolution chain: OPENROUTER -> OPENAI -> DEEPINFRA
  public resolveOpenAICompatibleKey() {
    let key = this.getApiKey('openrouter');
    if (key) return { key, baseUrl: 'https://openrouter.ai/api/v1', provider: 'openrouter', headers: this.getProviderHeaders('openrouter') };

    key = this.getApiKey('openai');
    if (key) return { key, provider: 'openai' };

    key = this.getApiKey('deepinfra');
    if (key) return { key, baseUrl: 'https://api.deepinfra.com/v1/openai', provider: 'deepinfra' };

    // Lowest priority: local Ollama server (R210ii or localhost)
    // OLLAMA_BASE_URL is set via env var — no API key required
    const ollamaUrl = process.env.OLLAMA_BASE_URL
    if (ollamaUrl) {
      return {
        key: 'ollama',           // Ollama ignores key value; any string works
        baseUrl: ollamaUrl.replace(/\/$/, '') + '/v1',
        provider: 'ollama',
        headers: {},
      }
    }

    return null;
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
        const url = process.env.OLLAMA_BASE_URL;
        if (!url) return null;
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
