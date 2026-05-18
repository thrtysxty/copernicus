import { connect } from '@google/jules-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

let apiKey = process.env.JULES_API_KEY;
if (!apiKey) {
  try {
    const cfg = readFileSync(join(process.env.HOME, '.jules', 'config.yaml'), 'utf8');
    apiKey = cfg.match(/api_key:\s*(.+)/)?.[1]?.trim();
  } catch (e) {}
}
if (!apiKey) throw new Error('No JULES_API_KEY found');

const sessionIds = process.argv.slice(2);
if (!sessionIds.length) {
  console.error('Usage: node approve-plans.mjs <session_id> [session_id...]');
  process.exit(1);
}

const client = connect({ apiKey });

for (const id of sessionIds) {
  try {
    const session = client.session(id);
    const info = await session.info();
    const pr = info.pr_url || info.prUrl || info.pull_request_url || info.url || '';
    console.log(`${id}: state=${info.state}  ${(info.title || '').substring(0, 50)}`);
    if (info.state === 'awaitingUserFeedback') {
      // Try to get the latest message Jules sent
      const latestMsg = JSON.stringify(info.outcome || info).match(/"message":"([^"]{0,300})/)?.[1];
      if (latestMsg) console.log(`  Jules says: ${latestMsg}`);
    }
    const prMatch = JSON.stringify(info).match(/https:\/\/github\.com\/[^\s"]+\/pull\/\d+/);
    if (prMatch) console.log(`  PR: ${prMatch[0]}`);
    if (info.state === 'awaitingPlanApproval') {
      await session.approve();
      console.log(`  ✓ Approved`);
    } else {
      console.log(`  — no action needed`);
    }
  } catch (e) {
    console.log(`${id}: error — ${e.message?.substring(0, 100)}`);
  }
}
