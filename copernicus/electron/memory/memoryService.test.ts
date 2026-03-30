import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { memoryService } from './memoryService';
import { stateLedger } from '../db/state-ledger';

// stateLedger initializes on import, but normally creates file based db.
// Let's manually trigger init using an in-memory db instead.

describe('MemoryService TDD', () => {

  beforeAll(() => {
    // Override the DB instance directly for tests
    stateLedger.db = new (require('better-sqlite3'))(':memory:');
    (stateLedger as any).init();
  });

  afterAll(() => {
    stateLedger.close();
  });

  test('tables and view are created after initialization', () => {
    const memTable = stateLedger.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_memory'").get();
    expect(memTable).toBeDefined();

    const logTable = stateLedger.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_work_log'").get();
    expect(logTable).toBeDefined();

    const view = stateLedger.db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='memory_working_set'").get();
    expect(view).toBeDefined();
  });

  test('score formula uses importance and time decay', async () => {
    // Add two memories with the same importance, one older than the other
    stateLedger.db.prepare(`
      INSERT INTO agent_memory (id, project_id, bank_id, event_type, content, importance, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('recent_mem', 'p1', 'b1', 'fact', 'recent', 10, Math.floor(Date.now() / 1000));

    stateLedger.db.prepare(`
      INSERT INTO agent_memory (id, project_id, bank_id, event_type, content, importance, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('old_mem', 'p1', 'b1', 'fact', 'old', 10, Math.floor(Date.now() / 1000) - 3600); // 1 hour ago

    const workingSet = await memoryService.getWorkingSet('p1', 'b1', 10);
    
    expect(workingSet.length).toBe(2);
    
    // The recent memory should have a higher score.
    // Score for recent should be 10.0 (since unixepoch - ts is ~0)
    // Score for old should be ~9.09 (since unixepoch - ts is 3600)
    const recent = workingSet.find(m => m.id === 'recent_mem');
    const old = workingSet.find(m => m.id === 'old_mem');

    expect(recent?.score).toBeGreaterThan(9.9);
    expect(old?.score).toBeLessThan(9.5);
    expect(old?.score).toBeGreaterThan(9.0);
    expect(recent?.score).toBeGreaterThan(old?.score as number);
  });

  test('writing without activeProjectId fails', async () => {
    memoryService.setActiveProject('');

    const id = await memoryService.addMemory({
      projectId: 'p3', // should be ignored
      bankId: 'b3',
      eventType: 'fact',
      content: 'this should fail',
      importance: 5
    });

    expect(id).toBe('');

    const logId = await memoryService.logWork({
      projectId: 'p3',
      bankId: 'b3',
      eventType: 'work',
      meta: {}
    });

    expect(logId).toBe('');
  });

  test('supersede(oldId, newId) sets old row importance = 1', async () => {
    memoryService.setActiveProject('p2');
    const p2AbsPath = memoryService.activeProjectId; // get absolute path

    const oldId = await memoryService.addMemory({
      projectId: 'p2',
      bankId: 'b2',
      eventType: 'fact',
      content: 'old fact',
      importance: 8
    });

    const newId = await memoryService.addMemory({
      projectId: 'p2',
      bankId: 'b2',
      eventType: 'fact',
      content: 'new fact',
      importance: 8
    });

    await memoryService.supersede(oldId, newId);

    const workingSet = await memoryService.getWorkingSet(p2AbsPath, 'b2');
    const oldRow = workingSet.find(m => m.id === oldId);
    
    expect(oldRow).toBeDefined();
    expect(oldRow?.importance).toBe(1);
    expect(oldRow?.supersedesId).toBe(newId);
  });

  test('Migration: project_memory rows present in agent_memory after restart', () => {
    // Note: StateLedger is already imported, we'll instantiate it directly.
    // Use an uninitialized StateLedger to mock an app restart
    const MockDb = require('better-sqlite3');
    const mockDb = new MockDb(':memory:');
    
    // Create the old schema manually, without running new schema setup
    mockDb.exec(`
      CREATE TABLE IF NOT EXISTS project_memory (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 3,
        source TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_accessed INTEGER
      );
    `);
    
    // Add old data to project_memory table
    mockDb.prepare(`
      INSERT INTO project_memory (id, content, importance, source, created_at, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('pm1', 'old content', 7, 'manual', Date.now(), Date.now());

    // We can just set stateLedger db to this one and run init() to simulate restart
    const oldDb = stateLedger.db;
    stateLedger.db = mockDb;
    
    // Running init will create the new tables and migrate
    (stateLedger as any).init();
    
    const migrated = stateLedger.db.prepare(`
      SELECT * FROM agent_memory WHERE bank_id = 'chat' AND event_type = 'memory_fact'
    `).all() as any[];

    expect(migrated.length).toBe(1);
    expect(migrated[0].content).toBe('old content');
    expect(migrated[0].importance).toBe(7);
    
    stateLedger.db.close();
    stateLedger.db = oldDb;
  });
});
