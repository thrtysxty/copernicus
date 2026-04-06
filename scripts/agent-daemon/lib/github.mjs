import { execSync } from 'child_process';
import { homedir } from 'os';

const GH = '/opt/homebrew/bin/gh';
const GITHUB_REPO = 'JMThiessen/Copernicus';

const getEnv = () => {
  const env = { ...process.env, HOME: process.env.HOME || homedir(), PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' };
  delete env.GITHUB_TOKEN;
  return env;
};

export function getPrState(prNumber) {
  try {
    const out = execSync(`${GH} pr view ${prNumber} --repo ${GITHUB_REPO} --json state`, { env: getEnv(), encoding: 'utf-8' });
    const data = JSON.parse(out);
    return data.state.toUpperCase();
  } catch (e) {
    return 'OPEN';
  }
}

export function mergePr(prNumber) {
  try {
    execSync(`${GH} pr ready ${prNumber} --repo ${GITHUB_REPO}`, { env: getEnv(), stdio: 'ignore' });
    execSync(`${GH} pr merge ${prNumber} --repo ${GITHUB_REPO} --squash`, { env: getEnv(), stdio: 'ignore' });
    return { ok: true, error: '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function getPrCommit(prNumber) {
  try {
    const out = execSync(`${GH} pr view ${prNumber} --repo ${GITHUB_REPO} --json mergeCommit --jq .mergeCommit.oid`, { env: getEnv(), encoding: 'utf-8' });
    const sha = out.trim();
    return sha && sha !== 'null' ? sha : null;
  } catch (e) {
    return null;
  }
}

export function getPrDiff(prNumber) {
  try {
    const out = execSync(`${GH} pr diff ${prNumber} --repo ${GITHUB_REPO}`, { env: getEnv(), encoding: 'utf-8' });
    return out.slice(0, 12000);
  } catch (e) {
    throw new Error(`Failed to fetch PR diff: ${e.message}`);
  }
}

export function getPrBody(prNumber) {
  try {
    const out = execSync(`${GH} pr view ${prNumber} --repo ${GITHUB_REPO} --json body --jq .body`, { env: getEnv(), encoding: 'utf-8' });
    return out;
  } catch (e) {
    return "";
  }
}
