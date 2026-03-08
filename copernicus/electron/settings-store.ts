import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import log from './utils/logger';

export interface Settings {
  workspace?: string;
  googleOAuthClientId?: string;
  mcp?: {
    servers: any[];
  };
  touchBar?: any;
  [key: string]: unknown;
}

export class SettingsStore {
  private configPath: string;
  private data: Settings = {};

  constructor() {
    // Unify on copernicus-settings.json as the single source of truth
    this.configPath = path.join(app.getPath('userData'), 'copernicus-settings.json');
    this.load();
    this.migrateLegacy();
  }

  private load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.data = JSON.parse(data);
      }
    } catch (e) {
      log.error('Failed to load settings:', e);
      this.data = {};
    }
  }

  private migrateLegacy() {
    // 1. Migrate MCP config if missing
    if (!this.data.mcp || !this.data.mcp.servers) {
      const COPERNICUS_HOME = process.env.COPERNICUS_E2E_HOME ?? path.join(os.homedir(), '.copernicus');
      const legacyMcpPath = path.join(COPERNICUS_HOME, 'mcp_config.json');
      const userDataMcpPath = path.join(app.getPath('userData'), 'claude_mcp_config.json');

      let servers: unknown[] = [];

      if (fs.existsSync(userDataMcpPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(userDataMcpPath, 'utf-8'));
          if (config.mcpServers) {
            servers = Object.entries(config.mcpServers).map(([name, conf]: [string, any]) => ({
              name,
              transport: conf.url ? 'sse' : 'stdio',
              command: conf.command,
              args: conf.args,
              url: conf.url
            }));
          }
        } catch (e) {
          log.error('Failed to migrate from userData claude_mcp_config.json', e);
        }
      } else if (fs.existsSync(legacyMcpPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(legacyMcpPath, 'utf-8'));
          if (Array.isArray(config)) servers = config;
        } catch (e) {
          log.error('Failed to migrate from legacy mcp_config.json', e);
        }
      }

      this.data.mcp = { servers };
      this.save();
    }

    // 2. Check for legacy settings.json (if it exists, merge it and delete it)
    const oldPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(oldPath)) {
      try {
        const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
        this.data = { ...oldData, ...this.data };
        this.save();
        fs.unlinkSync(oldPath);
        log.info('Successfully migrated and removed legacy settings.json');
      } catch (e) {
        log.error('Failed to migrate legacy settings.json:', e);
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      log.error('Failed to save settings:', e);
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    return (this.data[key] as T) ?? (defaultValue as T);
  }

  set(key: string, value: unknown) {
    this.data[key] = value;
    this.save();
  }

  getAll(): Settings {
    return { ...this.data };
  }

  setAll(data: Partial<Settings>) {
    this.data = { ...this.data, ...data };
    this.save();
  }
}
