import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class SettingsStore {
  private configPath: string;
  private data: Record<string, any> = {};

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'settings.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.data = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  get(key: string, defaultValue: any): any {
    return this.data[key] ?? defaultValue;
  }

  set(key: string, value: any) {
    this.data[key] = value;
    this.save();
  }
}
