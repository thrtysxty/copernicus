import { ipcMain } from 'electron';
import { AuthManager } from './auth-manager';
import { handleIpc } from './utils/handle-ipc';

export class GithubManager {
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
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

  async getPrDiff(repo: string, prNumber: number): Promise<string> {
    const [owner, repoName] = repo.split('/')
    const token = this.authManager.getApiKey('github') || ''
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}`, {
      headers: { Accept: 'application/vnd.github.diff', Authorization: `token ${token}` }
    })
    return res.text()
  }

  async postPrComment(repo: string, prNumber: number, body: string): Promise<void> {
    const [owner, repoName] = repo.split('/')
    const token = this.authManager.getApiKey('github') || ''
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    })
  }

  private registerHandlers() {
    ipcMain.handle('github:list-repos', (_e) =>
      handleIpc(() => this.fetchGithub('/user/repos?sort=updated&per_page=50'))
    );

    ipcMain.handle('github:create-repo', (_e, { name, description, isPrivate }: { name: string, description: string, isPrivate: boolean }) =>
      handleIpc(() => this.fetchGithub('/user/repos', {
        method: 'POST',
        body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
      }))
    );

    ipcMain.handle('github:user', (_e) =>
      handleIpc(() => this.fetchGithub('/user'))
    );
  }
}
