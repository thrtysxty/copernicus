import { execFile, execFileSync } from 'child_process';
import { homedir } from 'os';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const GH = '/opt/homebrew/bin/gh';
const GITHUB_REPO = 'JMThiessen/Copernicus';

const getEnv = () => {
  const env = { ...process.env, HOME: process.env.HOME || homedir(), PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' };
  delete env.GITHUB_TOKEN;
  return env;
};

export function getPrState(prNumber) {
  try {
    const out = execFileSync(GH, ['pr', 'view', String(prNumber), '--repo', GITHUB_REPO, '--json', 'state'], { env: getEnv(), encoding: 'utf-8' });
    const data = JSON.parse(out);
    return data.state.toUpperCase();
  } catch (e) {
    return 'OPEN';
  }
}

export function mergePr(prNumber) {
  try {
    execFileSync(GH, ['pr', 'ready', String(prNumber), '--repo', GITHUB_REPO], { env: getEnv(), stdio: 'ignore' });
    execFileSync(GH, ['pr', 'merge', String(prNumber), '--repo', GITHUB_REPO, '--squash'], { env: getEnv(), stdio: 'ignore' });
    return { ok: true, error: '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function getPrCommit(prNumber) {
  try {
    const out = execFileSync(GH, ['pr', 'view', String(prNumber), '--repo', GITHUB_REPO, '--json', 'mergeCommit', '--jq', '.mergeCommit.oid'], { env: getEnv(), encoding: 'utf-8' });
    const sha = out.trim();
    return sha && sha !== 'null' ? sha : null;
  } catch (e) {
    return null;
  }
}

export function getPrDiff(prNumber) {
  try {
    const out = execFileSync(GH, ['pr', 'diff', String(prNumber), '--repo', GITHUB_REPO], { env: getEnv(), encoding: 'utf-8' });
    return out.slice(0, 12000);
  } catch (e) {
    throw new Error(`Failed to fetch PR diff: ${e.message}`);
  }
}

export function getPrBody(prNumber) {
  try {
    const out = execFileSync(GH, ['pr', 'view', String(prNumber), '--repo', GITHUB_REPO, '--json', 'body', '--jq', '.body'], { env: getEnv(), encoding: 'utf-8' });
    return out;
  } catch (e) {
    return "";
  }
}

export function deleteRemoteBranch(branch) {
  if (!branch || (!branch.startsWith('jules/') && !branch.startsWith('feat/story-'))) {
    return { ok: true, skipped: true };
  }

  try {
    execFileSync(GH, ['api', `repos/${GITHUB_REPO}/git/refs/heads/${branch}`, '-X', 'DELETE'], { env: getEnv(), stdio: 'ignore' });
    return { ok: true, error: '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function hasHumanReworkRequest(prNumber) {
  try {
    // 1. Check for CHANGES_REQUESTED review state
    const { stdout: reviewsOut } = await execFileAsync(GH, ['pr', 'reviews', String(prNumber), '--repo', GITHUB_REPO, '--json', 'state'], { env: getEnv(), encoding: 'utf-8' });
    const reviews = JSON.parse(reviewsOut);
    for (const review of reviews) {
      if (review.state === 'CHANGES_REQUESTED') {
        return true;
      }
    }

    // 2. Check comments for rework language
    const { stdout: commentsOut } = await execFileAsync(GH, ['pr', 'view', String(prNumber), '--repo', GITHUB_REPO, '--json', 'comments'], { env: getEnv(), encoding: 'utf-8' });
    const viewData = JSON.parse(commentsOut);
    const comments = viewData.comments || [];

    for (const comment of comments) {
      const body = (comment.body || '').toLowerCase();
      if (body.includes('changes requested') || body.includes('re-work request') || body.includes('request changes')) {
        return true;
      }
    }

    return false;
  } catch (e) {
    console.warn(`Failed to check human reviews for PR ${prNumber}: ${e.message}`);
    return false; // Fail open or closed? AC says if found, treat as block. If it fails, assume false, but log.
  }
}
