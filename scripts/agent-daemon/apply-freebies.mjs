import { connect } from '@google/jules-sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { homedir } from 'os';

let apiKey = process.env.JULES_API_KEY;
if (!apiKey) {
  try {
    const cfg = readFileSync(join(homedir(), '.jules', 'config.yaml'), 'utf8');
    apiKey = cfg.match(/api_key:\s*(.+)/)?.[1]?.trim();
  } catch (e) {}
}
if (!apiKey) throw new Error('No JULES_API_KEY found');

const sessionIds = process.argv.slice(2);
if (!sessionIds.length) {
  console.error('Usage: node apply-freebies.mjs <session_id> [session_id...]');
  process.exit(1);
}

const REPO = '/Users/dadmin/Projects/copernicus';
const client = connect({ apiKey });

for (const id of sessionIds) {
  try {
    const session = client.session(id);
    const info = await session.info();
    const title = (info.title || id).substring(0, 60);
    console.log(`\n=== ${title} (${id}) ===`);

    const changeSet = info.outputs?.find(o => o.type === 'changeSet');
    if (!changeSet?.changeSet?.gitPatch?.unidiffPatch) {
      console.log('  No patch found — skipping');
      continue;
    }

    const patch = changeSet.changeSet.gitPatch.unidiffPatch;
    const patchFile = `/tmp/jules-freebie-${id}.patch`;
    writeFileSync(patchFile, patch);

    // dry-run first
    try {
      execSync(`git -C "${REPO}" apply --check "${patchFile}"`, { stdio: 'pipe' });
    } catch (e) {
      console.log(`  ✗ Patch does not apply cleanly: ${e.stderr?.toString().trim()}`);
      continue;
    }

    execSync(`git -C "${REPO}" apply "${patchFile}"`, { stdio: 'inherit' });
    console.log(`  ✓ Patch applied`);

    // stage and commit
    execSync(`git -C "${REPO}" add -A`, { stdio: 'inherit' });
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 40);
    execSync(`git -C "${REPO}" commit -m "fix: ${title}\n\nJules session ${id}\n\nCo-Authored-By: Jules <jules@google.com>"`, { stdio: 'inherit' });
    console.log(`  ✓ Committed`);

  } catch (e) {
    console.error(`  Error: ${e.message}`);
  }
}
