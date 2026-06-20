import type { Database } from 'libsql';
import type { TestRunRecord } from '../state-ledger';

export function upsertTestRun(db: Database, data: Omit<TestRunRecord, 'id' | 'run_at'>): number {
  const info = db.prepare(`
    INSERT INTO test_runs (total_tests, passed, failed, skipped, coverage_pct, duration_ms)
    VALUES (@total_tests, @passed, @failed, @skipped, @coverage_pct, @duration_ms)
  `).run(data);
  return info.lastInsertRowid as number;
}

export function getTestRunHistory(db: Database, limit = 20): TestRunRecord[] {
  return db.prepare('SELECT * FROM test_runs ORDER BY run_at DESC LIMIT ?').all(limit) as TestRunRecord[];
}
