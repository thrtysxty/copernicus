import Database from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class DevtimeManager {
  private db: Database.Database;
  private activeSession: any = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private readonly DB_DIR = path.join(os.homedir(), '.copernicus');
  private readonly DB_PATH = path.join(this.DB_DIR, 'devtime.db');
  private readonly LOCK_PATH = path.join(this.DB_DIR, '.devtime_active');

  constructor() {
    if (!fs.existsSync(this.DB_DIR)) {
      fs.mkdirSync(this.DB_DIR, { recursive: true });
    }
    this.db = new Database(this.DB_PATH);
    this.init();
    this.recoverSession();
    this.registerHandlers();
  }

  private init() {
    // Resolves AC 4: Reconcile schema with SQL file
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dev_sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        date        TEXT    NOT NULL,
        start_time  TEXT,
        duration    REAL    NOT NULL CHECK (duration >= 0.25),
        phase       TEXT    NOT NULL CHECK (phase IN (
                        'PRELIMINARY', 'DEVELOPMENT', 'POST_IMPLEMENTATION')),
        financial_category TEXT NOT NULL CHECK (financial_category IN ('CAPEX', 'OPEX', 'NONE')),
        component   TEXT    NOT NULL,
        description TEXT    NOT NULL,
        commits     TEXT,
        story_id    TEXT,
        capitalizable INTEGER GENERATED ALWAYS AS (
            CASE WHEN financial_category = 'CAPEX' AND phase = 'DEVELOPMENT'
                 THEN 1 ELSE 0 END
        ) STORED,
        created_at  TEXT DEFAULT (datetime('now')),
        value       REAL
      );
    `);
  }

  private recoverSession() {
    // Resolves AC 4: Fix TOCTOU race condition
    try {
      const data = JSON.parse(fs.readFileSync(this.LOCK_PATH, 'utf8'));
      this.startSession(data, true);
    } catch (e) {
      // Expected if file doesn't exist or is invalid
    }
  }

  private registerHandlers() {
    ipcMain.handle('devtime:start', (_event, data) => this.startSession(data));
    ipcMain.handle('devtime:status', () => ({
      session: this.activeSession,
      total: this.getTotalMonthValue()
    }));
    ipcMain.handle('devtime:close', (_event, data) => this.closeSession(data));
    ipcMain.handle('devtime:defaults', () => this.getDefaults());
  }

  private startSession(data: any, isRecovery = false) {
    this.activeSession = {
      ...data,
      start_time: data.start_time || new Date().toISOString(),
      duration_seconds: data.duration_seconds || 0,
      value: data.value || 0
    };

    if (!isRecovery) {
      fs.writeFileSync(this.LOCK_PATH, JSON.stringify(this.activeSession));
    }
    
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.activeSession) {
        this.activeSession.duration_seconds += 60;
        this.activeSession.value = (this.activeSession.duration_seconds / 3600) * 65;
      }
    }, 60000);

    return this.activeSession;
  }

  private closeSession(data: any) {
    if (!this.activeSession) return;

    const endTime = new Date().toISOString();
    const durationHours = Math.max(0.25, Math.round((this.activeSession.duration_seconds / 3600) * 4) / 4);
    const value = durationHours * 65;

    const stmt = this.db.prepare(`
      INSERT INTO dev_sessions (
        date, start_time, duration, phase, financial_category, component, 
        description, commits, story_id, value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      new Date(this.activeSession.start_time).toISOString().split('T')[0],
      this.activeSession.start_time,
      durationHours,
      this.activeSession.phase,
      this.activeSession.financial_category,
      this.activeSession.component,
      data.description,
      '', // commits placeholder
      this.activeSession.story_id || '',
      value
    );

    this.activeSession = null;
    if (this.timerInterval) clearInterval(this.timerInterval);
    try {
        fs.unlinkSync(this.LOCK_PATH);
    } catch (e) {
        // Ignore
    }
  }

  private getTotalMonthValue() {
    const month = new Date().toISOString().slice(0, 7);
    const row = this.db.prepare("SELECT SUM(value) as total FROM dev_sessions WHERE date LIKE ? AND capitalizable = 1").get(`${month}%`) as any;
    return row?.total || 0;
  }

  private getDefaults() {
    return {
      financial_category: 'CAPEX',
      component: 'platform_core',
      phase: 'DEVELOPMENT',
      stories: ['story_098', 'story_099', 'story_100']
    };
  }
}
