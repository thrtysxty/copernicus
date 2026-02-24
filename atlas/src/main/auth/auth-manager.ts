import fs from 'fs';
import path from 'path';
import os from 'os';
import { SafeStorageWrapper, EncryptedCredentials } from './safe-storage';
import { GoogleOAuth } from './google-oauth';
import { AnthropicAuth } from './anthropic-auth';
import { CustomProviderAuth } from './custom-provider';

export type AuthMethod =
  | 'gemini_oauth_file'
  | 'gcloud_adc'
  | 'env_api_key'
  | 'credentials_file'
  | 'atlas_oauth_browser'
  | 'manual_api_key'
  | 'bearer_token';

export interface AuthStatus {
  provider: string;
  authenticated: boolean;
  method?: AuthMethod;
  accountEmail?: string;
  expiresAt?: number;
}

export class AuthManager {
  private static CREDENTIALS_ENC_PATH = path.join(os.homedir(), '.atlas', 'credentials.enc');
  private credentialsCache: EncryptedCredentials = {};

  constructor() {
    this.loadEncryptedCredentials();
  }

  private loadEncryptedCredentials() {
    if (fs.existsSync(AuthManager.CREDENTIALS_ENC_PATH)) {
      try {
        const content = fs.readFileSync(AuthManager.CREDENTIALS_ENC_PATH, 'utf-8');
        this.credentialsCache = JSON.parse(content);
      } catch (e) {}
    }
  }

  private saveEncryptedCredentials() {
    const dir = path.dirname(AuthManager.CREDENTIALS_ENC_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AuthManager.CREDENTIALS_ENC_PATH, JSON.stringify(this.credentialsCache, null, 2));
  }

  async getToken(provider: string): Promise<string> {
    if (provider === 'google') {
        const fileToken = await GoogleOAuth.getValidToken();
        if (fileToken) return fileToken;
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
        if (this.credentialsCache['google']) return SafeStorageWrapper.decrypt(this.credentialsCache['google']);
        throw new Error('No Google credentials found.');
    } else if (provider === 'anthropic') {
        const envKey = AnthropicAuth.getEnvKey();
        if (envKey) return envKey;
        const fileKey = AnthropicAuth.getCredentialsFileKey();
        if (fileKey) return fileKey;
        if (this.credentialsCache['anthropic']) return SafeStorageWrapper.decrypt(this.credentialsCache['anthropic']);
        throw new Error('No Anthropic credentials found.');
    } else {
        const envKey = CustomProviderAuth.getEnvKey(`${provider.toUpperCase()}_API_KEY`);
        if (envKey) return envKey;
        if (this.credentialsCache[provider]) return SafeStorageWrapper.decrypt(this.credentialsCache[provider]);
        throw new Error(`No credentials found for ${provider}`);
    }
  }

  async storeApiKey(provider: string, key: string): Promise<void> {
      this.credentialsCache[provider] = SafeStorageWrapper.encrypt(key);
      this.saveEncryptedCredentials();
  }

  async revoke(provider: string): Promise<void> {
      delete this.credentialsCache[provider];
      this.saveEncryptedCredentials();
  }
}
