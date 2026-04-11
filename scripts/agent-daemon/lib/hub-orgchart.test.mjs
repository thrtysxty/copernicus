import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { getDb } from './db.mjs';
import { mint, loadOrgChart, getOrgChart, canBlock } from './hub.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';

const COPERNICUS_DIR = join(homedir(), '.copernicus');
const ORG_YAML_PATH = join(COPERNICUS_DIR, 'org.yaml');

describe('Hub Org Chart Module', () => {
  let db;
  let originalOrgContent = null;

  before(() => {
    db = getDb();
    if (existsSync(ORG_YAML_PATH)) {
      originalOrgContent = readFileSync(ORG_YAML_PATH, 'utf8');
    }
  });

  after(() => {
    if (originalOrgContent !== null) {
      writeFileSync(ORG_YAML_PATH, originalOrgContent, 'utf8');
    } else if (existsSync(ORG_YAML_PATH)) {
      rmSync(ORG_YAML_PATH);
    }
  });

  test('loadOrgChart loads valid org chart', () => {
    const yamlContent = `
version: 1
roles:
  test_role:
    class: operational
    authority_level: 2
    assigned_to:
      provider: openai
      model: o3-mini
    token_ttl: "1h"
    token_budget_usd: 1.0
    token_max_revisions: 2
authority_chains:
  regulatory_overrides_operational: true
enforcement:
  block_mode: hard
  wait_timeout_plan: "30m"
  wait_timeout_human: "2h"
  require_token_for_dispatch: true
`;
    writeFileSync(ORG_YAML_PATH, yamlContent, 'utf8');
    const chart = loadOrgChart();
    assert.strictEqual(chart.version, 1);
    assert.ok(chart.roles['test_role']);
    assert.strictEqual(chart.roles['test_role'].authority_level, 2);
  });

  test('loadOrgChart throws on missing required field', () => {
    const yamlContent = `
version: 1
roles:
  test_role:
    class: operational
    # missing authority_level
    assigned_to:
      provider: openai
      model: o3-mini
    token_ttl: "1h"
    token_budget_usd: 1.0
    token_max_revisions: 2
authority_chains:
  regulatory_overrides_operational: true
enforcement:
  block_mode: hard
  wait_timeout_plan: "30m"
  wait_timeout_human: "2h"
  require_token_for_dispatch: true
`;
    writeFileSync(ORG_YAML_PATH, yamlContent, 'utf8');
    assert.throws(() => loadOrgChart(), /failed schema validation/);
  });

  test('mint() throws UnknownRole if role not in org chart', () => {
    // Write valid org chart but mint a different role
    const yamlContent = `
version: 1
roles:
  known_role:
    class: operational
    authority_level: 2
    assigned_to:
      provider: openai
      model: o3-mini
    token_ttl: "1h"
    token_budget_usd: 1.0
    token_max_revisions: 2
authority_chains:
  regulatory_overrides_operational: true
enforcement:
  block_mode: hard
  wait_timeout_plan: "30m"
  wait_timeout_human: "2h"
  require_token_for_dispatch: true
`;
    writeFileSync(ORG_YAML_PATH, yamlContent, 'utf8');
    loadOrgChart(); // Reloads the in-memory state

    assert.throws(() => mint({ role: 'unknown_role' }, '123', null), /UnknownRole/);
  });

  test('canBlock returns true for configured authority chains', () => {
    const yamlContent = `
version: 1
roles:
  coder:
    class: operational
    authority_level: 1
    assigned_to:
      provider: jules
      model: jules
    token_ttl: "2h"
    token_budget_usd: 2.0
    token_max_revisions: 5
  reviewer:
    class: regulatory
    authority_level: 4
    assigned_to:
      provider: anthropic
      model: claude-3-7-sonnet-20250219
    token_ttl: "30m"
    token_budget_usd: 0.5
    token_max_revisions: 1
authority_chains:
  regulatory_overrides_operational: true
  reviewer_can_block: ["coder"]
enforcement:
  block_mode: hard
  wait_timeout_plan: "30m"
  wait_timeout_human: "2h"
  require_token_for_dispatch: true
`;
    writeFileSync(ORG_YAML_PATH, yamlContent, 'utf8');
    loadOrgChart();

    assert.strictEqual(canBlock('reviewer', 'coder'), true);
    assert.strictEqual(canBlock('coder', 'reviewer'), false);
    assert.strictEqual(canBlock('unknown', 'coder'), false);
  });

  test('constitutional fields are read-only via API', () => {
      const chart = getOrgChart();
      assert.ok(chart.roles['coder']);
      assert.strictEqual(chart.roles['coder'].authority_level, 1);

      // Attempting to modify should not change the returned object on subsequent gets
      // since getOrgChart returns the current state, and there should be no setter API.
      // E.g. we verify there is no `setOrgChartRole` or similar API.
      assert.strictEqual(typeof chart.setOrgChartRole, 'undefined');
  });

});
