import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadContract, getContractDirective } from './hub.mjs';

const ROLES_DIR = path.join(os.homedir(), '.copernicus', 'roles');

describe('hub contracts', () => {
  // Clear roles dir for tests
  before(() => {
    if (fs.existsSync(ROLES_DIR)) {
      fs.rmSync(ROLES_DIR, { recursive: true, force: true });
    }
  });

  test('default copy-on-first-run', () => {
    assert.strictEqual(fs.existsSync(ROLES_DIR), false);
    const contract = loadContract('architect');
    assert.strictEqual(fs.existsSync(ROLES_DIR), true);
    assert.strictEqual(contract.role, 'architect');
  });

  test('valid contract loads', () => {
    const contract = loadContract('coder');
    assert.strictEqual(contract.role, 'coder');
    assert.strictEqual(contract.authority_level, 2);
  });

  test('missing required field throws', () => {
    const invalidPath = path.join(ROLES_DIR, 'invalid1.yaml');
    fs.writeFileSync(invalidPath, `
role: "invalid1"
class: "operational"
# missing authority_level and others
    `.trim());
    assert.throws(() => loadContract('invalid1'), /failed schema validation/);
  });

  test('invalid authority_level throws', () => {
    const invalidPath = path.join(ROLES_DIR, 'invalid2.yaml');
    fs.writeFileSync(invalidPath, `
role: "invalid2"
class: "operational"
authority_level: 6
version: "1.0.0"
contract: "test"
capabilities_required: []
token_defaults:
  ttl: "2h"
  max_revisions: 2
  budget_usd: 1.00
    `.trim());
    assert.throws(() => loadContract('invalid2'), /failed schema validation/);
  });

  test('getContractDirective returns behavioral directive only', () => {
    const directive = getContractDirective('reviewer');
    assert.strictEqual(typeof directive, 'string');
    assert.ok(directive.includes('Review PR diffs'));
  });

  test('contract with behavioral_tests.required: true', () => {
    const contract = loadContract('tester');
    assert.strictEqual(contract.behavioral_tests.required, true);
    assert.strictEqual(contract.behavioral_tests.gate, 'TESTING_LOOP_CLOSE');
  });

  test('contract without behavioral_tests block is valid', () => {
    const contract = loadContract('architect');
    assert.strictEqual(contract.behavioral_tests, undefined);
  });
});
