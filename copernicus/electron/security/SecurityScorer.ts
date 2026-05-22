import { lspManager } from '../lsp/lsp-manager';
import { PatternDetector } from './pattern-detector';
import { spawn } from 'child_process';
import log from 'electron-log';

export interface SecurityScore {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  lspErrors: number;
  sentinelHits: number;
  npmAuditIssues: number;
}

export class SecurityScorer {
  private detector: PatternDetector;
  private projectRoot: string;
  private cachedSentinelHits = 0;
  private cachedNpmAuditIssues = 0;
  private lastAuditTime = 0;
  private auditInProgress = false;

  constructor(detector: PatternDetector, projectRoot: string) {
    this.detector = detector;
    this.projectRoot = projectRoot;

    // Listen to alerts to keep track of Sentinel hits
    this.detector.on('alert', () => {
      this.cachedSentinelHits++;
    });
  }

  /**
   * Run npm audit --json and parse critical/high vulnerabilities
   */
  private async runNpmAudit(): Promise<number> {
    const now = Date.now();
    // Throttle audit to once per 5 minutes to avoid excessive spawning
    if (now - this.lastAuditTime < 5 * 60 * 1000) {
      return this.cachedNpmAuditIssues;
    }
    if (this.auditInProgress) {
      return this.cachedNpmAuditIssues;
    }

    this.auditInProgress = true;
    return new Promise((resolve) => {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const proc = spawn(npmCmd, ['audit', '--json'], {
        cwd: this.projectRoot,
        shell: false,
      });

      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });

      proc.on('close', () => {
        this.auditInProgress = false;
        try {
          const auditResult = JSON.parse(stdout);
          const metadata = auditResult.metadata || {};
          const vulnerabilities = metadata.vulnerabilities || {};

          let criticalAndHigh = 0;
          if (vulnerabilities.critical !== undefined) {
            criticalAndHigh += vulnerabilities.critical;
          }
          if (vulnerabilities.high !== undefined) {
            criticalAndHigh += vulnerabilities.high;
          }

          this.cachedNpmAuditIssues = criticalAndHigh;
          this.lastAuditTime = Date.now();
          resolve(criticalAndHigh);
        } catch (err) {
          // If JSON parse fails or it crashes, assume 0 for now to avoid breaking the score
          log.warn('[SecurityScorer] Failed to parse npm audit output', err);
          resolve(this.cachedNpmAuditIssues);
        }
      });

      proc.on('error', (err) => {
        this.auditInProgress = false;
        log.warn('[SecurityScorer] Failed to run npm audit', err);
        resolve(this.cachedNpmAuditIssues);
      });
    });
  }

  /**
   * Count LSP errors from lspManager
   */
  private getLspErrorCount(): number {
    let count = 0;
    // LSP diagnostics severity 1 = Error
    for (const diagnostics of (lspManager as any).diagnosticsCache.values()) {
      for (const diag of diagnostics) {
        if (diag.severity === 1) { // 1 is Error in LSP spec
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Compute letter grade (A-F) based on weights
   * Weighted from: LSP error count (30%), Sentinel pattern hits (40%), npm audit critical/high count (30%)
   */
  private calculateGrade(lspErrors: number, sentinelHits: number, npmAuditIssues: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    // Determine individual scores (0 to 100, 100 being perfect)
    const lspScore = Math.max(0, 100 - (lspErrors * 5)); // e.g. 20 errors = 0
    const sentinelScore = Math.max(0, 100 - (sentinelHits * 20)); // e.g. 5 hits = 0
    const npmScore = Math.max(0, 100 - (npmAuditIssues * 10)); // e.g. 10 issues = 0

    // Apply weights
    const totalScore = (lspScore * 0.30) + (sentinelScore * 0.40) + (npmScore * 0.30);

    log.info(`[SecurityScorer] Score breakdown - LSP: ${lspScore}, Sentinel: ${sentinelScore}, npm: ${npmScore}, Total: ${totalScore.toFixed(1)}`);

    if (totalScore >= 90) {
      log.info('[SecurityScorer] Grade: A (Excellent)');
      return 'A';
    }
    if (totalScore >= 80) {
      log.info('[SecurityScorer] Grade: B (Good)');
      return 'B';
    }
    if (totalScore >= 70) {
      log.info('[SecurityScorer] Grade: C (Fair)');
      return 'C';
    }
    if (totalScore >= 60) {
      log.info('[SecurityScorer] Grade: D (Poor)');
      return 'D';
    }
    log.warn('[SecurityScorer] Grade: F (Failing)');
    return 'F';
  }

  public async computeScore(): Promise<SecurityScore> {
    const lspErrors = this.getLspErrorCount();
    const npmAuditIssues = await this.runNpmAudit();
    const sentinelHits = this.cachedSentinelHits;

    log.info(`[SecurityScorer] Computing score - LSP errors: ${lspErrors}, Sentinel hits: ${sentinelHits}, npm audit issues: ${npmAuditIssues}`);

    const grade = this.calculateGrade(lspErrors, sentinelHits, npmAuditIssues);

    return {
      grade,
      lspErrors,
      sentinelHits,
      npmAuditIssues,
    };
  }
}
