import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectStack } from './stack-detector';

describe('stack-detector', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-detector-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects empty stack', () => {
    const profile = detectStack(tmpDir);
    expect(profile.hasElectron).toBe(false);
    expect(profile.frameworks).toEqual([]);
  });

  it('detects React and Electron', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '18.0.0' },
      devDependencies: { electron: '30.0.0' }
    }));
    const profile = detectStack(tmpDir);
    expect(profile.hasReact).toBe(true);
    expect(profile.hasElectron).toBe(true);
    expect(profile.frameworks).toContain('React');
    expect(profile.frameworks).toContain('Electron');
  });
});
