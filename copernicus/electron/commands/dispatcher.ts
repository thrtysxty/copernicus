import { ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ptyManager } from '../pty-manager';
import { stateLedger } from '../db/state-ledger';
import log from '../utils/logger';

export function setupCommandHandlers() {
  // Resolves AC 4: Wire terminal:write
  ipcMain.on('terminal:write', (_event, { terminalId, text }) => {
    ptyManager.write(terminalId, text);
  });

  ipcMain.on('command:forward', (event, { agentId, targetAgentId }) => {
    log.info(`[SYSTEM] Forwarding context from ${agentId} to ${targetAgentId}`);

    // Resolves AC 4: Remove hardcoded mock, read from ledger
    const recentEvents = stateLedger.getRecentEvents(5);
    const lastOutput = recentEvents.find(e => e.type === 'TERMINAL_OUTPUT')?.content || 'No recent terminal output found.';

    event.sender.send('agent:message', {
        role: 'user',
        content: `CONTEXT_FORWARD [from=${agentId}]: ${lastOutput}`
    });
  });

  ipcMain.on('command:audit', (event) => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const auditScript = path.join(projectRoot, 'scripts/utils/security_audit.py');

    log.info(`[SECURITY] Triggering manual audit: ${auditScript}`);
    const child = spawn('python3', [auditScript], { cwd: projectRoot });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      log.info(`[SECURITY] Audit finished with code ${code}`);
      // Broadcast result to telemetry or active window
      event.sender.send('terminal:data', `\n--- TECHNICAL SECURITY AUDIT ---\n${output}\n-------------------------------\n`);
    });
  });
}
