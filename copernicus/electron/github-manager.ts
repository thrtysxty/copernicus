import { ipcMain } from 'electron';
import { AuthManager } from './auth-manager';

type HandleIpc = <T>(fn: () => T | Promise<T>) => Promise<{ ok: true; data: T } | { ok: false; error: string }>

export class GithubManager {
  private authManager: AuthManager;
  private handleIpc: HandleIpc;

  constructor(authManager: AuthManager, handleIpc: HandleIpc) {
    this.authManager = authManager;
    this.handleIpc = handleIpc;
    this.registerHandlers();
  }

  private async fetchGithub(endpoint: string, options: RequestInit = {}) {
    const token = this.authManager.getApiKey('github');
    if (!token) {
      throw new Error('GitHub token not found. Please configure it in Auth Settings.');
    }

    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  private registerHandlers() {
    ipcMain.handle('github:list-repos', () =>
      this.handleIpc(() => this.fetchGithub('/user/repos?sort=updated&per_page=50'))
    );

    ipcMain.handle('github:create-repo', (_: any, { name, description, isPrivate }: { name: string, description: string, isPrivate: boolean }) =>
      this.handleIpc(() => this.fetchGithub('/user/repos', {
        method: 'POST',
        body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
      }))
    );

    ipcMain.handle('github:user', () =>
      this.handleIpc(() => this.fetchGithub('/user'))
    );
  }
}
