import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

export class CCRAdapter {
  constructor(db, hub, eventBus) {
    this.db = db;
    this.hub = hub;
    this.eventBus = eventBus;
    this._availableCache = { timestamp: 0, status: false };
  }

  async _checkCcrAvailable() {
    const now = Date.now();
    if (now - this._availableCache.timestamp < 30000) {
      return this._availableCache.status;
    }

    return new Promise((resolve) => {
      const req = http.get('http://localhost:9669/health', (res) => {
        this._availableCache = { timestamp: now, status: res.statusCode === 200 };
        resolve(this._availableCache.status);
      });
      req.on('error', () => {
        this._availableCache = { timestamp: now, status: false };
        resolve(false);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        this._availableCache = { timestamp: now, status: false };
        resolve(false);
      });
    });
  }

  name() {
    return 'ccr';
  }

  supportedCapabilities() {
    return ['shell', 'fs_write', 'git:commit', 'git:push:branch'];
  }

  async dispatch(token, storyPath) {
    const available = await this._checkCcrAvailable();
    if (!available) {
      throw new Error('AdapterUnavailable: CCR is not reachable on port 9669');
    }

    const taskId = token.scope?.task?.[0];
    if (!taskId) {
      throw new Error('No task id found in token scope');
    }

    const worktreePath = path.join(REPO_ROOT, `.agent-worktrees/story-${taskId}`);

    try {
      await execFileAsync('git', ['worktree', 'add', worktreePath, '-b', `story-${taskId}`], { cwd: REPO_ROOT });
    } catch (e) {
      if (!e.message.includes('already exists')) {
        throw new Error(`Failed to create worktree: ${e.message}`);
      }
    }

    let storyContent = '';
    try {
      storyContent = fs.readFileSync(path.join(REPO_ROOT, storyPath), 'utf8');
    } catch (e) {
      throw new Error(`Failed to read story: ${e.message}`);
    }

    const directive = this.hub.getContractDirective ? this.hub.getContractDirective(token.role?.name || 'coder') : '';
    let promptText = directive ? `${directive}\n\n${storyContent}` : storyContent;

    let modelArgs = [];
    if (token.identity?.model) {
      const model = token.identity.model;
      if (model !== 'default') {
        if (model.startsWith('think/')) {
          promptText = `/model think\n${promptText}`;
        } else {
          modelArgs = ['--model', model];
        }
      }
    }

    const promptPath = `/tmp/cc_${token.token_id}.md`;
    fs.writeFileSync(promptPath, promptText);

    const logPath = `/tmp/cc_${token.token_id}.log`;
    const exitCodePath = `/tmp/cc_${token.token_id}.exit`;

    // Only pass necessary environment variables, not full process.env
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      HUB_TOKEN_ID: token.token_id,
      CCR_WORKTREE: worktreePath
    };

    const out = fs.openSync(logPath, 'a');
    const err = fs.openSync(logPath, 'a');

    // Reconstruct the argument string safely. The prompt is already in a file,
    // so we can use `cat "${promptPath}"` safely enclosed in quotes.
    const argsStr = ['code', '--dangerously-skip-permissions', ...modelArgs, '-p', `"$(cat \\"${promptPath}\\")"`].join(' ');

    // Spawn detached to let it run, and capture exit code
    const bashCmd = `cd "${worktreePath}" && ccr ${argsStr}; echo $? > "${exitCodePath}"`;
    const child = spawn('bash', ['-c', bashCmd], {
      cwd: worktreePath,
      env,
      detached: true,
      stdio: ['ignore', out, err]
    });

    child.unref();

    const pid = child.pid;
    const now = new Date().toISOString() + 'Z';

    this.db.prepare(`
      INSERT INTO ccr_sessions (session_id, token_id, pid, worktree, log_path, state, started_at)
      VALUES (?, ?, ?, ?, ?, 'RUNNING', ?)
    `).run(token.token_id, token.token_id, pid, worktreePath, logPath, now);

    if (this.eventBus) {
      this.eventBus.emit('dispatch:ccr:started', { session_id: token.token_id, token_id: token.token_id, pid, worktree: worktreePath });
    }

    return { session_id: token.token_id, pid, worktree_path: worktreePath, log_path: logPath };
  }

  async poll() {
    const available = await this._checkCcrAvailable();
    if (!available) return;

    const runningSessions = this.db.prepare("SELECT * FROM ccr_sessions WHERE state = 'RUNNING'").all();

    for (const session of runningSessions) {
      let isAlive = false;
      try {
        process.kill(session.pid, 0);
        isAlive = true;
      } catch (e) {
        isAlive = false;
      }

      if (!isAlive) {
        let logTail = '';
        try {
          // Read the whole file and take last 100 lines.
          const logContent = fs.readFileSync(session.log_path, 'utf8');
          const lines = logContent.split('\n');
          logTail = lines.slice(-100).join('\n');
        } catch (e) {
          logTail = `Failed to read log: ${e.message}`;
        }

        let exitCode = 1;
        const exitCodePath = `/tmp/cc_${session.session_id}.exit`;
        try {
          if (fs.existsSync(exitCodePath)) {
            exitCode = parseInt(fs.readFileSync(exitCodePath, 'utf8').trim(), 10);
          } else {
             // Fallback if exit code file wasn't written
             let success = !logTail.includes('Error:') && !logTail.includes('Failed to') && !logTail.includes('Traceback');
             exitCode = success ? 0 : 1;
          }
        } catch(e) {
          console.error(`Failed to read exit code for session ${session.session_id}:`, e);
        }

        let success = exitCode === 0;

        const now = new Date().toISOString() + 'Z';
        const newState = success ? 'DONE' : 'FAILED';
        this.db.prepare("UPDATE ccr_sessions SET state=?, finished_at=?, exit_code=? WHERE session_id=?")
          .run(newState, now, exitCode, session.session_id);

        if (this.eventBus) {
          this.eventBus.emit('ccr:session_done', {
            session_id: session.session_id,
            success,
            log_tail: logTail
          });
        }
      }
    }
  }

  async cancelSession(sessionId) {
    const session = this.db.prepare("SELECT * FROM ccr_sessions WHERE session_id=?").get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.state !== 'RUNNING') return;

    try {
      process.kill(session.pid); // default SIGTERM
    } catch(e) {
      // process might be dead already
    }

    const now = new Date().toISOString() + 'Z';
    this.db.prepare("UPDATE ccr_sessions SET state='CANCELLED', finished_at=? WHERE session_id=?")
      .run(now, sessionId);
  }

  async sendMessage(sessionId, msg) {
    throw new Error('NotSupported: CCR sessions are fire-and-forget and do not support mid-session messaging');
  }
}
