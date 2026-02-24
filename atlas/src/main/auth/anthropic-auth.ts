import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

interface AnthropicCredentials {
  apiKey?: string;
  api_key?: string;
}

export class AnthropicAuth {
  private static CREDENTIALS_PATH = path.join(os.homedir(), '.anthropic', 'credentials');
  private static AUTH_URL = 'https://anthropic.com/api/oauth/authorize';
  private static TOKEN_URL = 'https://anthropic.com/api/oauth/token';

  static getEnvKey(): string | null {
    return process.env.ANTHROPIC_API_KEY || null;
  }

  static getCredentialsFileKey(): string | null {
    try {
      if (fs.existsSync(this.CREDENTIALS_PATH)) {
        const content = fs.readFileSync(this.CREDENTIALS_PATH, 'utf-8');
        const json = JSON.parse(content) as AnthropicCredentials;
        return json.apiKey || json.api_key || null;
      }
    } catch (e) {}
    return null;
  }

  static generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  static getAuthUrl(challenge: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: state
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  static async exchangeCodeForToken(code: string, verifier: string): Promise<string> {
    const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, code_verifier: verifier, grant_type: 'authorization_code' })
    });
    if (!response.ok) throw new Error('Anthropic exchange failed');
    const data = await response.json() as { access_token: string };
    return data.access_token;
  }
}
