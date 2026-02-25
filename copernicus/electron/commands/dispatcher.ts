import { ipcMain, clipboard } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';

export function setupCommandHandlers() {
  ipcMain.on('terminal:write', (_event, { terminalId, text }) => {
    console.log(`[PTY:${terminalId}] Writing: "${text}"`);
  });

  ipcMain.on('command:forward', (_event, { target, _args: _ }) => {
    const lastResponse = "Mocked last response from previous agent (Plan Step 4)."; 
    clipboard.writeText(lastResponse);
    console.log(`[Clipboard] Copied: "${lastResponse}"`);
    console.log(`[PTY:${target}] Writing (forwarded): "${lastResponse}"`);
  });

  ipcMain.on('command:audit', (event) => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const auditScript = path.join(projectRoot, 'scripts/utils/security_audit.py');
    
    console.log(`[SECURITY] Triggering manual audit: ${auditScript}`);
    const child = spawn('python3', [auditScript], { cwd: projectRoot });
    
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`[SECURITY] Audit finished with code ${code}`);
      // Broadcast result to telemetry or active window
      event.sender.send('terminal:data', `\n--- TECHNICAL SECURITY AUDIT ---\n${output}\n-------------------------------\n`);
    });
  });
}
