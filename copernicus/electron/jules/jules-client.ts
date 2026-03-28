import { connect, JulesClient as SdkJulesClient, SessionConfig, SessionClient, Activity, SessionResource as SessionInfo } from '@google/jules-sdk';

const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha';

export class JulesClient {
  private client: SdkJulesClient;

  constructor(apiKey: string) {
    this.client = connect({ apiKey });
  }

  reinit(apiKey: string) {
    this.client = connect({ apiKey });
  }

  session(opts: SessionConfig): Promise<SessionClient>;
  session(sessionId: string): SessionClient;
  session(arg: SessionConfig | string): Promise<SessionClient> | SessionClient {
    if (typeof arg === 'string') {
      return this.client.session(arg);
    }
    return this.client.session(arg);
  }

  select(query: Parameters<SdkJulesClient['select']>[0]) {
    return this.client.select(query);
  }

  streamSession(sessionId: string): AsyncIterableIterator<Activity> {
    return this.client.session(sessionId).stream() as AsyncIterableIterator<Activity>;
  }

  getSessionInfo(sessionId: string): Promise<SessionInfo> {
    return this.client.session(sessionId).info();
  }

  async listSources(apiKey: string): Promise<{ name: string, displayName: string }[]> {
    const res = await fetch(`${JULES_API_BASE}/sources`, {
      headers: { 'X-Goog-Api-Key': apiKey }
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jules API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as { sources?: { name: string, displayName: string }[] };
    return data.sources ?? [];
  }
}
