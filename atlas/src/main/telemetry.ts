import { app, ipcMain } from 'electron';
import { join } from 'path';

let Database: any;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('[Telemetry] better-sqlite3 not found, using memory fallback');
}

export interface AgentRecord {
  id: string;
  name: string;
  role: string;
  task_description: string;
  status: 'RUNNING' | 'STALE' | 'COMPLETED' | 'TELEPORTED';
}

export class TelemetryManager {
  private db: any;
  private memoryDb: any[] = [];

  constructor() {
    if (Database) {
      try {
        const dbPath = join(process.cwd(), 'agent_telemetry.db');
        this.db = new Database(dbPath);
        this.setupIpc();
      } catch (e) {
        console.error('[Telemetry] Failed to init SQLite, falling back', e);
      }
    } else {
      this.setupIpc();
    }
  }

  private setupIpc() {
    ipcMain.handle('telemetry:get-agents', () => {
      if (this.db) {
        return this.db.prepare("SELECT * FROM agents WHERE status = 'RUNNING'").all();
      }
      return this.memoryDb.filter(a => a.status === 'RUNNING');
    });
  }

  public updateAgentStatus(agentId: string, status: string) {
    if (this.db) {
      const stmt = this.db.prepare("UPDATE agents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
      stmt.run(status, agentId);
    } else {
      const agent = this.memoryDb.find(a => a.id === agentId);
      if (agent) agent.status = status;
    }
  }

  public logEvent(agentId: string, type: string, data: any) {
    if (this.db) {
      const stmt = this.db.prepare("INSERT INTO events (id, agent_id, event_type, data) VALUES (?, ?, ?, ?)");
      const id = Math.random().toString(36).substring(7);
      stmt.run(id, agentId, type, JSON.stringify(data));
    } else {
      console.log(`[Telemetry Mock] Event: ${type} for ${agentId}`, data);
    }
  }
}

export const telemetryManager = new TelemetryManager();
