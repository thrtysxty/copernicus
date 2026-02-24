import { app, ipcMain } from 'electron';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

let Database: any;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('[DevTime] better-sqlite3 not found');
}

export interface DevSession {
  id?: number;
  entity: 'PIMS' | 'HPH';
  component: string;
  phase: string;
  story_id: string;
  start_time: string;
  end_time?: string;
  description?: string;
  commits?: string;
}

export class DevTimeManager {
  private db: any;
  private currentSession: DevSession | null = null;

  constructor() {
    if (Database) {
      try {
        const userDataPath = app.getPath('userData');
        const dbPath = join(userDataPath, 'devtime.db');
        this.db = new Database(dbPath);
        this.initSchema();
      } catch (e) {
        console.error('[DevTime] Init error', e);
      }
    }
    this.setupIpc();
  }

  private initSchema() {
    if (!this.db) return;
    const schema = `
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL CHECK(entity IN ('PIMS', 'HPH')),
        component TEXT NOT NULL,
        phase TEXT NOT NULL,
        story_id TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        description TEXT,
        commits TEXT,
        duration_hours REAL GENERATED ALWAYS AS (
          (strftime('%s', end_time) - strftime('%s', start_time)) / 3600.0
        ) VIRTUAL
      );
    `;
    this.db.exec(schema);
  }

  private setupIpc() {
    ipcMain.handle('devtime:start-session', (event, session: Partial<DevSession>) => {
      return this.startSession(session);
    });

    ipcMain.handle('devtime:end-session', (event, data: { description: string, commits: string }) => {
      return this.endSession(data.description, data.commits);
    });

    ipcMain.handle('devtime:get-status', () => {
      return {
        active: !!this.currentSession,
        session: this.currentSession
      };
    });

    ipcMain.handle('devtime:get-report', (event, month: string) => {
      if (!this.db) return [];
      return this.db.prepare(`
        SELECT * FROM sessions 
        WHERE strftime('%Y-%m', start_time) = ? 
        AND end_time IS NOT NULL
      `).all(month);
    });
  }

  public startSession(session: Partial<DevSession>) {
    if (this.currentSession) return { success: false, error: 'Session already active' };

    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO sessions (entity, component, phase, story_id) 
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(
        session.entity || 'HPH',
        session.component || 'core',
        session.phase || 'APPLICATION_DEVELOPMENT',
        session.story_id || 'unassigned'
      );
      session.id = result.lastInsertRowid;
    }

    this.currentSession = {
      id: session.id as number,
      entity: (session.entity || 'HPH') as any,
      component: session.component || 'core',
      phase: session.phase || 'APPLICATION_DEVELOPMENT',
      story_id: session.story_id || 'unassigned',
      start_time: new Date().toISOString()
    };

    return { success: true, session: this.currentSession };
  }

  public endSession(description: string, commits: string) {
    if (!this.currentSession) return { success: false, error: 'No active session' };

    if (this.db && this.currentSession.id) {
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET end_time = CURRENT_TIMESTAMP, description = ?, commits = ?
        WHERE id = ?
      `);
      stmt.run(description, commits, this.currentSession.id);
    }
    
    this.currentSession = null;
    return { success: true };
  }
}
