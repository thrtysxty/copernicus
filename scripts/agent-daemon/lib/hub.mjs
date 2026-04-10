import { randomUUID } from 'crypto';
import { getDb } from './db.mjs';

/**
 * Mints a new token based on role config, story ID, and worktree.
 * @param {Object} roleConfig
 * @param {string} storyId
 * @param {string} worktree
 * @returns {Object} token object
 */
export function mint(roleConfig, storyId, worktree) {
  const db = getDb();
  const tokenId = `token-${randomUUID()}`;
  const now = Date.now();

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
    notes: roleConfig.notes || ''
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

// Internal helper
function logEvent(db, tokenId, eventType, action, allowed, reason) {
  db.prepare(`
    INSERT INTO hub_events (event_id, timestamp, token_id, event_type, action, result, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `event-${randomUUID()}`,
    new Date().toISOString(),
    tokenId,
    eventType,
    action ? JSON.stringify(action) : null,
    allowed ? `allowed|${reason}` : `denied|${reason}`,
    ''
  );
}
