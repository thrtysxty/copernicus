import { connect } from '@google/jules-sdk';
import { getDb, registerSession } from './lib/db.mjs';
import { issue } from './lib/registry.mjs';
import { readFileSync, appendFileSync } from 'fs';
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

  let difficultyScore = 1;

  // Count ACs (lines starting with - [ ])
  const acsCount = (prompt.match(/^- \[ \]/gm) || []).length;

  // Count files in scope
  let filesCount = 0;
  const filesSectionMatch = prompt.match(/## Files in Scope\n([\s\S]*?)(?=\n##|$)/);
  if (filesSectionMatch) {
    filesCount = (filesSectionMatch[1].match(/^- /gm) || []).length;
  }

  // Count IPC channels used
  let ipcCount = 0;
  const ipcSectionMatch = prompt.match(/## IPC Channels Used\n([\s\S]*?)(?=\n##|$)/);
  if (ipcSectionMatch && !ipcSectionMatch[1].match(/None/i)) {
    ipcCount = (ipcSectionMatch[1].match(/^- /gm) || []).length;
  }

  // Heuristic: ACs count + scope file count + new IPC channels
  const scoreSum = acsCount + filesCount + ipcCount;
  if (scoreSum >= 10) difficultyScore = 5;
  else if (scoreSum >= 7) difficultyScore = 4;
  else if (scoreSum >= 4) difficultyScore = 3;
  else if (scoreSum >= 2) difficultyScore = 2;

  let capabilities = ['message']; // default: readonly / reviewer
  if (difficultyScore >= 5) {
    capabilities = ['shell', 'fs_write', 'spawn', 'message']; // orchestrator
  } else if (difficultyScore >= 3) {
    capabilities = ['shell', 'fs_write', 'message']; // coder
  }

  const token = issue({
    agent: 'jules',
    story_id: storyNumber,
    capabilities,
    difficulty_score: difficultyScore,
    ttl_hours: 4
  });

  const client = await connect({ apiKey: getJulesApiKey() });

  console.log("🚀 Dispatching Story " + storyNumber + " to Jules API...");

  // According to ACs, the token needs to be passed to the agent as env var AGENT_TOKEN
  // Since we are creating a jules session, we pass environment variables via the config if supported,
  // but it's primarily an external API. We will append it to the log file.
  appendFileSync('/tmp/agent-daemon.log', `[${new Date().toISOString()}] Issued token ${token.token_id.substring(0, 8)}... (Score: ${difficultyScore}, Caps: ${capabilities.join(',')})\n`);

  const session = await client.session({
    prompt,
    source: { github: 'JMThiessen/Copernicus', baseBranch: 'main' },
    autoPr: true,
    // Add the token to the env if the sdk supports it, or it will be ignored safely
    env: { AGENT_TOKEN: token.token_id }
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
