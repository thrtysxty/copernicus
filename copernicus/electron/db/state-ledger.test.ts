import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Electron's `app` so the module-level stateLedger singleton can initialise
// without an actual Electron runtime (app.getPath would throw otherwise).
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-copernicus-state-ledger' },
}));

import { StateLedger } from './state-ledger';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('StateLedger', () => {
  let ledger: StateLedger;
  const testDbPath = path.join(os.tmpdir(), `test-ledger-${Date.now()}.db`);

  beforeEach(() => {
    ledger = new StateLedger(testDbPath);
  });

  afterEach(() => {
    ledger.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should initialize tables on creation', () => {
    expect(ledger).toBeDefined();
    expect(ledger.db).toBeDefined();
  });

  it('should log and retrieve intents', () => {
    const content = 'Test Strategic Intent';
    const agentId = 'architect';

    const id = ledger.logIntent(content, 'PENDING', agentId);
    expect(id).toBeGreaterThan(0);

    const intents = ledger.getRecentIntents(1);
    expect(intents.length).toBe(1);
    expect(intents[0].content).toBe(content);
    expect(intents[0].agent_id).toBe(agentId);
  });

  it('should log and retrieve events', () => {
    const type = 'SYSTEM_BOOT';
    const content = 'Kernel initialized';

    const id = ledger.logEvent(type, content, { version: '0.1.0' }, 'main');
    expect(id).toBeGreaterThan(0);

    const events = ledger.getRecentEvents(1);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe(type);
    expect(events[0].content).toBe(content);
  });

  it('should add and search memories', () => {
    const content = 'Critical project constraint: Pi 3B+ hardware';

    ledger.addMemory(content, ['hardware', 'constraint'], 'architect');
    const results = ledger.searchMemory('Pi 3B+');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('Pi 3B+');
  });

  it('should register and find assets', () => {
    const assetPath = 'src/renderer/components/test.tsx';
    const type = 'react-component';

    ledger.registerAsset(assetPath, type);
    const asset = ledger.findAsset(assetPath);

    expect(asset).toBeDefined();
    expect(asset?.path).toBe(assetPath);
    expect(asset?.type).toBe(type);
  });

  it('should return empty array for missing memory search', () => {
    const results = ledger.searchMemory('nonexistent-query-xyz-123');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it('should open an existing database without re-initialising', () => {
    ledger.logIntent('first entry', 'pending');
    ledger.close();

    const ledger2 = new StateLedger(testDbPath);
    const id = ledger2.logIntent('second entry', 'pending');
    expect(id).toBeGreaterThan(1);
    ledger2.close();

    // Re-open to prevent double-close in afterEach
    ledger = new StateLedger(testDbPath);
  });
});
