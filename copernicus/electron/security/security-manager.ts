import { PatternDetector } from './pattern-detector';
import { SandboxManager } from './sandbox-manager';
import { GitGuard, ConfirmationProvider } from './git-guard';
import { buildSafeEnv } from './env-sanitizer';
import * as path from 'path';
import { app } from 'electron';
import log from '../utils/logger';

export class SecurityManager {
  public detector: PatternDetector;
  public sandbox: SandboxManager;
  public gitGuard: GitGuard;
  private projectRoot: string;

  constructor(confirmationProvider: ConfirmationProvider) {
    // Correctly resolve project root relative to application path
    this.projectRoot = path.resolve(app.getAppPath(), '../../');
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

    log.info(`[SecurityManager] Prepared secure execution for ${agentId} - sandbox: ${sandboxPrefix.length > 0 ? 'enabled' : 'disabled'}`);

    return {
      env,
      sandboxPrefix
    };
  }

  /**
   * Analyses data for dangerous patterns.
   * Fires alert events and writes to security log via PatternDetector.
   */
  public analyseData(agentId: string, data: string): void {
    log.debug(`[SecurityManager] Analysing ${data.length} bytes from ${agentId}`);
    this.detector.detect(agentId, data);
  }

  /**
   * Checks if a git command is safe to execute.
   */
  public async checkGitCommand(agentId: string, command: string) {
    log.info(`[SecurityManager] Git command check for ${agentId}: ${command.substring(0, 50)}...`);
    const result = await this.gitGuard.check(agentId, command);
    log.info(`[SecurityManager] Git command ${result ? 'ALLOWED' : 'BLOCKED'}`);
    return result;
  }
}

// Global singleton instance will be initialized in main.ts with a concrete provider
export let securityManager: SecurityManager;

export function initializeSecurityManager(provider: ConfirmationProvider) {
  securityManager = new SecurityManager(provider);
  return securityManager;
}
