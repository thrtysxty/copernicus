import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import log from 'electron-log'

import { SettingsStore } from '../settings-store'

const COPERNICUS_HOME = process.env.COPERNICUS_E2E_HOME ?? path.join(os.homedir(), '.copernicus')
export const LOG_DIR = path.join(COPERNICUS_HOME, 'logs')
log.transports.file.resolvePathFn = () => path.join(LOG_DIR, 'copernicus.log')
Object.assign(console, log.functions)

export function ensureCopernicusDirectory(settingsStore: SettingsStore, isFirstRunRef: { current: boolean }) {
  try {
    if (!fs.existsSync(COPERNICUS_HOME)) fs.mkdirSync(COPERNICUS_HOME, { recursive: true });
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const settingsPath = path.join(process.env.COPERNICUS_E2E_HOME ?? app.getPath('userData'), 'copernicus-settings.json');
    if (!fs.existsSync(settingsPath) || !settingsStore.get('workspace')) isFirstRunRef.current = true;
  } catch (error) { log.error('Failed to initialize .copernicus directory:', error); }
}
