import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

interface GeminiOAuthCreds {
  access_token: string;
  scope: string;
  token_type: string;
  id_token?: string;
  expiry_date: number;
  refresh_token: string;
  client_id?: string;
  client_secret?: string;
}

interface ADCCreds {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  type: string;
  quota_project_id?: string;
  account?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  refresh_token?: string;
}

export class GoogleOAuth {
  private static GEMINI_CREDS_PATH = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
  private static ADC_PATH = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
  
  private static ATLAS_CLIENT_ID = 'YOUR_ATLAS_CLIENT_ID'; 
  private static ATLAS_REDIRECT_URI = 'atlas://oauth/callback';
  private static AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private static TOKEN_URL = 'https://oauth2.googleapis.com/token';

  static async getValidToken(): Promise<string | null> {
    try {
      if (fs.existsSync(this.GEMINI_CREDS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(this.GEMINI_CREDS_PATH, 'utf-8')) as GeminiOAuthCreds;
        if (creds.access_token && creds.refresh_token) {
          if (creds.expiry_date > Date.now() + 60000) {
            return creds.access_token;
          } else {
            return await this.refreshGeminiToken(creds);
          }
        }
      }
    } catch (error) {}

    try {
      if (fs.existsSync(this.ADC_PATH)) {
        const creds = JSON.parse(fs.readFileSync(this.ADC_PATH, 'utf-8')) as ADCCreds;
        if (creds.refresh_token && creds.client_id && creds.client_secret) {
          return await this.refreshADCToken(creds);
        }
      }
    } catch (error) {}

    return null;
  }

  private static async refreshGeminiToken(creds: GeminiOAuthCreds): Promise<string> {
    const clientId = creds.client_id;
    const clientSecret = creds.client_secret;
    if (!clientId || !clientSecret) throw new Error('Missing client_id or client_secret');

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token'
    });

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) throw new Error('Refresh failed');
    const data = await response.json() as TokenResponse;
    
    const newCreds = {
      ...creds,
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in * 1000),
      refresh_token: data.refresh_token || creds.refresh_token
    };
    fs.writeFileSync(this.GEMINI_CREDS_PATH, JSON.stringify(newCreds, null, 2));
    return data.access_token;
  }

  private static async refreshADCToken(creds: ADCCreds): Promise<string> {
    const params = new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token'
    });

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) throw new Error('ADC Refresh failed');
    const data = await response.json() as TokenResponse;
    return data.access_token;
  }

  static generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  static getAuthUrl(challenge: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.ATLAS_CLIENT_ID,
      redirect_uri: this.ATLAS_REDIRECT_URI,
      response_type: 'code',
      scope: 'email profile https://www.googleapis.com/auth/cloud-platform',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  static async exchangeCodeForToken(code: string, verifier: string): Promise<TokenResponse> {
      const params = new URLSearchParams({
          client_id: this.ATLAS_CLIENT_ID,
          redirect_uri: this.ATLAS_REDIRECT_URI,
          grant_type: 'authorization_code',
          code: code,
          code_verifier: verifier
      });

      const response = await fetch(this.TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
      });

      if (!response.ok) throw new Error('Exchange failed');
      return await response.json() as TokenResponse;
  }
}
