import { connect } from '@google/jules-sdk';
import { getDb, registerSession } from './lib/db.mjs';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

function getJulesApiKey() {
  let key = process.env.JULES_API_KEY;
  if (!key) {
    try {
      const out = execSync('bash -c "source ~/.secrets 2>/dev/null && echo $JULES_API_KEY"', { encoding: 'utf-8' });
      key = out.trim();
    } catch (e) {
      // ignore
    }
  }
  if (!key) {
    throw new Error("JULES_API_KEY not set — add it to ~/.secrets");
  }
  return key;
}

async function main() {
  const storyNumber = process.argv[2];
  const storyTitle = process.argv[3];

  if (!storyNumber || !storyTitle) {
    console.error("Usage: node dispatch.mjs <storyNumber> <storyTitle> < <prompt.txt>");
    process.exit(1);
  }

  const prompt = readFileSync(0, 'utf-8'); // read from stdin

  const client = await connect({ apiKey: getJulesApiKey() });

  console.log("🚀 Dispatching Story " + storyNumber + " to Jules API...");

  const session = await client.session({
    prompt,
    source: { github: 'JMThiessen/Copernicus', baseBranch: 'main' },
    autoPr: true
  });

  console.log(`✓ Dispatched — session ${session.id}`);
  console.log(`  https://jules.google.com/session/${session.id}`);
  console.log(`  PR will be auto-created on completion (AUTO_CREATE_PR mode).`);

  const db = getDb();
  registerSession(db, session.id, storyNumber, storyTitle, prompt);

  const count = db.prepare('SELECT COUNT(*) FROM jules_sessions WHERE merged IS NULL').pluck().get();
  console.log(`  Registered in jules.db (${count} active session(s))`);
}

main().catch(e => {
  console.error("❌ Dispatch failed:", e);
  process.exit(1);
});
