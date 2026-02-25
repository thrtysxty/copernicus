import { PatternDetector } from './pattern-detector';
import { SandboxManager } from './sandbox-manager';
import { GitGuard, ConfirmationProvider } from './git-guard';
import { buildSafeEnv } from './env-sanitizer';
import * as path from 'path';

export class SecurityManager {
  public detector: PatternDetector;
  public sandbox: SandboxManager;
  public gitGuard: GitGuard;
  private projectRoot: string;

  constructor(confirmationProvider: ConfirmationProvider) {
    this.projectRoot = path.resolve(__dirname, '../../../');
    this.detector = new PatternDetector();
    this.sandbox = new SandboxManager();
    this.gitGuard = new GitGuard(confirmationProvider);
  }

  /**
   * Prepares a secure environment and command prefix for an agent.
   */
  public prepareSecureExecution(agentId: string) {
    const env = buildSafeEnv(agentId);
    const sandboxPrefix = this.sandbox.generateProfile(agentId, this.projectRoot);
    
    return {
      env,
      sandboxPrefix
    };
  }

  /**
   * Analyses data for dangerous patterns.
   */
  public analyseData(data: string) {
    return this.detector.analyse(data);
  }

  /**
   * Checks if a git command is safe to execute.
   */
  public async checkGitCommand(agentId: string, command: string) {
    return await this.gitGuard.check(agentId, command);
  }
}

// Global singleton instance will be initialized in main.ts with a concrete provider
export let securityManager: SecurityManager;

export function initializeSecurityManager(provider: ConfirmationProvider) {
  securityManager = new SecurityManager(provider);
  return securityManager;
}
