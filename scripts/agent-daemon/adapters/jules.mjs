import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

export class JulesAdapter {
  constructor(db, hub, eventBus) {
    this.db = db;
    this.hub = hub;
    this.eventBus = eventBus;
    this.attachedSessionIds = new Set();
  }

  async dispatch(token, storyPath) {
    if (!token || token.status !== 'ACTIVE') {
      throw new Error('Token is not ACTIVE');
    }

    const scriptPath = path.join(REPO_ROOT, 'scripts/jules_assign.sh');

    const env = {
        ...process.env,
        AUTO_CREATE_PR: 'true',
        DISPATCH_BRANCH: token.scope?.branch || 'main'
    };

    const { stdout } = await execFileAsync('bash', [scriptPath, storyPath], { cwd: REPO_ROOT, env });

    const match = stdout.match(/session\/(\d+)/);
    if (!match) {
        throw new Error("Could not capture session ID from stdout:\n" + stdout);
    }

    const session_id = match[1];

    const now = new Date().toISOString() + 'Z';
    try {
        this.db.prepare(`
            INSERT OR IGNORE INTO jules_sessions
              (session_id, story, title, state, dispatched, updated)
            VALUES (?, ?, ?, 'QUEUED', ?, ?)
        `).run(session_id, token.story_id || '', 'Dispatched via Hub', now, now);
    } catch(e) {
        console.error("Failed to insert session record:", e);
    }

    if (this.eventBus) {
        this.eventBus.emit('dispatch:jules:started', { session_id, token_id: token.token_id });
    }

    return { session_id, branch: env.DISPATCH_BRANCH };
  }

  async poll() {
      const { connect } = await import('@google/jules-sdk');
      const { updateSessionState, updateSessionPr, handleCompletedPr } = await import('../lib/db.mjs');

      const activeSessions = this.db.prepare(`
        SELECT * FROM jules_sessions
        WHERE merged IS NULL
          AND state NOT IN ('FAILED', 'CANCELLED')
        ORDER BY dispatched
      `).all();

      let client;
      try {
        client = connect({ apiKey: process.env.JULES_API_KEY });
      } catch (e) {
        console.error(`Failed to connect to Jules SDK: ${e.message}`);
        return;
      }

      for (const sessionRow of activeSessions) {
          const sessionId = sessionRow.session_id;
          const session = client.session(sessionId);

          try {
              const info = await session.info();

              if (info.state === 'awaitingPlanApproval') {
                  if (this.eventBus) {
                      this.eventBus.emit('jules:plan_ready', { session_id: sessionId });
                  }
                  await session.approve();
                  updateSessionState(this.db, sessionId, 'awaitingPlanApproval', true);

                  if (this.eventBus) {
                      this.eventBus.emit('jules:plan_approved', { session_id: sessionId });
                  }
              } else if (info.state === 'completed') {
                  updateSessionState(this.db, sessionId, 'COMPLETED');

                  try {
                      const snapshot = await session.snapshot();
                      if (snapshot.pr) {
                          const pUrl = snapshot.pr.url;
                          const pNum = parseInt(pUrl.replace(/\/$/, '').split('/').pop(), 10);
                          updateSessionPr(this.db, sessionId, 'COMPLETED', pUrl, pNum);
                          if (this.eventBus) {
                              this.eventBus.emit('jules:pr_opened', { session_id: sessionId, pr_url: pUrl, pr_number: pNum });
                          }
                      }
                  } catch (e) {}

                  if (this.eventBus) {
                      this.eventBus.emit('jules:session_done', { session_id: sessionId, status: 'pass' });
                  }
              } else if (info.state === 'failed' || info.state === 'cancelled') {
                  updateSessionState(this.db, sessionId, 'FAILED');
                  if (this.eventBus) {
                      this.eventBus.emit('jules:session_done', { session_id: sessionId, status: 'fail' });
                  }
              }
          } catch(e) {
              console.error(`Poll error for ${sessionId}: ${e.message}`);
          }
      }
  }

  async sendMessage(sessionId, msg) {
      const { connect } = await import('@google/jules-sdk');
      const client = connect({ apiKey: process.env.JULES_API_KEY });
      const session = client.session(sessionId);
      await session.ask(msg);
  }

  async cancelSession(sessionId) {
      const { connect } = await import('@google/jules-sdk');
      const client = connect({ apiKey: process.env.JULES_API_KEY });
      const session = client.session(sessionId);
      await session.cancel();
  }

  name() {
      return 'jules';
  }

  supportedCapabilities() {
      return ['autonomous_pr', 'plan_approval'];
  }
}
