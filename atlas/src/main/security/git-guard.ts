export interface GitPushContext {
  agentId: string;
  command: string;
  remote?: string;
  branch?: string;
}

export class GitGuard {
  /**
   * Scans an incoming command (being sent TO the PTY) for git push.
   * Only returns true if it's an ATLAS-injected command that should be blocked
   * until user confirmation.
   */
  public isGitPush(command: string): boolean {
    const pushPattern = /\bgit\s+push\b/;
    return pushPattern.test(command);
  }

  public parsePushContext(agentId: string, command: string): GitPushContext {
    // Basic extraction of remote and branch
    const parts = command.split(/\s+/);
    let remote = 'origin';
    let branch = 'current';

    const pushIdx = parts.indexOf('push');
    if (pushIdx !== -1 && parts.length > pushIdx + 1) {
      // Check for flags like -u, --force
      let nextIdx = pushIdx + 1;
      while (nextIdx < parts.length && parts[nextIdx].startsWith('-')) {
        nextIdx++;
      }
      
      if (nextIdx < parts.length) {
        remote = parts[nextIdx];
        if (nextIdx + 1 < parts.length) {
          branch = parts[nextIdx + 1];
        }
      }
    }

    return { agentId, command, remote, branch };
  }
}

// Singleton guard
export const gitGuard = new GitGuard();
