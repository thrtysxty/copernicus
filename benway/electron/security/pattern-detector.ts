import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

export interface RiskPattern {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  pattern: RegExp;
  label: string;
  detail: string;
}

export const RISK_PATTERNS: RiskPattern[] = [
  // CRITICAL — likely irreversible or exfiltrating
  {
    id: 'rm-rf-root',
    severity: 'CRITICAL',
    pattern: /rm\s+-rf?\s+(\/[^/\s]*\s*$|~\/\s*$|\$HOME\s*$)/,
    label: 'Destructive rm -rf on root or home',
    detail: 'Agent is attempting to delete a top-level directory.',
  },
  {
    id: 'curl-pipe-shell',
    severity: 'CRITICAL',
    pattern: /curl\s+.+\|\s*(bash|sh|zsh|python|ruby|node)/,
    label: 'curl | shell execution',
    detail: 'Remote code is being downloaded and executed without review.',
  },
  {
    id: 'wget-pipe-shell',
    severity: 'CRITICAL',
    pattern: /wget\s+.+\|\s*(bash|sh|zsh|python|ruby|node)/,
    label: 'wget | shell execution',
    detail: 'Remote code is being downloaded and executed without review.',
  },
  {
    id: 'write-ssh-dir',
    severity: 'CRITICAL',
    pattern: />\s*~\/\.ssh\/|tee\s+~\/\.ssh\//,
    label: 'Write to ~/.ssh/',
    detail: 'Agent is writing to your SSH directory.',
  },
  {
    id: 'eval-subshell',
    severity: 'CRITICAL',
    pattern: /eval\s*\$\(/,
    label: 'eval $() execution',
    detail: 'Dynamic code is being evaluated from a subshell.',
  },
  {
    id: 'git-push-force-main',
    severity: 'CRITICAL',
    pattern: /git\s+push\s+.*--force.*\b(main|master)\b|\bforce-with-lease\b.*\b(main|master)\b/,
    label: 'Force push to main/master',
    detail: 'Agent is force-pushing to a protected branch.',
  },

  // HIGH — potentially harmful, requires attention
  {
    id: 'rm-rf-any',
    severity: 'HIGH',
    pattern: /rm\s+-rf?\s+/,
    label: 'rm -rf executed',
    detail: 'Agent ran a recursive delete. Check the target path.',
  },
  {
    id: 'read-aws-creds',
    severity: 'HIGH',
    pattern: /cat\s+~\/\.aws\/|less\s+~\/\.aws\/|open\s+~\/\.aws\//,
    label: 'Reading AWS credentials',
    detail: 'Agent is reading your AWS credential files.',
  },
  {
    id: 'read-ssh-key',
    severity: 'HIGH',
    pattern: /cat\s+~\/\.ssh\/(id_rsa|id_ed25519|id_ecdsa)/,
    label: 'Reading SSH private key',
    detail: 'Agent is reading your SSH private key.',
  },
  {
    id: 'sudo',
    severity: 'HIGH',
    pattern: /^sudo\s+/m,
    label: 'sudo executed',
    detail: 'Agent is running a command with elevated privileges.',
  },
  {
    id: 'git-push-force',
    severity: 'HIGH',
    pattern: /git\s+push\s+.*--force/,
    label: 'git push --force',
    detail: 'Agent is force-pushing. Verify the target branch is not protected.',
  },
  {
    id: 'add-git-remote',
    severity: 'HIGH',
    pattern: /git\s+remote\s+add\s+/,
    label: 'New git remote added',
    detail: 'Agent is adding a new git remote. Verify the destination.',
  },

  // MEDIUM — noteworthy, probably fine
  {
    id: 'global-install-npm',
    severity: 'MEDIUM',
    pattern: /npm\s+install\s+-g\s+|npm\s+i\s+-g\s+/,
    label: 'Global npm install',
    detail: 'Agent is installing a package globally.',
  },
  {
    id: 'global-install-pip',
    severity: 'MEDIUM',
    pattern: /pip\s+install\s+(?!-r\s)(?!--requirement\s)/,
    label: 'Direct pip install',
    detail: 'Agent is installing a Python package outside a virtual environment check.',
  },
  {
    id: 'brew-install',
    severity: 'MEDIUM',
    pattern: /brew\s+install\s+/,
    label: 'Homebrew install',
    detail: 'Agent is installing a system package.',
  },
  {
    id: 'chmod-777',
    severity: 'MEDIUM',
    pattern: /chmod\s+777\s+/,
    label: 'chmod 777',
    detail: 'Agent is making a file world-writable.',
  },
];

export interface SecurityAlert {
  ts: string;
  agent: string;
  patternId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  context: string;
}

export class PatternDetector extends EventEmitter {
  private logFile: string;

  constructor() {
    super();
    this.logFile = path.join(os.homedir(), '.benway', 'logs', 'security-alerts.jsonl');
    
    // Ensure log directory exists
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create log directory ${dir}:`, err);
      }
    }
  }

  public detect(agentId: string, chunk: string): void {
    for (const pattern of RISK_PATTERNS) {
      if (pattern.pattern.test(chunk)) {
        const alert: SecurityAlert = {
          ts: new Date().toISOString(),
          agent: agentId,
          patternId: pattern.id,
          severity: pattern.severity,
          context: chunk.trim().substring(0, 200), // Limit context size
        };

        this.emit('alert', alert);
        this.logAlert(alert);
        
        // Don't break; multiple patterns might match
      }
    }
  }

  private logAlert(alert: SecurityAlert): void {
    fs.appendFile(this.logFile, JSON.stringify(alert) + '\n', (err) => {
      if (err) console.error('Failed to log security alert:', err);
    });
  }
}
