import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, getActiveSessions, showStatus } from './lib/db.mjs';
import { getActiveTokens } from './lib/registry.mjs';

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

    process.exit(0);
  }

  const handlersPath = join(__dirname, 'handlers');
  const handlerFiles = readdirSync(handlersPath).filter(f => f.endsWith('.mjs'));
  const handlers = [];

  for (const file of handlerFiles) {
    const mod = await import(join(handlersPath, file));
    if (mod.default && typeof mod.default.attach === 'function') {
      handlers.push(mod.default);
    }
  }

  const activeSessions = getActiveSessions(db);
  console.log(`Found ${activeSessions.length} active sessions.`);

  for (const session of activeSessions) {
    const handler = handlers.find(h => h.owns(session));
    if (handler) {
      // Don't await, let them run concurrently
      handler.attach(session, db).catch(e => {
        console.error(`Handler ${handler.name} failed for session ${session.session_id}: ${e.message}`);
      });
    } else {
      console.warn(`No handler found for session ${session.session_id} (agent: ${session.agent})`);
    }
  }

  if (args.includes('--once')) {
    console.log('--once flag provided, exiting after attach phase.');
    // Give streams a brief moment to connect before exiting for tests
    setTimeout(() => process.exit(0), 1000);
  } else {
    console.log('Daemon running. Press Ctrl+C to exit.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
