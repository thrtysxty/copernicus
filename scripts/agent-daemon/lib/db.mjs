import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

const DB_DIR = join(homedir(), 'Library', 'Application Support', 'copernicus');
const DB_PATH = join(DB_DIR, 'jules.db');

export function getDb() {
  mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // init tables if not exist (similar to agent_monitor.py init_db)
  db.exec(`
    CREATE TABLE IF NOT EXISTS hub_tokens (
      token_id     TEXT PRIMARY KEY,
      issued_at    TEXT NOT NULL,
      expires_at   TEXT NOT NULL,
      issued_by    TEXT NOT NULL,
      role_name    TEXT NOT NULL,
      role_class   TEXT NOT NULL,
      authority_level INTEGER NOT NULL,
      story_id     TEXT,
      worktree     TEXT,
      capabilities TEXT NOT NULL,
      scope        TEXT NOT NULL,
      budget       TEXT NOT NULL,
      health       TEXT NOT NULL,
      state        TEXT NOT NULL DEFAULT 'ACTIVE',
      parent_token TEXT,
      notes        TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS hub_events (
      event_id   TEXT PRIMARY KEY,
      timestamp  TEXT NOT NULL,
      token_id   TEXT NOT NULL,
      event_type TEXT NOT NULL,
      action     TEXT,
      result     TEXT,
      notes      TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS jules_sessions (
        session_id    TEXT PRIMARY KEY,
        story         INTEGER,
        title         TEXT,
        state         TEXT DEFAULT 'QUEUED',
        pr_url        TEXT,
        pr_number     INTEGER,
        commit_sha    TEXT,
        branch        TEXT,
        dispatched    TEXT,
        plan_approved TEXT,
        pr_opened     TEXT,
        merged        TEXT,
        updated       TEXT,
        review_state  TEXT,
        review_verdict TEXT,
        reviewer      TEXT,
        reviewed      TEXT,
        agent         TEXT DEFAULT 'jules'
    )
  `);

  try {
    db.exec("ALTER TABLE jules_sessions ADD COLUMN agent TEXT DEFAULT 'jules'");
    db.exec("UPDATE jules_sessions SET agent = 'jules' WHERE agent IS NULL");
  } catch (e) {
    // Column might already exist
  }

  try {
    db.exec("ALTER TABLE jules_sessions ADD COLUMN quality_score REAL DEFAULT NULL");
  } catch (e) {
    // Column might already exist
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS improvement_runs (
      run_id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      role TEXT NOT NULL,
      episodes_analyzed INTEGER,
      change_proposed TEXT,
      score_before REAL,
      score_after REAL,
      kept INTEGER DEFAULT 0,
      notes TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes (
        episode_id     TEXT PRIMARY KEY,
        timestamp      TEXT NOT NULL,
        story_id       TEXT,
        agent          TEXT NOT NULL DEFAULT 'jules',
        task           TEXT NOT NULL DEFAULT '',
        approach       TEXT NOT NULL DEFAULT '',
        outcome        TEXT NOT NULL DEFAULT '',
        duration_ms    INTEGER DEFAULT 0,
        quality_score  REAL NOT NULL DEFAULT 0.0,
        revision_count INTEGER NOT NULL DEFAULT 0,
        blocked_reasons TEXT NOT NULL DEFAULT '[]',
        files_touched  TEXT NOT NULL DEFAULT '[]',
        memory_ids     TEXT NOT NULL DEFAULT '[]',
        notes          TEXT NOT NULL DEFAULT '',
        commit_sha     TEXT DEFAULT NULL,
        embedding_id   TEXT DEFAULT NULL
    )
  `);

  return db;
}

export function getActiveSessions(db) {
  return db.prepare(`
    SELECT * FROM jules_sessions
    WHERE merged IS NULL
      AND state NOT IN ('FAILED', 'CANCELLED')
    ORDER BY dispatched
  `).all();
}

export function updateSessionState(db, sessionId, state, planApproved = null) {
  const updated = new Date().toISOString();
  if (planApproved) {
    db.prepare('UPDATE jules_sessions SET state=?, plan_approved=?, updated=? WHERE session_id=?')
      .run(state, updated, updated, sessionId);
  } else {
    db.prepare('UPDATE jules_sessions SET state=?, updated=? WHERE session_id=?')
      .run(state, updated, sessionId);
  }
}

export function updateSessionPr(db, sessionId, state, prUrl, prNumber) {
  const updated = new Date().toISOString();
  db.prepare('UPDATE jules_sessions SET state=?, pr_url=?, pr_number=?, pr_opened=?, updated=? WHERE session_id=?')
    .run(state, prUrl, prNumber, updated, updated, sessionId);
}

export function updateSessionReview(db, sessionId, reviewVerdict) {
  const updated = new Date().toISOString();
  db.prepare('UPDATE jules_sessions SET review_state=?, review_verdict=?, reviewer=?, reviewed=?, updated=? WHERE session_id=?')
    .run(reviewVerdict.verdict, JSON.stringify(reviewVerdict), reviewVerdict.reviewer_model, reviewVerdict.reviewed_at, updated, sessionId);
}

export function updateSessionMerged(db, sessionId, mergeSha) {
  const updated = new Date().toISOString();
  db.prepare('UPDATE jules_sessions SET merged=?, commit_sha=?, updated=? WHERE session_id=?')
    .run(updated, mergeSha, updated, sessionId);
}

const REPO_ROOT = new URL('../../..', import.meta.url).pathname;

export function getStoryPath(storyId) {
  try {
    const activeDir = join(REPO_ROOT, 'docs/stories');
    const activeFiles = readdirSync(activeDir);
    const activeMatch = activeFiles.find(f => f.startsWith(`story_${storyId}_`) && f.endsWith('.md'));
    if (activeMatch) return `docs/stories/${activeMatch}`;

    const completedDir = join(activeDir, 'completed');
    const completedFiles = readdirSync(completedDir);
    const completedMatch = completedFiles.find(f => f.startsWith(`story_${storyId}_`) && f.endsWith('.md'));
    if (completedMatch) return `docs/stories/completed/${completedMatch}`;

  } catch (e) {
    console.error(`Failed to get story path for ${storyId}:`, e.message);
  }
  return null;
}

export function writeVerificationRecord(storyPath, verdict) {
  try {
    let content = readFileSync(storyPath, 'utf8');
    let lines = content.split('\n');
    let outputLines = [];
    let statusFound = false;
    let i = 0;

    while (i < lines.length) {
      if (lines[i].trim() === '## Verification Record') {
        i++;
        while (i < lines.length && !lines[i].startsWith('## ')) {
          i++;
        }
        continue;
      }

      if (!statusFound && lines[i].startsWith('**Status:**')) {
        outputLines.push('**Status:** COMPLETE');
        statusFound = true;
      } else {
        outputLines.push(lines[i]);
      }
      i++;
    }

    const acsMet = verdict.acs_met?.map(ac => `- ${ac}`).join('\n') || '';
    const acsMissing = verdict.acs_missing?.length ? verdict.acs_missing.map(ac => `- ${ac}`).join('\n') : '_(none)_';

    const block = `

## Verification Record

**Reviewed:** ${verdict.reviewed_at}
**Reviewer:** ${verdict.reviewer_model}
**Verdict:** ${verdict.verdict}
**Merge SHA:** \`${verdict.merge_sha || 'unknown'}\` (full 40-char; \`git show <sha>\` to inspect)

### ACs Met
${acsMet}

### ACs Flagged
${acsMissing}

### Summary
${verdict.summary}
`;
    outputLines.push(block.trim() + '\n');

    // Write atomically
    const tmpPath = storyPath + '.tmp';
    writeFileSync(tmpPath, outputLines.join('\n'));
    execSync(`mv "${tmpPath}" "${storyPath}"`);
    console.log(`Verification record written to ${storyPath}`);
  } catch (e) {
    console.error(`Failed to write verification record to ${storyPath}:`, e.message);
  }
}

export function writeStatus(storyPath, newStatus) {
  try {
    let content = readFileSync(storyPath, 'utf8');
    let replaced = content.replace(/^\*\*Status:\*\*.*$/m, `**Status:** ${newStatus}`);
    if (replaced === content) {
      console.warn(`writeStatus: No **Status:** line found in ${storyPath}`);
      return false;
    }
    const tmpPath = storyPath + '.tmp';
    writeFileSync(tmpPath, replaced);
    execSync(`mv "${tmpPath}" "${storyPath}"`);
    console.log(`writeStatus: Updated ${storyPath} to ${newStatus}`);
    return true;
  } catch (e) {
    console.error(`writeStatus: Failed to update ${storyPath}:`, e.message);
    return false;
  }
}

export function writeEpisode(db, sessionId) {
  try {
    const row = db.prepare('SELECT * FROM jules_sessions WHERE session_id=?').get(sessionId);
    if (!row) return;

    const verdictData = row.review_verdict ? JSON.parse(row.review_verdict) : {};
    const revisionCount = row.revision_count || 0;
    const qsMap = { 0: 1.0, 1: 0.7, 2: 0.4 };

    // AC pass rate from review verdict + revision count + tsc clean
    let ac_pass_rate = 1.0;
    const acs_met_count = verdictData.acs_met?.length || 0;
    const acs_missing_count = verdictData.acs_missing?.length || 0;
    const total_acs = acs_met_count + acs_missing_count;
    if (total_acs > 0) {
      ac_pass_rate = acs_met_count / total_acs;
    }

    // Assume tsc_clean is 1 if APPROVED
    const tsc_clean = (verdictData.verdict === 'APPROVED' && acs_missing_count === 0) ? 1.0 : 0.0;

    // Score Formula: score = ac_pass_rate * 0.6 + (1 / (1 + revision_count)) * 0.3 + tsc_clean * 0.1
    let qualityScore = ac_pass_rate * 0.6 + (1 / (1 + revisionCount)) * 0.3 + tsc_clean * 0.1;

    const blockedReasons = verdictData.acs_missing || [];

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeId = `ep_${dateStr}_${sessionId.substring(0, 8)}`;

    // Also save quality_score to jules_sessions
    db.prepare('UPDATE jules_sessions SET quality_score=? WHERE session_id=?')
      .run(qualityScore, sessionId);

    db.prepare(`
      INSERT INTO episodes
        (episode_id, timestamp, story_id, agent, task, approach, outcome, quality_score, revision_count, blocked_reasons, files_touched, memory_ids, notes, commit_sha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?)
    `).run(
      episodeId,
      new Date().toISOString(),
      row.story?.toString() || '',
      row.agent || 'jules',
      row.title || '',
      row.agent || 'jules',
      verdictData.verdict || 'UNKNOWN',
      qualityScore,
      revisionCount,
      JSON.stringify(blockedReasons),
      verdictData.summary || '',
      row.commit_sha
    );
    console.log(`[episode] wrote ${episodeId} (quality=${qualityScore})`);
  } catch (e) {
    console.error(`[episode] failed to write episode for ${sessionId}:`, e.message);
  }
}

export function stampStoryId(storyId, startedAt, completedAt) {
  const copernicusDbPath = join(homedir(), 'Library', 'Application Support', 'COPERNICUS', 'copernicus.db');
  try {
    const cdb = new Database(copernicusDbPath);
    cdb.prepare('UPDATE agent_memory SET story_id = ? WHERE story_id IS NULL AND ts >= ? AND ts <= ?')
       .run(storyId, startedAt, completedAt);
    cdb.prepare('UPDATE agent_work_log SET story_id = ? WHERE story_id IS NULL AND ts >= ? AND ts <= ?')
       .run(storyId, startedAt, completedAt);
    cdb.close();
    console.log(`Stamped story_id=${storyId} on agent_memory/agent_work_log`);
  } catch (e) {
    console.warn(`stampStoryId failed (non-fatal):`, e.message);
  }
}

export function showStatus(db) {
  const rows = db.prepare('SELECT * FROM jules_sessions ORDER BY dispatched DESC LIMIT 50').all();
  if (!rows.length) {
    console.log("No sessions in db.");
    return;
  }

  console.log(
    'AGENT'.padEnd(8),
    'STORY'.padEnd(8),
    'STATE'.padEnd(22),
    'REVIEW'.padEnd(14),
    'PR'.padEnd(8),
    'SHA'.padEnd(10),
    'TITLE'
  );
  console.log('-'.repeat(99));

  for (const r of rows) {
    const sha = (r.commit_sha || '').substring(0, 8);
    const pr = r.pr_number ? `#${r.pr_number}` : '';
    let reviewState = r.review_state || '—';
    if (reviewState === 'REQUEST_CHANGES') reviewState = 'REQ_CHANGES';
    if (reviewState === 'BLOCKED' && r.state === 'COMPLETED') {
        const rowData = r.review_verdict ? JSON.parse(r.review_verdict) : {};
        if (rowData.reviewer_model === 'human') reviewState = 'BLOCKED (human review)';
    }

    let displayState = r.state || '';

    console.log(
      (r.agent || '—').padEnd(8),
      String(r.story || '').padEnd(8),
      displayState.padEnd(13),
      reviewState.padEnd(25),
      pr.padEnd(8),
      sha.padEnd(10),
      (r.title || '')
    );
  }
}

export function registerSession(db, sessionId, storyId, title, prompt) {
  const now = new Date().toISOString() + 'Z';
  db.prepare(`
    INSERT OR IGNORE INTO jules_sessions
      (session_id, story, title, state, dispatched, updated)
    VALUES (?, ?, ?, 'QUEUED', ?, ?)
  `).run(sessionId, storyId, title, now, now);
}

export function logImprovementRun(db, runId, role, episodesAnalyzed, changeProposed, scoreBefore, scoreAfter, kept, notes) {
  db.prepare(`
    INSERT INTO improvement_runs (run_id, timestamp, role, episodes_analyzed, change_proposed, score_before, score_after, kept, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    new Date().toISOString(),
    role,
    episodesAnalyzed,
    changeProposed,
    scoreBefore,
    scoreAfter,
    kept ? 1 : 0,
    notes
  );
}
