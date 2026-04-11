import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { getDb } from './db.mjs';
import {
  enqueue,
  claimNext,
  getQueue,
  storyState,
  advanceLoop,
  readLogEvidence,
  mint
} from './hub.mjs';
import { writeFileSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

describe('Hub Loop Controller', () => {
  let db;

  before(() => {
    db = getDb();
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
    db.prepare('DELETE FROM hub_story_state').run();
    db.prepare('DELETE FROM hub_queue').run();
  });

  after(() => {
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
    db.prepare('DELETE FROM hub_story_state').run();
    db.prepare('DELETE FROM hub_queue').run();
  });

  test('advanceLoop: BACKLOG -> PLANNING', () => {
    const storyId = 'story-1';
    let state = advanceLoop(storyId, { start: true });
    assert.strictEqual(state.phase, 'PLANNING');
    assert.strictEqual(state.loop_iteration, 0);

    const q = getQueue('planner', 'planner');
    assert.ok(q.some(i => i.story_id === storyId && i.phase === 'PLANNING'));
  });

  test('advanceLoop: PLANNING -> IMPLEMENTING', () => {
    const storyId = 'story-1';
    let state = advanceLoop(storyId, { acs_defined: true, story_number: 1 });
    assert.strictEqual(state.phase, 'IMPLEMENTING');
  });

  test('claimNext ensures atomic claim', () => {
    // Clear the queue completely to avoid leftovers from previous tests (auto-enqueue)
    getDb().prepare('DELETE FROM hub_queue').run();

    const storyId = 'story-atomic';
    enqueue(storyId, 'IMPLEMENTING', 'coder');

    const item1 = claimNext('operational', 'coder', 'token-1');
    assert.ok(item1);
    assert.strictEqual(item1.story_id, storyId);
    assert.strictEqual(item1.state, 'CLAIMED');

    const item2 = claimNext('operational', 'coder', 'token-2');
    // Ensure that it does not claim the already claimed one.
    assert.ok(!item2 || item2.queue_id !== item1.queue_id);
  });

  test('readLogEvidence parses correctly', () => {
    const pwLog = 'test-pw.log';
    writeFileSync(pwLog, 'Some setup...\n2 passed\n0 failed\n1 skipped\n');
    const pwRes = readLogEvidence(pwLog, 'playwright');
    assert.deepStrictEqual(pwRes.parsed, { passed: 2, failed: 0, skipped: 1 });

    const jestLog = 'test-jest.log';
    writeFileSync(jestLog, 'Running tests...\nTests: 3 passed, 0 failed, 3 total\n');
    const jestRes = readLogEvidence(jestLog, 'jest');
    assert.deepStrictEqual(jestRes.parsed, { passed: 3, failed: 0 });

    const revLog = 'test-rev.log';
    writeFileSync(revLog, 'Looks good.\nVerdict: APPROVED\n');
    const revRes = readLogEvidence(revLog, 'reviewer');
    assert.strictEqual(revRes.parsed.verdict, 'APPROVED');

    unlinkSync(pwLog);
    unlinkSync(jestLog);
    unlinkSync(revLog);
  });

  test('advanceLoop: REVIEWING with mismatch increments loop', () => {
    const storyId = 'story-2';
    advanceLoop(storyId, { start: true }); // BACKLOG -> PLANNING
    advanceLoop(storyId, { acs_defined: true, story_number: 2 }); // PLANNING -> IMPLEMENTING
    advanceLoop(storyId, { pr_number: 10, branch: 'feat' }); // IMPLEMENTING -> REVIEWING

    let state = storyState(storyId);
    assert.strictEqual(state.phase, 'REVIEWING');

    const revLog = 'test-rev2.log';
    writeFileSync(revLog, 'Verdict: REQUEST_CHANGES\n');

    advanceLoop(storyId, { log_source: revLog });

    state = storyState(storyId);
    assert.strictEqual(state.phase, 'REVIEWING');
    assert.strictEqual(state.loop_iteration, 1);

    unlinkSync(revLog);
  });

  test('advanceLoop: TESTing with pass advances to ACCEPTING and stores artifact', () => {
    const storyId = 'story-test';
    // skip to TESTING
    db.prepare("INSERT INTO hub_story_state (story_id, phase, entered_phase) VALUES (?, 'TESTING', ?)").run(storyId, new Date().toISOString());

    const pwLog = 'test-pw2.log';
    writeFileSync(pwLog, '4 passed\n0 failed\n');

    let state = advanceLoop(storyId, { test_runner: 'playwright', log_path: pwLog });
    assert.strictEqual(state.phase, 'ACCEPTING');

    const artifacts = JSON.parse(state.evidence_artifacts);
    assert.ok(artifacts.includes(pwLog));

    const event = db.prepare('SELECT * FROM hub_events WHERE event_type = ? ORDER BY timestamp DESC LIMIT 1').get('story:phase_advanced');
    assert.ok(event);
    assert.ok(event.notes.includes(pwLog));

    unlinkSync(pwLog);
  });

  test('advanceLoop: revision limit halts', () => {
    const storyId = 'story-limit';
    db.prepare("INSERT INTO hub_story_state (story_id, phase, entered_phase, loop_iteration) VALUES (?, 'TESTING', ?, 3)").run(storyId, new Date().toISOString());

    // We mock health limit via mint or db insert
    const token = mint({
      role: { name: 'coder' },
      health: { max_revisions: 3 }
    }, storyId);

    const logPath = 'test-limit.log';
    writeFileSync(logPath, '1 passed\n1 failed\n'); // fail

    let state = advanceLoop(storyId, { test_runner: 'playwright', log_path: logPath }, token.token_id);
    assert.strictEqual(state.phase, 'BLOCKED');
    assert.strictEqual(state.blocking_reason, 'Revision limit exceeded');

    unlinkSync(logPath);
  });
});

  test('advanceLoop: TESTing evidence mismatch sets mismatch flag', () => {
    const storyId = 'story-mismatch';
    getDb().prepare("INSERT INTO hub_story_state (story_id, phase, entered_phase) VALUES (?, 'TESTING', ?)").run(storyId, new Date().toISOString());

    const pwLog = 'test-pw3.log';
    writeFileSync(pwLog, '1 passed\n1 failed\n');

    advanceLoop(storyId, {
      test_runner: 'playwright',
      log_path: pwLog,
      parsed_results: { passed: 2, failed: 0 } // Lying agent!
    });

    const event = getDb().prepare("SELECT * FROM hub_events WHERE event_type = 'story:evidence_mismatch' AND action LIKE ? ORDER BY timestamp DESC LIMIT 1")
      .get(`%${storyId}%`);
    assert.ok(event, "Should write evidence_mismatch event");
    assert.ok(event.notes.includes('mismatch'), "Notes should contain mismatch details");

    unlinkSync(pwLog);
  });
