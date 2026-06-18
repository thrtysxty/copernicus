/**
 * SettingsStore persistence tests.
 * Module: electron/settings-store.ts (SettingsStore class)
 *
 * NOTE: SettingsStore has no per-key env var override mechanism.
 * process.env.COPERNICUS_E2E_HOME only controls the config file path.
 * Tests 5 and 6 are skipped accordingly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { SettingsStore } from './settings-store';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

vi.mock('fs', async () => {
  const actualFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actualFs,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

describe('SettingsStore persistence', () => {
  // Shared mutable file state so both in-memory and disk reads stay in sync
  let fileStore: Record<string, unknown> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    fileStore = {};
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => JSON.stringify(fileStore));
    vi.mocked(fs.writeFileSync).mockImplementation((_path, data: unknown) => {
      fileStore = JSON.parse(data as string);
    });
  });

  afterEach(() => {
    fileStore = {};
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it('1. write then read — write a setting, read it back, assert value matches', () => {
    const store = new SettingsStore();
    store.set('theme', 'dark');

    expect(store.get('theme')).toBe('dark');
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it('2. default value — read unwritten setting, assert configured default returned', () => {
    const store = new SettingsStore();

    // No default passed: undefined (undefined is the falsy fallback)
    expect(store.get('nonexistent')).toBeUndefined();

    // With default: return the default
    expect(store.get('nonexistent', 'fallback')).toBe('fallback');
    expect(store.get('nonexistent', false)).toBe(false);
    expect(store.get('nonexistent', 0)).toBe(0);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it('3. overwrite — write a value, overwrite with new value, assert new value returned', () => {
    const store = new SettingsStore();
    store.set('model', 'gpt-4o');
    expect(store.get('model')).toBe('gpt-4o');

    store.set('model', 'claude-sonnet-4');
    expect(store.get('model')).toBe('claude-sonnet-4');
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it('4. persist across instance — second store instance reads value written by first', () => {
    // First instance writes
    const store1 = new SettingsStore();
    store1.set('lastSession', 'project-x');

    // fileStore now holds what store1 wrote
    expect(fileStore['lastSession']).toBe('project-x');

    // Reset mocks so second instance re-reads from fileStore (now seeded)
    vi.mocked(fs.readFileSync).mockImplementation(() => JSON.stringify(fileStore));

    // Second instance — a fresh constructor call
    const store2 = new SettingsStore();
    expect(store2.get('lastSession')).toBe('project-x');
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it.skip('5. env var override — N/A: SettingsStore has no per-key env override mechanism', () => {
    // SettingsStore only respects process.env.COPERNICUS_E2E_HOME (config file path).
    // No env var is checked for individual setting values (e.g. no COPERNICUS_MODEL).
    // If you need per-key overrides, SettingsStore.get() would need to check process.env first.
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────

  it.skip('6. missing env var falls back to stored — N/A: SettingsStore has no per-key env override mechanism', () => {
    // Same as test 5: no per-key env override exists, so no fallback to test.
  });
});
