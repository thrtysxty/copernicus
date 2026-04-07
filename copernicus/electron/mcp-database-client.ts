import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { app } from "electron";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

let client: Client | null = null;
let transport: StdioClientTransport | null = null;

export async function getDbMcpClient(): Promise<Client> {
  if (client) return client;

  const dbPath = path.join(app.getPath('userData'), 'copernicus.db');

  // Ensure the toolbox.yaml config exists
  const configDir = path.join(os.homedir(), '.copernicus');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configPath = path.join(configDir, 'toolbox.yaml');

  const yaml = `
tools:
  - name: search_episodes
    kind: sqlite
    database: "${dbPath}"
    statement: "SELECT * FROM episodes WHERE task LIKE '%' || ? || '%' OR outcome LIKE '%' || ? || '%';"
    parameters:
      - name: keyword1
        type: string
      - name: keyword2
        type: string
  - name: story_status
    kind: sqlite
    database: "${dbPath}"
    statement: "SELECT * FROM stories WHERE id = ?;"
    parameters:
      - name: story_id
        type: string
  - name: recent_episodes
    kind: sqlite
    database: "${dbPath}"
    statement: "SELECT * FROM episodes WHERE agent = ? ORDER BY timestamp DESC LIMIT ?;"
    parameters:
      - name: n
        type: integer
      - name: role
        type: string
  - name: quality_summary
    kind: sqlite
    database: "${dbPath}"
    statement: "SELECT AVG(quality_score) as avg_score, COUNT(*) as total_episodes FROM episodes WHERE timestamp >= date('now', '-' || ? || ' days');"
    parameters:
      - name: days
        type: integer
`;
  fs.writeFileSync(configPath, yaml, 'utf8');

  // Use the bundled binary
  const command = path.join(app.getAppPath(), 'scripts', 'agent-daemon', 'bin', 'toolbox');

  transport = new StdioClientTransport({
    command: command,
    args: ["serve", "--stdio", "--config", configPath],
    env: {
      ...process.env,
      SQLITE_DATABASE: dbPath
    }
  });

  client = new Client({
    name: "copernicus-ide",
    version: "1.0.0",
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  return client;
}
