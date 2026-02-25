import { ipcMain } from 'electron';
import { AuthManager } from './auth-manager';

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

  private registerHandlers() {
    ipcMain.handle('github:list-repos', async () => {
      try {
        return await this.fetchGithub('/user/repos?sort=updated&per_page=50');
      } catch (error: any) {
        return { error: error.message };
      }
    });

    ipcMain.handle('github:create-repo', async (_, { name, description, isPrivate }: { name: string, description: string, isPrivate: boolean }) => {
      try {
        return await this.fetchGithub('/user/repos', {
          method: 'POST',
          body: JSON.stringify({
            name,
            description,
            private: isPrivate,
            auto_init: true
          }),
        });
      } catch (error: any) {
        return { error: error.message };
      }
    });

    ipcMain.handle('github:user', async () => {
      try {
        return await this.fetchGithub('/user');
      } catch (error: any) {
        return { error: error.message };
      }
    });
  }
}
