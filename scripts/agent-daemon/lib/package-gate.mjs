import os from 'os';
import path from 'path';
import fs from 'fs';
import https from 'https';

// We import from absolute path just in case the node_modules aren't resolved in the sandbox
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We'll require js-yaml instead since it might not be properly exported as ESM or resolved in the daemon script space
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const yaml = require('../../../copernicus/node_modules/js-yaml');

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

function getConfig() {
  if (!fs.existsSync(SECURITY_YAML_PATH)) {
    const copernicusDir = path.dirname(SECURITY_YAML_PATH);
    if (!fs.existsSync(copernicusDir)) {
      fs.mkdirSync(copernicusDir, { recursive: true });
    }
    fs.writeFileSync(SECURITY_YAML_PATH, yaml.dump(DEFAULT_CONFIG));
    return DEFAULT_CONFIG;
  }
  try {
    const doc = yaml.load(fs.readFileSync(SECURITY_YAML_PATH, 'utf8'), { schema: yaml.JSON_SCHEMA });
    return doc;
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

function updateConfig(newConfig) {
  fs.writeFileSync(SECURITY_YAML_PATH, yaml.dump(newConfig));
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const packageGate = {
  async check(packageName, registry) {
    const config = getConfig();
    const gate = config.package_gate || DEFAULT_CONFIG.package_gate;

    // Check Allowlist
    if ((config.package_allowlist || []).includes(packageName)) {
      return {
        allowed: true,
        package: packageName,
        registry,
        age_days: null,
        weekly_downloads: null,
        reason: 'ALLOWLISTED',
        policy_applied: 'allowlist'
      };
    }

    // Check Blocklist
    if ((config.package_blocklist || []).includes(packageName)) {
      return {
        allowed: false,
        package: packageName,
        registry,
        age_days: null,
        weekly_downloads: null,
        reason: 'BLOCKLISTED',
        policy_applied: 'blocklist'
      };
    }

    if (!gate.enabled) {
      return {
        allowed: true,
        package: packageName,
        registry,
        age_days: null,
        weekly_downloads: null,
        reason: 'APPROVED',
        policy_applied: 'gate_disabled'
      };
    }

    if (registry !== 'npm' || !gate.registries.includes(registry)) {
      // Unhandled registry
      return {
        allowed: true,
        package: packageName,
        registry,
        age_days: null,
        weekly_downloads: null,
        reason: 'APPROVED',
        policy_applied: 'unsupported_registry'
      };
    }

    let age_days = null;
    let weekly_downloads = null;

    try {
      const registryData = await httpsGet(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
      if (registryData && registryData.time && registryData.time.created) {
        const createdDate = new Date(registryData.time.created);
        const now = new Date();
        const diffTime = Math.abs(now - createdDate);
        age_days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const downloadsData = await httpsGet(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`);
      if (downloadsData && downloadsData.downloads !== undefined) {
        weekly_downloads = downloadsData.downloads;
      }

      if (age_days !== null && age_days < gate.min_age_days) {
        return {
          allowed: false,
          package: packageName,
          registry,
          age_days,
          weekly_downloads,
          reason: `TOO_NEW: ${age_days} days old (min: ${gate.min_age_days})`,
          policy_applied: 'min_age_days'
        };
      }

      if (weekly_downloads !== null && weekly_downloads < gate.min_weekly_downloads) {
        return {
          allowed: false,
          package: packageName,
          registry,
          age_days,
          weekly_downloads,
          reason: `LOW_DOWNLOADS: ${weekly_downloads} weekly downloads (min: ${gate.min_weekly_downloads})`,
          policy_applied: 'min_weekly_downloads'
        };
      }

      return {
        allowed: true,
        package: packageName,
        registry,
        age_days,
        weekly_downloads,
        reason: 'APPROVED',
        policy_applied: 'thresholds_met'
      };

    } catch (e) {
      return {
        allowed: false,
        package: packageName,
        registry,
        age_days: null,
        weekly_downloads: null,
        reason: 'FETCH_ERROR: Could not fetch package data from registry.',
        policy_applied: 'fetch_error'
      };
    }
  },

  getConfig,
  updateConfig
};

export default packageGate;
export { packageGate, getConfig, updateConfig };
