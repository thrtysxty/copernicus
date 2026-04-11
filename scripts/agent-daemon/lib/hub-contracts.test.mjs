import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadContract, getContractDirective } from './hub.mjs';

const ROLES_DIR = path.join(os.homedir(), '.copernicus', 'roles');

describe('hub contracts', () => {
  // Clear roles dir for tests
  beforeAll(() => {
    if (fs.existsSync(ROLES_DIR)) {
      fs.rmSync(ROLES_DIR, { recursive: true, force: true });
    }
  });

  it('default copy-on-first-run', () => {
    expect(fs.existsSync(ROLES_DIR)).toBe(false);
    const contract = loadContract('architect');
    expect(fs.existsSync(ROLES_DIR)).toBe(true);
    expect(contract.role).toBe('architect');
  });

  it('valid contract loads', () => {
    const contract = loadContract('coder');
    expect(contract.role).toBe('coder');
    expect(contract.authority_level).toBe(2);
  });

  it('missing required field throws', () => {
    const invalidPath = path.join(ROLES_DIR, 'invalid1.yaml');
    fs.writeFileSync(invalidPath, `
role: "invalid1"
class: "operational"
# missing authority_level and others
    `.trim());
    expect(() => loadContract('invalid1')).toThrow(/failed schema validation/);
  });

  it('invalid authority_level throws', () => {
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
    expect(() => loadContract('invalid2')).toThrow(/failed schema validation/);
  });

  it('getContractDirective returns behavioral directive only', () => {
    const directive = getContractDirective('reviewer');
    expect(typeof directive).toBe('string');
    expect(directive).toContain('Review PR diffs');
  });

  it('contract with behavioral_tests.required: true', () => {
    const contract = loadContract('tester');
    expect(contract.behavioral_tests.required).toBe(true);
    expect(contract.behavioral_tests.gate).toBe('TESTING_LOOP_CLOSE');
  });

  it('contract without behavioral_tests block is valid', () => {
    const contract = loadContract('architect');
    expect(contract.behavioral_tests).toBeUndefined();
  });
});
