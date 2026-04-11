import { randomUUID, createHash } from 'crypto';
import { getDb } from './db.mjs';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { z } from 'zod';

class ConstitutionalViolation extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConstitutionalViolation';
  }
}

const COPERNICUS_DIR = join(homedir(), '.copernicus');
const WITNESS_LOG_PATH = join(COPERNICUS_DIR, 'hub-witness.log');
const INTEGRITY_FILE_PATH = join(COPERNICUS_DIR, 'hub-integrity.json');

function writeWitnessLog(event) {
  if (!existsSync(COPERNICUS_DIR)) {
    mkdirSync(COPERNICUS_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${event}\n`;
  appendFileSync(WITNESS_LOG_PATH, logEntry);
}

function computeFileHash(filePath) {
  try {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

function checkIntegrity() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const hubPath = join(currentDir, 'hub.mjs');
  const dbPath = join(currentDir, 'db.mjs');

  const hubHash = computeFileHash(hubPath);
  const dbHash = computeFileHash(dbPath);

  if (!hubHash || !dbHash) {
    writeWitnessLog('CONSTITUTIONAL INTEGRITY FAILURE: Missing source files for hash check');
    console.error('CONSTITUTIONAL INTEGRITY FAILURE: Missing source files for hash check');
    process.exit(2);
  }

  if (!existsSync(INTEGRITY_FILE_PATH)) {
    if (!existsSync(COPERNICUS_DIR)) {
      mkdirSync(COPERNICUS_DIR, { recursive: true });
    }
    writeFileSync(INTEGRITY_FILE_PATH, JSON.stringify({
      'hub.mjs': hubHash,
      'db.mjs': dbHash
    }, null, 2));
    writeWitnessLog('Hub integrity established (first startup).');
  } else {
    try {
      const storedHashes = JSON.parse(readFileSync(INTEGRITY_FILE_PATH, 'utf8'));
      if (storedHashes['hub.mjs'] !== hubHash || storedHashes['db.mjs'] !== dbHash) {
        writeWitnessLog('CONSTITUTIONAL INTEGRITY FAILURE: Source file hashes do not match stored hashes.');
        console.error('CONSTITUTIONAL INTEGRITY FAILURE: Source file hashes do not match stored hashes.');
        process.exit(2);
      }
      // writeWitnessLog('Hub startup: integrity check passed.');
    } catch (e) {
      writeWitnessLog('CONSTITUTIONAL INTEGRITY FAILURE: Could not read integrity file.');
      console.error('CONSTITUTIONAL INTEGRITY FAILURE: Could not read integrity file.');
      process.exit(2);
    }
  }
}

// Perform integrity check strictly on load (unless running in tests where we might not want to exit?
// The AC says "startup integrity check is non-optional - there is no --skip-integrity flag"
// and "Integrity mismatch on startup: Hub refuses to start, writes to witness log"
// So we must call it here on module load if we're not inside a test harness? Wait, AC 9 tests:
// "integrity mismatch exits with code 2" so the test itself will trigger it or mock process.exit.
// If we call it on module load, it makes testing difficult because `import` will exit.
// Let's call it immediately.
checkIntegrity();

/**
 * @constitutional authority_level and class in org.yaml have no write API path anywhere in the codebase.
 */

const RoleContractSchema = z.object({
  role: z.string(),
  class: z.enum(['regulatory', 'operational']),
  authority_level: z.number().int().min(1).max(5),
  version: z.string(),
  contract: z.string(),
  constraints: z.object({
    output_format: z.string().optional(),
    never_modify: z.array(z.string()).optional(),
    required_checks: z.array(z.string()).optional(),
  }).optional(),
  capabilities_required: z.array(z.string()),
  token_defaults: z.object({
    ttl: z.string(),
    max_revisions: z.number().int(),
    budget_usd: z.number(),
  }),
  behavioral_tests: z.object({
    required: z.boolean(),
    runner: z.enum(['playwright', 'jest', 'pytest', 'custom']),
    pattern: z.string(),
    log_pattern: z.string(),
    gate: z.string().default('TESTING_LOOP_CLOSE'),
    record_by_agent: z.boolean().optional(),
  }).optional(),
  fixed_sections: z.array(z.string()).optional(),
  human_sections: z.array(z.string()).optional(),
});

const ROLES_DIR = path.join(os.homedir(), '.copernicus', 'roles');
const DEFAULTS_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'roles',
  'defaults'
);

export function getRoleContractSchema() {
  return RoleContractSchema;
}

/**
 * Mints a new token based on role config, story ID, and worktree.
 * @param {Object} roleConfig
 * @param {string} storyId
 * @param {string} worktree
 * @returns {Object} token object
 */
export function mint(roleConfig, storyId, worktree) {
  if (roleConfig.scope && roleConfig.scope.folder) {
    for (const folderPattern of roleConfig.scope.folder) {
      // Any scope folder that might include hub source files or the copernicus config dir
      if (
        folderPattern.includes('scripts/agent-daemon/lib/hub') ||
        folderPattern.includes('scripts/agent-daemon/lib/db.mjs') ||
        folderPattern.includes('~/.copernicus') ||
        folderPattern.includes('.copernicus') ||
        folderPattern === '*' ||
        folderPattern === '/'
      ) {
        writeWitnessLog(`ConstitutionalViolation: Attempted to mint token with protected scope ${folderPattern}`);
        throw new ConstitutionalViolation(`Scope contains constitutionally protected path: ${folderPattern}`);
      }
    }
  }

  const db = getDb();
  const tokenId = `token-${randomUUID()}`;
  const now = Date.now();

  let roleVersion = 'unknown';
  try {
      let roleNameToLoad = 'default';
      if (typeof roleConfig.role === 'string') {
          roleNameToLoad = roleConfig.role;
      } else if (roleConfig.role && roleConfig.role.name) {
          roleNameToLoad = roleConfig.role.name;
      }
      const contract = loadContract(roleNameToLoad);
      roleVersion = contract.version;
  } catch(e) {
      // Enforce AC2: Invalid contract = Hub refuses to mint tokens
      throw new Error(`Cannot mint token: ${e.message}`);
  }


  const token = {
    identity: roleConfig.identity || 'unknown',
    role: {
      name: roleConfig.role?.name || 'default',
      class: roleConfig.role?.class || 'operational',
      authority_level: roleConfig.role?.authority_level || 1,
    },
    scope: {
      domain: roleConfig.scope?.domain || [],
      folder: roleConfig.scope?.folder || [],
      task: storyId ? [storyId] : (roleConfig.scope?.task || []),
      commands: roleConfig.scope?.commands || [],
      files: roleConfig.scope?.files || { frozen: [], excluded: [] },
      worktree: worktree || null,
    },
    capabilities: roleConfig.capabilities || [],
    duration: {
      ttl: roleConfig.duration?.ttl || 3600000, // default 1h
      expires_at: now + (roleConfig.duration?.ttl || 3600000),
      renewable: roleConfig.duration?.renewable || false,
      max_renewals: roleConfig.duration?.max_renewals || 0,
    },
    budget: roleConfig.budget || { max_cost_usd: 0, alert_at_usd: 0 },
    health: roleConfig.health || { retry_count: 0, max_retries: 3, revision_count: 0, max_revisions: 3, last_progress_at: new Date(now).toISOString() },
    issued_at: new Date(now).toISOString(),
    issued_by: roleConfig.issued_by || 'user:system',
    parent_token: roleConfig.parent_token || null,
    notes: (roleConfig.notes || '') + ` (Contract version: ${roleVersion})`
  };

  db.prepare(`
    INSERT INTO hub_tokens (
      token_id, issued_at, expires_at, issued_by, role_name, role_class, authority_level,
      story_id, worktree, capabilities, scope, budget, health, state, parent_token, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `).run(
    tokenId,
    token.issued_at,
    new Date(token.duration.expires_at).toISOString(),
    token.issued_by,
    token.role.name,
    token.role.class,
    token.role.authority_level,
    storyId || null,
    token.scope.worktree,
    JSON.stringify(token.capabilities),
    JSON.stringify(token.scope),
    JSON.stringify(token.budget),
    JSON.stringify(token.health),
    token.parent_token,
    token.notes
  );

  logEvent(db, tokenId, 'token:minted', null, true, 'Token minted');

  return { token_id: tokenId, ...token };
}

/**
 * Checks if a token is valid for a given action.
 * @param {string} tokenId
 * @param {Object} action { type: 'shell' | 'fs_write' | 'git:commit', path?: string, command?: string }
 * @returns {Object} { allowed: boolean, reason: string }
 */
export function check(tokenId, action) {
  const db = getDb();

  const tokenRow = db.prepare('SELECT * FROM hub_tokens WHERE token_id = ?').get(tokenId);

  let allowed = false;
  let reason = '';
  let eventType = 'token:checked';

  if (!tokenRow) {
    reason = 'Token not found';
    logEvent(db, tokenId, eventType, action, false, reason);
    return { allowed: false, reason };
  }

  if (tokenRow.state !== 'ACTIVE') {
    reason = `Token is ${tokenRow.state}`;
    logEvent(db, tokenId, eventType, action, false, reason);
    return { allowed: false, reason };
  }

  const expiresAtMs = new Date(tokenRow.expires_at).getTime();
  if (Date.now() > expiresAtMs) {
    reason = 'expired';
    eventType = 'token:expired';
    logEvent(db, tokenId, eventType, action, false, reason);
    return { allowed: false, reason };
  }

  const capabilities = JSON.parse(tokenRow.capabilities);
  if (!capabilities.includes(action.type)) {
    reason = 'Capability not allowed';
    logEvent(db, tokenId, eventType, action, false, reason);
    return { allowed: false, reason };
  }

  const scope = JSON.parse(tokenRow.scope);

  // Folder scope check
  if (action.path && scope.folder && scope.folder.length > 0) {
    let pathAllowed = false;
    for (const pattern of scope.folder) {
      // Basic prefix/glob check for path
      if (pattern === '*' || action.path.startsWith(pattern.replace(/\*$/, ''))) {
        pathAllowed = true;
        break;
      }
    }
    if (!pathAllowed) {
      reason = 'Path out of scope';
      logEvent(db, tokenId, eventType, action, false, reason);
      return { allowed: false, reason };
    }
  } else if (action.path) {
      // No folder scope given = strict deny
      reason = 'Path out of scope';
      logEvent(db, tokenId, eventType, action, false, reason);
      return { allowed: false, reason };
  }

  // Command scope check
  if (action.command && scope.commands && scope.commands.length > 0) {
    let cmdAllowed = false;
    for (const pattern of scope.commands) {
      // Basic prefix/glob check for command
      if (pattern === '*' || action.command.startsWith(pattern.replace(/\*$/, ''))) {
        cmdAllowed = true;
        break;
      }
    }
    if (!cmdAllowed) {
      reason = 'Command out of scope';
      logEvent(db, tokenId, eventType, action, false, reason);
      return { allowed: false, reason };
    }
  } else if (action.command) {
      reason = 'Command out of scope';
      logEvent(db, tokenId, eventType, action, false, reason);
      return { allowed: false, reason };
  }

  allowed = true;
  reason = 'ok';
  logEvent(db, tokenId, eventType, action, allowed, reason);

  return { allowed, reason };
}

/**
 * Revokes a token.
 * @param {string} tokenId
 * @param {string} reason
 */
export function revoke(tokenId, reason = 'Revoked by system') {
  const db = getDb();
  db.prepare('UPDATE hub_tokens SET state = ? WHERE token_id = ?').run('REVOKED', tokenId);
  logEvent(db, tokenId, 'token:revoked', null, false, reason);
  writeWitnessLog(`token:revoked - Token ${tokenId} revoked. Reason: ${reason}`);
  // Optional: In a full event-bus system, emit `token:revoked` here.
}

/**
 * Retires a token.
 * @param {string} tokenId
 * @param {string} reason
 */
export function retire(tokenId, reason = 'Retired normally') {
  const db = getDb();
  db.prepare('UPDATE hub_tokens SET state = ? WHERE token_id = ?').run('RETIRED', tokenId);
  logEvent(db, tokenId, 'token:retired', null, true, reason);
}

/**
 * Gets a token by ID.
 * @param {string} tokenId
 * @returns {Object}
 */
export function getToken(tokenId) {
  const db = getDb();
  return db.prepare('SELECT * FROM hub_tokens WHERE token_id = ?').get(tokenId);
}

/**
 * Lists all active tokens.
 * @returns {Array}
 */
export function listActiveTokens() {
  const db = getDb();
  return db.prepare('SELECT * FROM hub_tokens WHERE state = ?').all('ACTIVE');
}

export function enqueue(storyId, phase, roleRequired, priority = 5) {
  const db = getDb();
  const queueId = `queue-${randomUUID()}`;
  db.prepare(`
    INSERT INTO hub_queue (queue_id, story_id, phase, role_required, priority, enqueued_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(queueId, storyId, phase, roleRequired, priority, new Date().toISOString());
}

export function claimNext(roleClass, roleName, claimingTokenId = 'system') {
  const db = getDb();

  // Start transaction
  const transaction = db.transaction(() => {
    // Select the next available task for this role
    const item = db.prepare(`
      SELECT * FROM hub_queue
      WHERE state = 'PENDING'
      AND (role_required = ? OR role_required = ?)
      ORDER BY priority DESC, enqueued_at ASC
      LIMIT 1
    `).get(roleName, roleClass);

    if (!item) return null;

    db.prepare(`
      UPDATE hub_queue
      SET state = 'CLAIMED', claimed_at = ?, claimed_by = ?
      WHERE queue_id = ? AND state = 'PENDING'
    `).run(new Date().toISOString(), claimingTokenId, item.queue_id);

    return db.prepare('SELECT * FROM hub_queue WHERE queue_id = ?').get(item.queue_id);
  });

  return transaction();
}

export function getQueue(roleClass, roleName) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM hub_queue
    WHERE state = 'PENDING'
    AND (role_required = ? OR role_required = ?)
    ORDER BY priority DESC, enqueued_at ASC
  `).all(roleName, roleClass);
}

export function storyState(storyId) {
  const db = getDb();
  return db.prepare('SELECT * FROM hub_story_state WHERE story_id = ?').get(storyId);
}

export function readLogEvidence(logPath, parser) {
  try {
    const content = readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const tailLines = lines.slice(-50).join('\n');
    let parsed = {};

    if (parser === 'playwright' || parser === 'pytest') {
      const match = content.match(/(\d+)\s+passed/);
      const failMatch = content.match(/(\d+)\s+failed/);
      const skipMatch = content.match(/(\d+)\s+skipped/);

      parsed = {
        passed: match ? parseInt(match[1], 10) : 0,
        failed: failMatch ? parseInt(failMatch[1], 10) : 0,
        skipped: skipMatch ? parseInt(skipMatch[1], 10) : 0
      };
    } else if (parser === 'jest') {
      const match = content.match(/Tests:\s*(\d+)\s*failed/);
      const passMatch = content.match(/Tests:\s*(\d+)\s*passed/);
      parsed = {
        failed: match ? parseInt(match[1], 10) : 0,
        passed: passMatch ? parseInt(passMatch[1], 10) : 0
      };
    } else if (parser === 'reviewer') {
      if (content.includes('APPROVED')) parsed.verdict = 'APPROVED';
      else if (content.includes('BLOCKED')) parsed.verdict = 'BLOCKED';
      else if (content.includes('REQUEST_CHANGES')) parsed.verdict = 'REQUEST_CHANGES';
    }

    return { parsed, raw_tail: tailLines };
  } catch (e) {
    return { parsed: null, raw_tail: '' };
  }
}

export function advanceLoop(storyId, evidence, tokenId = 'system') {
  const db = getDb();
  let state = db.prepare('SELECT * FROM hub_story_state WHERE story_id = ?').get(storyId);

  if (!state) {
    db.prepare(`
      INSERT INTO hub_story_state (story_id, phase, entered_phase, advanced_by)
      VALUES (?, 'BACKLOG', ?, ?)
    `).run(storyId, new Date().toISOString(), tokenId);
    state = db.prepare('SELECT * FROM hub_story_state WHERE story_id = ?').get(storyId);
  }

  const token = db.prepare('SELECT * FROM hub_tokens WHERE token_id = ?').get(tokenId) || {};
  let health = {};
  if (token.health) {
      try { health = JSON.parse(token.health); } catch(e) {}
  }
  const maxRevisions = health.max_revisions || 3;

  let nextPhase = state.phase;
  let valid = false;
  let mismatch = false;
  let mismatchDetails = '';
  let logRef = null;

  if (state.phase === 'BACKLOG' && evidence.start) {
    valid = true;
    nextPhase = 'PLANNING';
  } else if (state.phase === 'PLANNING') {
    if (evidence.acs_defined && evidence.story_number) {
      valid = true;
      nextPhase = 'IMPLEMENTING';
    }
  } else if (state.phase === 'IMPLEMENTING') {
    if (evidence.pr_number && evidence.branch) {
      valid = true;
      nextPhase = 'REVIEWING';
    }
  } else if (state.phase === 'REVIEWING') {
    if (evidence.log_source) {
      logRef = evidence.log_source;
      const readResult = readLogEvidence(evidence.log_source, 'reviewer');
      if (readResult.parsed && readResult.parsed.verdict === 'APPROVED') {
        valid = true;
        nextPhase = 'TESTING';
      } else {
        mismatch = true;
        mismatchDetails = `Review not approved. Found verdict: ${readResult.parsed?.verdict || 'none'}`;
      }
      if (readResult.raw_tail) {
        mismatchDetails += `\nRaw Tail:\n${readResult.raw_tail}`;
      }
    }
  } else if (state.phase === 'TESTING') {
    if (evidence.log_path && evidence.test_runner) {
      logRef = evidence.log_path;
      const readResult = readLogEvidence(evidence.log_path, evidence.test_runner);
      if (readResult.parsed) {
        if (evidence.parsed_results && readResult.parsed.failed !== evidence.parsed_results.failed) {
          mismatch = true;
          mismatchDetails = `Evidence mismatch: Agent claimed ${evidence.parsed_results.failed} failed, but log shows ${readResult.parsed.failed} failed.`;
        } else if (readResult.parsed.failed === 0) {
          valid = true;
          nextPhase = 'ACCEPTING';
        } else {
          mismatch = true;
          mismatchDetails = `Tests failed. Found ${readResult.parsed.failed} failed tests in log.`;
        }
      } else {
        mismatch = true;
        mismatchDetails = `Failed to parse logs from ${evidence.log_path}`;
      }
      if (readResult.raw_tail && mismatch) {
        mismatchDetails += `\nRaw Tail:\n${readResult.raw_tail}`;
      }
    }
  } else if (state.phase === 'ACCEPTING') {
    if (evidence.method === 'user_approval' && evidence.accepted_by) {
      valid = true;
      nextPhase = 'VERIFIED';
    } else if (evidence.method === 'behavioral_test' && evidence.log_path) {
      logRef = evidence.log_path;
      const readResult = readLogEvidence(evidence.log_path, 'playwright');
      if (readResult.parsed && readResult.parsed.failed === 0) {
        valid = true;
        nextPhase = 'VERIFIED';
      } else {
        mismatch = true;
        mismatchDetails = 'Behavioral tests failed.';
      }
      if (readResult.raw_tail && mismatch) {
        mismatchDetails += `\nRaw Tail:\n${readResult.raw_tail}`;
      }
    }
  }

  const artifacts = state.evidence_artifacts ? JSON.parse(state.evidence_artifacts) : [];
  if (logRef) {
    artifacts.push(logRef);
  }

  if (valid) {
    // Phase advanced
    db.prepare(`
      UPDATE hub_story_state
      SET phase = ?, entered_phase = ?, loop_iteration = 0, last_advanced = ?, advanced_by = ?, evidence_artifacts = ?
      WHERE story_id = ?
    `).run(nextPhase, new Date().toISOString(), new Date().toISOString(), tokenId, JSON.stringify(artifacts), storyId);

    logEvent(db, tokenId, 'story:phase_advanced', { story_id: storyId, from: state.phase, to: nextPhase }, true, 'Phase advanced via verified evidence', logRef);

    // Auto enqueue based on phase
    const rolesMap = {
      'PLANNING': 'planner',
      'IMPLEMENTING': 'coder',
      'REVIEWING': 'reviewer',
      'TESTING': 'coder',
      'ACCEPTING': 'sentinel',
      'VERIFIED': null
    };

    if (rolesMap[nextPhase]) {
        enqueue(storyId, nextPhase, rolesMap[nextPhase]);
    }

  } else {
    // Rejection or failure to advance
    const newIteration = state.loop_iteration + 1;
    if (newIteration > maxRevisions) {
      db.prepare(`
        UPDATE hub_story_state SET phase = 'BLOCKED', loop_iteration = ?, blocking_reason = ? WHERE story_id = ?
      `).run(newIteration, 'Revision limit exceeded', storyId);

      logEvent(db, tokenId, 'story:revision_limit_exceeded', { story_id: storyId }, false, mismatchDetails || 'Revision limit exceeded', logRef);
    } else {
      db.prepare(`
        UPDATE hub_story_state SET loop_iteration = ? WHERE story_id = ?
      `).run(newIteration, storyId);

      const eventType = mismatch ? 'story:evidence_mismatch' : 'story:re_enqueued';
      logEvent(db, tokenId, eventType, { story_id: storyId }, false, mismatchDetails || 'Evidence insufficient, incremented loop_iteration', logRef);

      // Re-enqueue for current phase
      const rolesMap = {
        'PLANNING': 'planner',
        'IMPLEMENTING': 'coder',
        'REVIEWING': 'reviewer',
        'TESTING': 'coder',
        'ACCEPTING': 'sentinel'
      };
      if (rolesMap[state.phase]) {
          enqueue(storyId, state.phase, rolesMap[state.phase]);
      }
    }
  }

  return db.prepare('SELECT * FROM hub_story_state WHERE story_id = ?').get(storyId);
}

// Internal helper
function logEvent(db, tokenId, eventType, action, allowed, reason, resultNote = null) {
  let resultStr = allowed ? `allowed|${reason}` : `denied|${reason}`;
  if (resultNote) {
    resultStr = `${resultStr}|${resultNote}`;
  }

  let notesStr = '';
  if (resultNote && eventType.startsWith('story:')) {
    const notesObj = { log_path: resultNote };
    if (!allowed && reason) notesObj.reason = reason;
    notesStr = JSON.stringify(notesObj);
  } else if (!allowed && reason) {
    notesStr = reason;
  }

  db.prepare(`
    INSERT INTO hub_events (event_id, timestamp, token_id, event_type, action, result, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `event-${randomUUID()}`,
    new Date().toISOString(),
    tokenId,
    eventType,
    action ? JSON.stringify(action) : null,
    resultStr,
    notesStr
  );
}
/**
 * Loads and validates a role contract.
 * @param {string} roleName
 * @returns {Object}
 */
export function loadContract(roleName) {
  if (!fs.existsSync(ROLES_DIR)) {
    fs.mkdirSync(ROLES_DIR, { recursive: true });
    if (fs.existsSync(DEFAULTS_DIR)) {
      const files = fs.readdirSync(DEFAULTS_DIR);
      for (const file of files) {
        if (file.endsWith('.yaml')) {
          fs.copyFileSync(path.join(DEFAULTS_DIR, file), path.join(ROLES_DIR, file));
        }
      }
    }
  }

  const contractPath = path.join(ROLES_DIR, `${roleName}.yaml`);
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract for role '${roleName}' not found.`);
  }

  const content = fs.readFileSync(contractPath, 'utf8');
  let parsed;
  try {
    parsed = yaml.load(content);
  } catch (e) {
    throw new Error(`Invalid YAML in contract '${roleName}': ${e.message}`);
  }

  const result = RoleContractSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Contract '${roleName}' failed schema validation: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Gets the natural language behavioral directive for a role.
 * @param {string} roleName
 * @returns {string}
 */
export function getContractDirective(roleName) {
  const contract = loadContract(roleName);
  return contract.contract;
}

// Initialize watcher at the module level but make it safe for tests
if (process.env.NODE_ENV !== 'test') {
  if (fs.existsSync(DEFAULTS_DIR)) {
    const defaultRoles = ['architect', 'product-owner', 'designer', 'researcher', 'coder', 'tester', 'git-manager', 'deploy', 'reviewer', 'sentinel', 'compliance', 'classifier', 'loop-operator', 'meta-agent'];
    for (const role of defaultRoles) {
      try {
        loadContract(role);
      } catch (e) {
        console.error(`Startup validation failed for ${role}: ${e.message}`);
      }
    }
  }

  fs.watch(ROLES_DIR, (eventType, filename) => {
    if (filename && filename.endsWith('.yaml')) {
      const roleName = path.basename(filename, '.yaml');
      try {
        loadContract(roleName);
      } catch (e) {
        console.error(`Validation failed on change for ${roleName}: ${e.message}`);
      }
    }
  });
}
