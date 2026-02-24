import { BrowserWindow } from 'electron';
import { telemetryManager } from './telemetry';

export interface AgentTask {
  id: string;
  agentId: string;
  type: 'task' | 'tool' | 'teleport';
  label: string;
  status: 'running' | 'completed' | 'error';
  ts: string;
}

export class TelemetryParser {
  private static JULES_PATTERNS = [
    {
      id: 'jules-teleport',
      pattern: /teleport\s+(\d+)/i,
      label: 'Teleporting to session'
    },
    {
      id: 'jules-task-start',
      pattern: /Assigning task:\s+(.+)/i,
      label: 'New Task'
    },
    {
      id: 'jules-session-id',
      pattern: /ID:\s+(\d+)/i,
      label: 'Session ID'
    }
  ];

  public static scan(agentId: string, data: string, window: BrowserWindow) {
    if (agentId === 'jules') {
      this.scanJules(data, window);
    }
    // Claude patterns...
    if (agentId === 'claude') {
      this.scanClaude(data, window);
    }
  }

  private static scanJules(data: string, window: BrowserWindow) {
    for (const p of this.JULES_PATTERNS) {
      const match = data.match(p.pattern);
      if (match) {
        const sessionId = match[1] || Math.random().toString(36).substring(7);
        const task: AgentTask = {
          id: sessionId,
          agentId: 'jules',
          type: p.id === 'jules-teleport' ? 'teleport' : 'task',
          label: match[1] ? `${p.label}: ${match[1]}` : p.label,
          status: 'running',
          ts: new Date().toISOString()
        };

        // Persist to DB if teleporting
        if (p.id === 'jules-teleport') {
          telemetryManager.logEvent('jules', 'TELEPORT_START', { sessionId });
          // Note: we don't have the internal agent ID here, just the label 'jules'
        }

        window.webContents.send('telemetry:update', task);
      }
    }
  }

  private static scanClaude(data: string, window: BrowserWindow) {
    // Claude tool call patterns (Read, Edit, Bash)
    const toolPattern = /⎿\s+(\w+)\s+(.+)/;
    const match = data.match(toolPattern);
    if (match) {
      const task: AgentTask = {
        id: Math.random().toString(36).substring(7),
        agentId: 'claude',
        type: 'tool',
        label: `${match[1]}: ${match[2]}`,
        status: 'running',
        ts: new Date().toISOString()
      };
      window.webContents.send('telemetry:update', task);
    }
  }
}
