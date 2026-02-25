import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    // If it doesn't throw, tables are at least attempted
    expect(ledger).toBeDefined();
  });

  it('should log and retrieve intents', () => {
    const content = 'Test Strategic Intent';
    const agentId = 'architect';
    
    ledger.logIntent(content, 'PENDING', agentId);
    const intents = ledger.getRecentIntents(1);
    
    expect(intents.length).toBe(1);
    expect(intents[0].content).toBe(content);
    expect(intents[0].agent_id).toBe(agentId);
  });

  it('should log and retrieve events', () => {
    const type = 'SYSTEM_BOOT';
    const content = 'Kernel initialized';
    
    ledger.logEvent(type, content, { version: '0.1.0' }, 'main');
    const events = ledger.getRecentEvents(1);
    
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe(type);
    expect(events[0].content).toBe(content);
  });

  it('should add and search memories', () => {
    const content = 'Critical project constraint: Pi 3B+ hardware';
    const tags = 'hardware,constraint';
    
    ledger.addMemory(content, tags, 'architect');
    const results = ledger.searchMemory('Pi 3B+');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('Pi 3B+');
  });

  it('should register and retrieve assets', () => {
    const assetType = 'JSON_CONFIG';
    const name = 'test-config';
    const content = '{"key": "value"}';
    
    ledger.registerAsset(assetType, name, content, { owner: 'jules' });
    const asset = ledger.getAsset(assetType, name);
    
    expect(asset).toBeDefined();
    expect(asset?.content).toBe(content);
    expect(JSON.parse(asset?.metadata || '{}').owner).toBe('jules');
  });
});
