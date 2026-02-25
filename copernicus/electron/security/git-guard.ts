import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Decision returned by the Git Push Guard modal.
 */
export type GitGuardDecision = 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'BLOCK';

/**
 * Interface for the confirmation provider (e.g., UI service).
 */
export interface ConfirmationProvider {
  requestConfirmation(request: GitPushRequest): Promise<GitGuardDecision>;
}

export interface GitPushRequest {
  agentId: string;
  command: string;
  remote?: string;
  branch?: string;
  auditResult?: string;
}

export class GitGuard {
  private sessionAllowList: Set<string> = new Set();
  private confirmationProvider: ConfirmationProvider;
  private projectRoot: string;

  constructor(provider: ConfirmationProvider) {
    this.confirmationProvider = provider;
    this.projectRoot = path.resolve(__dirname, '../../../');
  }

  /**
   * Checks if an injected git command should be allowed.
   * Only called for COPERNICUS-injected commands (e.g., via /delegate).
   * 
   * @returns true if allowed, false if blocked.
   */
  public async check(agentId: string, command: string): Promise<boolean> {
    // Basic check: is it a git push?
    if (!/\bgit\s+push\b/.test(command)) {
      return true;
    }

    // Check if allowed for session
    // We key by the full command string for simplicity and safety
    if (this.sessionAllowList.has(command)) {
      return true;
    }

    // --- Automated Security Audit ---
    let auditResult = 'Audit PASSED';
    try {
      const auditScript = path.join(this.projectRoot, 'scripts/utils/security_audit.py');
      const output = execSync(`python3 "${auditScript}"`, { cwd: this.projectRoot }).toString();
      auditResult = output;
    } catch (e: any) {
      auditResult = e.stdout ? e.stdout.toString() : 'Audit REJECTED: Credential leak detected.';
    }

    // Parse remote and branch for display
    const { remote, branch } = this.parseGitPush(command);

    // Request confirmation
    const decision = await this.confirmationProvider.requestConfirmation({
      agentId,
      command,
      remote,
      branch,
      auditResult
    });

    if (decision === 'ALLOW_SESSION') {
      this.sessionAllowList.add(command);
      return true;
    } else if (decision === 'ALLOW_ONCE') {
      return true;
    } else {
      return false; // BLOCK
    }
  }

  /**
   * Naive parser for git push command to extract remote and branch.
   * git push [options] [<repository> [<refspec>...]]
   */
  private parseGitPush(command: string): { remote?: string; branch?: string } {
    const parts = command.trim().split(/\s+/);
    let remote: string | undefined;
    let branch: string | undefined;

    // Filter out 'git', 'push', and flags (starting with -)
    // This is heuristic and won't catch all git syntaxes but works for common cases
    const args = parts.filter(p => p !== 'git' && p !== 'push' && !p.startsWith('-'));

    if (args.length >= 2) {
      remote = args[0];
      branch = args[1];
    } else if (args.length === 1) {
      remote = args[0];
    }

    return { remote, branch };
  }
}
