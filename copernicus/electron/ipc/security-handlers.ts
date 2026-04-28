import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { securityManager } from '../security';
import { SecurityScorer } from '../security/SecurityScorer';
import * as path from 'path';
import { app } from 'electron';

let scorer: SecurityScorer | null = null;


import * as os from 'os';
import * as yaml from 'js-yaml';
import * as fsLib from 'fs';

const SECURITY_YAML_PATH = path.join(os.homedir(), '.copernicus', 'security.yaml');

const DEFAULT_CONFIG = {
  version: 1,
  package_gate: {
    enabled: true,
    min_age_days: 30,
    min_weekly_downloads: 500,
    registries: ['npm'],
    on_violation: 'block',
    require_user_approval: true
  },
  package_allowlist: [
    '@modelcontextprotocol/sdk',
    '@google/jules-sdk',
    '@google/stitch-sdk',
    '@google/generative-ai',
    '@openrouter/sdk'
  ],
  package_blocklist: []
};

function getSecurityConfig() {
  if (!fsLib.existsSync(SECURITY_YAML_PATH)) {
    const copernicusDir = path.dirname(SECURITY_YAML_PATH);
    if (!fsLib.existsSync(copernicusDir)) {
      fsLib.mkdirSync(copernicusDir, { recursive: true });
    }
    fsLib.writeFileSync(SECURITY_YAML_PATH, yaml.dump(DEFAULT_CONFIG));
    return DEFAULT_CONFIG;
  }
  try {
    const doc = yaml.load(fsLib.readFileSync(SECURITY_YAML_PATH, 'utf8'), { schema: yaml.JSON_SCHEMA });
    return doc;
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

function updateSecurityConfig(newConfig: any) {
  fsLib.writeFileSync(SECURITY_YAML_PATH, yaml.dump(newConfig));
}

export function register() {
  ipcMain.handle('security:get-config', () => handleIpc(() => {
    return getSecurityConfig();
  }));

  ipcMain.handle('security:update-package-gate', (_e, arg) => handleIpc(() => {
    const { updates, confirmed } = arg;
    const config = getSecurityConfig() as any;

    if (updates.enabled === false && !confirmed) {
        throw new Error('Disabling package gate requires confirmation.');
    }

    config.package_gate = { ...config.package_gate, ...updates };
    updateSecurityConfig(config);
    return config;
  }));

  ipcMain.handle('security:add-to-allowlist', (_e, packageName) => handleIpc(() => {
    const config = getSecurityConfig() as any;
    if (!config.package_allowlist) {
        config.package_allowlist = [];
    }
    if (!config.package_allowlist.includes(packageName)) {
        config.package_allowlist.push(packageName);
        updateSecurityConfig(config);
    }
    return config;
  }));

  // Initialize scorer lazily or when registered
  const projectRoot = path.resolve(app.getAppPath(), '../../');
  if (!scorer && securityManager && securityManager.detector) {
    scorer = new SecurityScorer(securityManager.detector, projectRoot);
  }

  ipcMain.handle('security:score', () => handleIpc('security:score', [], async () => {
    if (!scorer) {
      if (securityManager && securityManager.detector) {
        scorer = new SecurityScorer(securityManager.detector, projectRoot);
      } else {
        throw new Error('SecurityManager not initialized');
      }
    }
    return await scorer.computeScore();
  }));
}
