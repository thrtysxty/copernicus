import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, getActiveSessions, showStatus } from './lib/db.mjs';
import { getActiveTokens } from './lib/registry.mjs';
import { startServer, getConnectedAgents } from './lib/bus.mjs';
import { maybeImprove } from './lib/improver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  const db = getDb();

  if (args.includes('--status')) {
    showStatus(db);

    console.log('\nACTIVE TOKENS');
    console.log('-'.repeat(99));
    const tokens = getActiveTokens(db);
    if (!tokens.length) {
       console.log('No active tokens.');
    } else {
       console.log(
         'AGENT'.padEnd(8),
         'STORY'.padEnd(8),
         'SCORE'.padEnd(6),
         'CAPABILITIES'.padEnd(35),
         'EXPIRES'
       );
       for (const t of tokens) {
         console.log(
           t.agent_name.padEnd(8),
           String(t.story_id || '').padEnd(8),
           String(t.difficulty_score || '').padEnd(6),
           t.capabilities.join(',').padEnd(35),
           t.expires_at
         );
         const nearCeilingLogs = t.actions_log.filter(a => a.nearCeiling);
         if (nearCeilingLogs.length > 0) {
           console.log(`    ⚠️  [near_ceiling] exercised ${nearCeilingLogs.length} times near ceiling.`);
         }
       }
    }

    // Bus integration: fetch connected agents if daemon is running.
    // If daemon is not running, we'd need to connect and ask, but status usually prints db state.
    // However, --status might be running in a separate process!
    // Since AC says: "--status shows connected agents", we can either print from in-memory if we are the server,
    // or we might need to connect to the bus and ask.
    // Wait, `node scripts/agent-daemon/index.mjs --status` runs as a separate process. It reads `jules.db`.
    // The server is in the main daemon process!
    // Let's implement a simple IPC over the bus to query status, or just print them if it's the same process (it's not).
    console.log('\nCONNECTED AGENTS');
    console.log('-'.repeat(99));

    // We'll try to connect to the bus socket and send a status request.
    const net = await import('net');
    try {
        const client = net.createConnection('/tmp/copernicus-agent-bus.sock');
        client.on('connect', () => {
            client.write(JSON.stringify({ type: 'ask', from: 'status-cli', to: 'daemon', payload: { action: 'status' }, ts: new Date().toISOString() }) + '\n');
        });
        client.on('data', (data) => {
            const lines = data.toString().split('\n');
            for(let line of lines) {
                if(!line.trim()) continue;
                try {
                    const msg = JSON.parse(line);
                    if(msg.type === 'reply' && msg.to === 'status-cli') {
                        const agents = msg.payload.agents || [];
                        if (agents.length === 0) {
                            console.log('No agents connected.');
                        } else {
                            console.log('ID'.padEnd(30), 'STORY'.padEnd(8), 'CAPABILITIES');
                            for(const a of agents) {
                                console.log(a.id.padEnd(30), String(a.story_id || '').padEnd(8), a.capabilities.join(','));
                            }
                        }
                        client.end();
                    }
                } catch(e){}
            }
        });
        client.on('error', () => {
            console.log('Daemon socket not reachable.');
        });
        client.on('close', () => {
             process.exit(0);
        });
        return; // Don't process.exit(0) immediately, wait for reply
    } catch(e) {
        console.log('Daemon socket not reachable.');
        process.exit(0);
    }
  }

  // Start the socket bus server
  startServer(db);

  const handlersPath = join(__dirname, 'handlers');
  const handlerFiles = readdirSync(handlersPath).filter(f => f.endsWith('.mjs'));
  const handlers = [];

  for (const file of handlerFiles) {
    const mod = await import(join(handlersPath, file));
    if (mod.default && typeof mod.default.attach === 'function') {
      handlers.push(mod.default);
    }
  }

  const attachedSessionIds = new Set();

  function attachNewSessions() {
    const activeSessions = getActiveSessions(db);
    for (const session of activeSessions) {
      if (attachedSessionIds.has(session.session_id)) continue;
      const handler = handlers.find(h => h.owns(session));
      if (handler) {
        attachedSessionIds.add(session.session_id);
        handler.attach(session, db).catch(e => {
          console.error(`Handler ${handler.name} failed for session ${session.session_id}: ${e.message}`);
          attachedSessionIds.delete(session.session_id); // allow retry on next poll
        });
      } else {
        console.warn(`No handler found for session ${session.session_id} (agent: ${session.agent})`);
      }
    }
  }

  const activeSessions = getActiveSessions(db);
  console.log(`Found ${activeSessions.length} active sessions.`);
  attachNewSessions();

  if (args.includes('--once')) {
    console.log('--once flag provided, exiting after attach phase.');
    // Run improver once
    maybeImprove(db);
    // Give streams a brief moment to connect before exiting for tests
    setTimeout(() => process.exit(0), 1000);
  } else {
    console.log('Daemon running. Press Ctrl+C to exit.');
    // Poll for new sessions every 30 seconds
    setInterval(() => {
      attachNewSessions();
    }, 30 * 1000);
    // Periodically run the improver to check for new completed sessions
    setInterval(() => {
      maybeImprove(db);
    }, 60 * 1000);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
