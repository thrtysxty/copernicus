import path from 'node:path';
import { SettingsStore } from '../settings-store';

export function addRecentProject(dirPath: string, settingsStore: SettingsStore) {
  if (!dirPath) return;
  const name = path.basename(dirPath) || dirPath;
  const recentProjects = settingsStore.get<{ name: string; path: string; lastOpened: string }[]>('recentProjects', []);
  
  // Deduplicate by path
  const filtered = recentProjects.filter(p => p.path !== dirPath);
  
  const updated = [
    { name, path: dirPath, lastOpened: new Date().toISOString() },
    ...filtered
  ].slice(0, 10); // Max 10, newest first
  
  settingsStore.set('recentProjects', updated);
}
