import net from 'net';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { getDb, writeEpisode } from './db.mjs';

const SOCKET_PATH = '/tmp/copernicus-agent-bus.sock';
const FALLBACK_PORT = 7432;
const LOG_FILE = '/tmp/agent-daemon.log';

let connectedAgents = new Map();

function logProgress(msg) {
  const line = `[${new Date().toISOString()}] PROGRESS ${msg.from}: ${JSON.stringify(msg.payload)}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

function logConversation(storyId, msg) {
  if (!storyId) return;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const logDir = path.join(process.cwd(), 'docs', 'sessions', dateStr);
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `session_${storyId}_bus.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify(msg) + '\n');
}

export function startServer(db) {
  let isUnixSocket = true;
  if (process.platform === 'win32') {
    isUnixSocket = false;
  } else {
    try {
      if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
      }
    } catch(e) {
      isUnixSocket = false;
    }
  }

  const server = net.createServer((socket) => {
    let agentId = null;
    let buffer = '';

    socket.on('data', async (data) => {
      const strData = data.toString();
      if (strData.startsWith('GET / HTTP/1.1')) {
        const keyMatch = strData.match(/Sec-WebSocket-Key: (.*)\r\n/);
        if (keyMatch) {
            const key = keyMatch[1];
            const crypto = await import('crypto');
            const acceptKey = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
            socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                         'Upgrade: websocket\r\n' +
                         'Connection: Upgrade\r\n' +
                         'Sec-WebSocket-Accept: ' + acceptKey + '\r\n\r\n');
        }
        return;
      }

      buffer += strData;
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          msg.ts = msg.ts || new Date().toISOString();

          // Handle daemon status query
          if (msg.type === 'ask' && msg.to === 'daemon' && msg.payload?.action === 'status') {
              socket.write(JSON.stringify({
                  type: 'reply',
                  from: 'daemon',
                  to: msg.from,
                  payload: { agents: getConnectedAgents() },
                  ts: new Date().toISOString()
              }) + '\n');
              continue;
          }

          if (msg.story_id) {
            logConversation(msg.story_id, msg);
          }

          if (msg.type === 'identify') {
            agentId = msg.from;
            connectedAgents.set(agentId, {
              socket,
              capabilities: msg.payload?.capabilities || [],
              story_id: msg.payload?.story_id || null
            });
            console.log(`[bus] Agent ${agentId} connected`);
          } else if (msg.type === 'progress') {
            logProgress(msg);
            if (msg.story_id) {
              const stmt = db.prepare('SELECT session_id FROM jules_sessions WHERE story = ? AND state NOT IN (\'COMPLETED\', \'FAILED\', \'CANCELLED\') LIMIT 1');
              const row = stmt.get(msg.story_id);
              if (row) {
                db.prepare('UPDATE jules_sessions SET state = \'inProgress\', updated = ? WHERE session_id = ?').run(new Date().toISOString(), row.session_id);
              }
            }
          } else if (msg.type === 'ask' || msg.type === 'reply' || msg.type === 'handoff' || msg.type === 'tool_result') {
            if (msg.type === 'handoff') {
              if (msg.story_id) {
                const stmt = db.prepare('SELECT session_id FROM jules_sessions WHERE story = ? LIMIT 1');
                const row = stmt.get(msg.story_id);
                if (row) {
                  writeEpisode(db, row.session_id);
                }
              }
            }
            routeMessage(msg);
          } else if (msg.type === 'complete') {
            console.log(`[bus] Agent ${msg.from} completed task for story ${msg.story_id}`);
            if (msg.story_id) {
               const stmt = db.prepare('SELECT * FROM jules_sessions WHERE story = ? AND state NOT IN (\'FAILED\', \'CANCELLED\') ORDER BY dispatched DESC LIMIT 1');
               const row = stmt.get(msg.story_id);
               if (row) {
                 db.prepare('UPDATE jules_sessions SET state = \'COMPLETED\', updated = ? WHERE session_id = ?').run(new Date().toISOString(), row.session_id);

                 const { getPrState, mergePr, getPrCommit } = await import('./github.mjs');
                 const { reviewPr } = await import('./review.mjs');
                 const { updateSessionMerged, updateSessionReview, writeVerificationRecord, writeStatus, getStoryPath, stampStoryId } = await import('./db.mjs');

                 const prNumber = msg.payload?.pr_number || row.pr_number;
                 if (prNumber) {
                     const freshRow = db.prepare('SELECT * FROM jules_sessions WHERE session_id=?').get(row.session_id);
                     if (freshRow.review_state === 'APPROVED') {
                         console.log(`  ✓ PR #${prNumber} already APPROVED. Proceeding to merge.`);
                         await performMerge(freshRow, db, prNumber, msg.story_id);
                         return;
                     }

                     const currentPrState = getPrState(prNumber);
                     if (['CLOSED', 'MERGED'].includes(currentPrState)) {
                         console.log(`  PR #${prNumber} is ${currentPrState} on GitHub — marking finished, skipping review.`);
                         updateSessionMerged(db, freshRow.session_id, currentPrState);
                         writeEpisode(db, freshRow.session_id);
                         return;
                     }

                     let doReview = false;
                     if (!freshRow.review_state || freshRow.review_state === 'FAILED') {
                         doReview = true;
                     } else if (['BLOCKED', 'REQUEST_CHANGES'].includes(freshRow.review_state)) {
                         if (freshRow.reviewed) {
                             const timeSince = (Date.now() - new Date(freshRow.reviewed).getTime()) / 1000;
                             if (timeSince > 300) doReview = true;
                         } else {
                             doReview = true;
                         }
                     }

                     if (doReview) {
                         const verdict = await reviewPr(prNumber, msg.story_id);
                         updateSessionReview(db, freshRow.session_id, verdict);

                         if (verdict.verdict === 'APPROVED') {
                             console.log(`  ✓ Review APPROVED — ${verdict.summary}`);
                             await performMerge(freshRow, db, prNumber, msg.story_id, verdict);
                         } else {
                             console.warn(`  ❌ Review ${verdict.verdict} — ${verdict.summary}`);
                             const reworkPrompt = `Your PR was reviewed and requires changes.\nVerdict: ${verdict.verdict}\nSummary: ${verdict.summary}\nMissing ACs:\n${verdict.acs_missing.map(a => '- ' + a).join('\n')}\n\nPlease fix these issues and update the PR.`;

                             routeMessage({
                                 type: 'ask',
                                 from: 'daemon',
                                 to: msg.from,
                                 payload: { question: reworkPrompt },
                                 ts: new Date().toISOString()
                             });
                         }
                     }
                 }
               }
            }
          }

        } catch (e) {
          console.error('[bus] Error processing message:', e);
        }
      }
    });

    socket.on('close', () => {
      if (agentId) {
        connectedAgents.delete(agentId);
        console.log(`[bus] Agent ${agentId} disconnected`);
      }
    });

    socket.on('error', (err) => {
      console.error(`[bus] Socket error for agent ${agentId}:`, err.message);
    });
  });

  async function performMerge(row, db, prNumber, storyId, verdictObj = null) {
      const { mergePr, getPrCommit } = await import('./github.mjs');
      const { updateSessionMerged, writeVerificationRecord, writeStatus, getStoryPath, stampStoryId } = await import('./db.mjs');
      const { ok, error } = mergePr(prNumber);
      if (ok) {
          const mergeSha = getPrCommit(prNumber);
          let vData = verdictObj;
          if (!vData) {
              const freshRow = db.prepare('SELECT review_verdict FROM jules_sessions WHERE session_id=?').get(row.session_id);
              if (freshRow && freshRow.review_verdict) {
                 try { vData = JSON.parse(freshRow.review_verdict); } catch (e) {}
              }
              if (!vData) vData = { verdict: 'APPROVED', reviewer_model: 'unknown', reviewed_at: new Date().toISOString(), acs_met: [], acs_missing: [], summary: 'Manually approved or fallback' };
          }
          vData.merge_sha = mergeSha || 'unknown';
          const storyPath = getStoryPath(storyId);
          if (storyPath) {
              writeVerificationRecord(storyPath, vData);
              writeStatus(storyPath, 'COMPLETE');
          } else {
              console.warn(`  ❌ Story file for story ${storyId} not found. Cannot write verification record.`);
          }
          console.log(`  ✓ Merged PR #${prNumber} ${mergeSha ? `(${mergeSha.substring(0,8)})` : ''}`);
          updateSessionMerged(db, row.session_id, mergeSha);
          const mergeTs = new Date().toISOString();
          stampStoryId(storyId.toString(), row.dispatched || mergeTs, mergeTs);
          writeEpisode(db, row.session_id);
      } else {
          console.warn(`  ❌ Merge failed: ${error}`);
      }
  }

  const listenArgs = isUnixSocket ? [SOCKET_PATH] : [FALLBACK_PORT, 'localhost'];
  server.listen(...listenArgs, () => {
    console.log(`[bus] Server listening on ${isUnixSocket ? SOCKET_PATH : `localhost:${FALLBACK_PORT}`}`);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
       if (isUnixSocket) {
           console.log(`[bus] Failed to bind to ${SOCKET_PATH}, falling back to ws://localhost:${FALLBACK_PORT}`);
           server.listen(FALLBACK_PORT, 'localhost');
       } else {
           console.error(`[bus] Failed to bind to localhost:${FALLBACK_PORT}`);
       }
    }
  });

  return server;
}

