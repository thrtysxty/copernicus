import type { Database } from 'libsql';
import type { SharedAsset } from '../types';

export function registerAsset(db: Database, assetPath: string, type: string, content_hash?: string) {
  const stmt = db.prepare(`
    INSERT INTO shared_assets (path, type, content_hash, last_updated)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_updated = CURRENT_TIMESTAMP
  `);
  stmt.run(assetPath, type, content_hash);
}

export function findAsset(db: Database, assetPath: string): SharedAsset | undefined {
  return db.prepare('SELECT * FROM shared_assets WHERE path = ?').get(assetPath) as SharedAsset | undefined;
}
