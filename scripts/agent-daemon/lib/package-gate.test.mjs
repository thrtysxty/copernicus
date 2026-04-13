import test from 'node:test';
import assert from 'node:assert';
import { packageGate, getConfig, updateConfig } from './package-gate.mjs';
import os from 'os';
import path from 'path';
import fs from 'fs';
import yaml from '../../../copernicus/node_modules/js-yaml/index.js';

test('packageGate.check', async (t) => {
  const SECURITY_YAML_PATH = path.join(os.homedir(), '.copernicus', 'security.yaml');

  t.afterEach(() => {
    if (fs.existsSync(SECURITY_YAML_PATH)) {
      fs.unlinkSync(SECURITY_YAML_PATH);
    }
  });

  await t.test('returns ALLOWLISTED for packages in allowlist', async () => {
    updateConfig({
      package_allowlist: ['my-safe-pkg']
    });
    const result = await packageGate.check('my-safe-pkg', 'npm');
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.reason, 'ALLOWLISTED');
  });

  await t.test('returns BLOCKLISTED for packages in blocklist', async () => {
    updateConfig({
      package_blocklist: ['my-bad-pkg']
    });
    const result = await packageGate.check('my-bad-pkg', 'npm');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'BLOCKLISTED');
  });

  await t.test('returns APPROVED for established package meeting both thresholds', async () => {
    updateConfig({
      package_gate: {
        enabled: true,
        min_age_days: 1,
        min_weekly_downloads: 1,
        registries: ['npm']
      }
    });
    const result = await packageGate.check('react', 'npm');
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.reason, 'APPROVED');
  });

  await t.test('returns LOW_DOWNLOADS for unpopular package', async () => {
    updateConfig({
      package_gate: {
        enabled: true,
        min_age_days: 1,
        min_weekly_downloads: 10000000000000,
        registries: ['npm']
      }
    });
    const result = await packageGate.check('react', 'npm');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.startsWith('LOW_DOWNLOADS'));
  });

  await t.test('returns TOO_NEW for recent package', async () => {
    updateConfig({
      package_gate: {
        enabled: true,
        min_age_days: 10000000,
        min_weekly_downloads: 1,
        registries: ['npm']
      }
    });
    const result = await packageGate.check('react', 'npm');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.startsWith('TOO_NEW'));
  });
});
