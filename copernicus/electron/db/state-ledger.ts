import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { SCHEMA } from './schema';

export interface Intent {
  id?: number;
  content: string;
  status: string;
  agent_id?: string;
  created_at?: string;
}

export interface EventLog {
  id?: number;
  type: string;
  content: string;
  metadata?: any;
  agent_id?: string;
  created_at?: string;
}

export interface MemoryFragment {
  id?: number;
  content: string;
  tags?: string[];
  agent_id?: string;
  created_at?: string;
}

export interface SharedAsset {
  id?: number;
  path: string;
  type: string;
  content_hash?: string;
  last_updated?: string;
}

export class StateLedger {
  public db: Database.Database;

  constructor(dbPath?: string) {
    let finalPath = dbPath;
    
    if (!finalPath) {
      if (app && app.isReady()) {
        finalPath = path.join(app.getPath('userData'), 'copernicus.db');
      } else {
        finalPath = path.join(process.cwd(), 'copernicus.db');
      }
    }

    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.init();
  }

  private init() {
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA.intents);
    this.db.exec(SCHEMA.events);
    this.db.exec(SCHEMA.memory);
    this.db.exec(SCHEMA.shared_assets);
  }

  logIntent(content: string, status: string = 'pending', agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO intents (content, status, agent_id) VALUES (?, ?, ?)');
    const info = stmt.run(content, status, agent_id);
    return info.lastInsertRowid as number;
  }

  getRecentIntents(limit: number = 10): Intent[] {
    const stmt = this.db.prepare('SELECT * FROM intents ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as Intent[];
  }

  logEvent(type: string, content: string, metadata: any = {}, agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)');
    const info = stmt.run(type, content, JSON.stringify(metadata), agent_id);
    return info.lastInsertRowid as number;
  }

  getRecentEvents(limit: number = 50): EventLog[] {
    const stmt = this.db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));
  }

  addMemory(content: string, tags: string[] = [], agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO memory (content, tags, agent_id) VALUES (?, ?, ?)');
    const info = stmt.run(content, JSON.stringify(tags), agent_id);
    return info.lastInsertRowid as number;
  }

  searchMemory(query: string): MemoryFragment[] {
    const stmt = this.db.prepare('SELECT * FROM memory WHERE content LIKE ? ORDER BY created_at DESC LIMIT 10');
    const rows = stmt.all(`%${query}%`) as any[];
    return rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : []
    }));
  }

  registerAsset(assetPath: string, type: string, content_hash?: string) {
    const stmt = this.db.prepare(`
      INSERT INTO shared_assets (path, type, content_hash, last_updated)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_updated = CURRENT_TIMESTAMP
    `);
    stmt.run(assetPath, type, content_hash);
  }

  findAsset(assetPath: string): SharedAsset | undefined {
    const stmt = this.db.prepare('SELECT * FROM shared_assets WHERE path = ?');
    return stmt.get(assetPath) as SharedAsset | undefined;
  }

  close() {
    this.db.close();
  }
}
