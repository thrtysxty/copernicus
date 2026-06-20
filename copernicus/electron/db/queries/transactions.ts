import type { Database } from 'libsql';

export interface FileTransaction {
  id: string;
  status: string;
  description?: string;
  files: { path: string, beforeHash?: string, afterHash?: string, originalDataPath?: string }[];
}

interface FileTransactionRow {
  id: string;
  status: string;
  description: string | null;
}

interface FileTransactionEntryRow {
  transaction_id: string;
  file_path: string;
  before_hash: string | null;
  after_hash: string | null;
  original_data_path: string | null;
}

export function logTransaction(db: Database, tx: FileTransaction): void {
  db.prepare(`
    INSERT INTO file_transactions (id, status, description)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `).run(tx.id, tx.status, tx.description ?? null);

  db.prepare('DELETE FROM file_transaction_entries WHERE transaction_id = ?').run(tx.id);

  for (const f of tx.files) {
    db.prepare(`
      INSERT INTO file_transaction_entries (transaction_id, file_path, before_hash, after_hash, original_data_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(tx.id, f.path, f.beforeHash, f.afterHash, f.originalDataPath ?? null);
  }
}

export function getLastTransaction(db: Database): FileTransaction | null {
  const row = db.prepare(`
    SELECT * FROM file_transactions
    WHERE status = 'COMMITTED'
    ORDER BY created_at DESC LIMIT 1
  `).get() as FileTransactionRow | undefined;
  if (!row) return null;

  const entries = db.prepare(`
    SELECT * FROM file_transaction_entries WHERE transaction_id = ?
  `).all(row.id) as FileTransactionEntryRow[];

  return {
    id: row.id,
    status: row.status,
    description: row.description ?? undefined,
    files: entries.map(e => ({
      path: e.file_path,
      beforeHash: e.before_hash ?? undefined,
      afterHash: e.after_hash ?? undefined,
      originalDataPath: e.original_data_path ?? undefined
    }))
  };
}