function routeMessage(msg) {
  if (msg.to) {
    const target = connectedAgents.get(msg.to);
    if (target) {
      target.socket.write(JSON.stringify(msg) + '\n');
    }
  } else {
    for (const [id, target] of connectedAgents.entries()) {
      if (id !== msg.from) {
        target.socket.write(JSON.stringify(msg) + '\n');
      }
    }
  }
}

export function getConnectedAgents() {
  return Array.from(connectedAgents.entries()).map(([id, data]) => ({
    id,
    capabilities: data.capabilities,
    story_id: data.story_id
  }));
}

export function connect(agentId, options = {}) {
  let socketPath = options.socketPath || SOCKET_PATH;
  let port = null;
  let host = null;
  if (options.url && options.url.startsWith('ws://')) {
      const urlObj = new URL(options.url);
      port = urlObj.port || 7432;
      host = urlObj.hostname;
      socketPath = null;
  }

  return new Promise((resolve, reject) => {
    const client = socketPath ? net.createConnection(socketPath) : net.createConnection(port, host);
    const emitter = new EventEmitter();
    let buffer = '';
    const pendingAsks = new Map();

    client.on('connect', () => {
      resolve({
        send(msg) {
          msg.ts = msg.ts || new Date().toISOString();
          client.write(JSON.stringify(msg) + '\n');
        },
        on(type, handler) {
          emitter.on(type, handler);
        },
        ask(to, payload) {
           return new Promise((resolveAsk, rejectAsk) => {
             const msg = { type: 'ask', from: agentId, to, payload, ts: new Date().toISOString() };
             pendingAsks.set(to, resolveAsk);
             client.write(JSON.stringify(msg) + '\n');
           });
        },
        close() {
          client.end();
        }
      });
    });

    client.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          emitter.emit(msg.type, msg);

          if (msg.type === 'reply' && pendingAsks.has(msg.from)) {
            pendingAsks.get(msg.from)(msg);
            pendingAsks.delete(msg.from);
          }
        } catch (e) {
          console.error('[bus client] parse error', e);
        }
      }
    });

    client.on('error', (err) => {
      if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
         if (socketPath) {
             const fallbackClient = net.createConnection(FALLBACK_PORT, 'localhost');
             fallbackClient.on('connect', () => {
                 resolve({
                    send(msg) {
                      msg.ts = msg.ts || new Date().toISOString();
                      fallbackClient.write(JSON.stringify(msg) + '\n');
                    },
                    on(type, handler) {
                      emitter.on(type, handler);
                    },
                    ask(to, payload) {
                       return new Promise((resolveAsk, rejectAsk) => {
                         const msg = { type: 'ask', from: agentId, to, payload, ts: new Date().toISOString() };
                         pendingAsks.set(to, resolveAsk);
                         fallbackClient.write(JSON.stringify(msg) + '\n');
                       });
                    },
                    close() {
                      fallbackClient.end();
                    }
                 });
             });
             fallbackClient.on('data', (data) => {
                  buffer += data.toString();
                  const lines = buffer.split('\n');
                  buffer = lines.pop();

                  for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                      const msg = JSON.parse(line);
                      emitter.emit(msg.type, msg);

                      if (msg.type === 'reply' && pendingAsks.has(msg.from)) {
                        pendingAsks.get(msg.from)(msg);
                        pendingAsks.delete(msg.from);
                      }
                    } catch (e) {
                      console.error('[bus client] parse error', e);
                    }
                  }
             });
             fallbackClient.on('error', (fallbackErr) => {
                 reject(fallbackErr);
             });
         } else {
             reject(err);
         }
      } else {
         reject(err);
      }
    });
  });
}
