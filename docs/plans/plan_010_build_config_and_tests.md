# Execution Plan 010: Build Config, Toolchain, and Baseline Tests
**Sprint:** 1 (Copernicus-specific)
**Agent Role:** Senior Developer (DevOps / TypeScript)
**Story:** 102, AC §5 and §6
**Prerequisite:** Plans 007 and 009 complete (clean compile required)
**Date Authored:** 2026-02-25

---

## Context

The Copernicus build toolchain has three critical gaps that prevent basic CI:

1. `eslint` is not installed — `make lint` / `npm run lint` fails immediately
2. `vitest` is not installed and `vitest.config.ts` is empty — `make test` fails
3. `@types/node` is missing — TypeScript Node.js API calls have no type checking

Additionally:
- `electron-builder` config is missing `asar` and `asarUnpack` (required for `node-pty`)
- `electron/main.ts` applies macOS-only `vibrancy` settings without a platform check
- `state-ledger.test.ts` is a completely empty file — no test coverage for the DB layer

---

## Task 1: Install Missing Development Dependencies

**Step 1: Read `copernicus/package.json` in full** to understand the current
`devDependencies` block and the `scripts` section.

**Step 2: Install missing packages:**

```bash
cd /Users/dadmin/Projects/agentic-platform/copernicus

# ESLint and TypeScript plugin
npm install --save-dev \
  eslint \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-plugin-react \
  eslint-plugin-react-hooks

# Vitest and testing utilities
npm install --save-dev \
  vitest \
  @vitest/coverage-v8 \
  @testing-library/react \
  @testing-library/user-event \
  jsdom

# Missing type definitions
npm install --save-dev \
  @types/node \
  @types/js-yaml

# YAML parser (runtime dep, needed for auth-manager fix in plan_009)
npm install js-yaml
```

**Step 3: Verify packages appear in `package.json` after install:**

```bash
grep -E "eslint|vitest|@types/node" package.json
```

---

## Task 2: Create `.eslintrc.json`

### File: `copernicus/.eslintrc.json` (NEW)

```json
{
  "root": true,
  "env": {
    "browser": true,
    "es2022": true,
    "node": true
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    },
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint",
    "react",
    "react-hooks"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/no-require-imports": "warn",
    "no-console": "off"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  },
  "ignorePatterns": [
    "dist/",
    "dist-electron/",
    "release/",
    "node_modules/",
    "*.js"
  ]
}
```

**Step 3: Verify `npm run lint` runs without crashing (warnings are OK, errors are not):**

```bash
cd copernicus && npm run lint 2>&1 | tail -20
```

Fix any errors (not warnings) before proceeding. Common ones:
- `no-undef` for Electron globals — add to `env` or add globals
- `@typescript-eslint/no-require-imports` for dynamic requires — add inline disable comment

---

## Task 3: Configure Vitest

### File: `copernicus/vitest.config.ts`

The file currently contains only a blank line. Replace it:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Use jsdom for React component tests
    environment: 'jsdom',

    // Setup files run before each test file
    setupFiles: ['./src/test/setup.ts'],

    // Include all test files
    include: [
      'electron/**/*.test.ts',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
    ],

    // Exclude build artifacts
    exclude: [
      'node_modules',
      'dist',
      'dist-electron',
      'release',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'electron/**/*.ts',
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      exclude: [
        'electron/main.ts',       // Electron main — hard to unit test
        'electron/preload.ts',    // Preload — requires Electron context
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

### File: `copernicus/src/test/setup.ts` (NEW)

```typescript
/**
 * Vitest global test setup.
 * Runs before every test file.
 */
import '@testing-library/jest-dom'

// Mock Electron IPC for renderer tests
// Tests that need real IPC should use integration tests, not unit tests
vi.mock('../renderer/global.d.ts', () => ({}))

// Silence console.error in tests unless it's a real error
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress React key warnings and act() warnings in tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('act(') || args[0].includes('Warning:'))
    ) {
      return
    }
    originalError(...args)
  }
})

afterAll(() => {
  console.error = originalError
})
```

**Verify test runner works:**

```bash
cd copernicus && npx vitest run --reporter=verbose 2>&1 | head -30
```

It may collect zero tests at this point — that's OK. It must not crash.

---

## Task 4: Write Baseline Tests for StateLedger

### File: `copernicus/electron/db/state-ledger.test.ts`

**Step 1: Read `copernicus/electron/db/state-ledger.ts` in full.**

Note: the constructor signature, all public methods and their parameters,
the database path (likely uses app.getPath which is not available in tests),
and the schema.

**Step 2: Note the Electron dependency issue.**

`state-ledger.ts` likely imports from `electron` (e.g., `app.getPath`). In Vitest,
Electron is not available. You must either:
- Mock the Electron import
- Accept a `dbPath` parameter in the constructor (prefer this)

**Step 3: Check if StateLedger accepts a custom `dbPath`.**

Read the constructor. If it hardcodes the path via `app.getPath()`, add an optional
override:

```typescript
constructor(dbPath?: string) {
  this.dbPath = dbPath ?? path.join(app.getPath('userData'), 'state.db')
  // ...
}
```

Add this change to `state-ledger.ts` if it doesn't already accept `dbPath`.

**Step 4: Write the tests using an in-memory SQLite database.**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { StateLedger } from './state-ledger'

// Use a temp directory for test databases
const TEST_DB_DIR = path.join(os.tmpdir(), 'copernicus-test-db')

describe('StateLedger', () => {
  let ledger: StateLedger
  let dbPath: string

  beforeEach(() => {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true })
    dbPath = path.join(TEST_DB_DIR, `test-${Date.now()}.db`)
    ledger = new StateLedger(dbPath)
  })

  afterEach(() => {
    // Clean up test database
    try { fs.unlinkSync(dbPath) } catch { /* ignore */ }
  })

  describe('logIntent()', () => {
    it('inserts an intent and returns a numeric rowid', () => {
      const id = ledger.logIntent('Test intent', 'pending', 'claude')
      expect(typeof id).toBe('number')
      expect(id).toBeGreaterThan(0)
    })

    it('accepts default agent_id', () => {
      const id = ledger.logIntent('Another intent')
      expect(id).toBeGreaterThan(0)
    })
  })

  describe('logEvent()', () => {
    it('inserts a PTY output event', () => {
      const id = ledger.logEvent('pty_output', 'terminal output here', 'claude')
      expect(typeof id).toBe('number')
      expect(id).toBeGreaterThan(0)
    })
  })

  describe('searchMemory()', () => {
    it('returns empty array when no memory exists', () => {
      const results = ledger.searchMemory('nonexistent query')
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })
  })

  describe('registerAsset()', () => {
    it('registers a new asset without throwing', () => {
      expect(() => {
        ledger.registerAsset(
          'TestComponent',
          'src/renderer/components/test.tsx',
          'React component'
        )
      }).not.toThrow()
    })
  })

  describe('schema initialisation', () => {
    it('creates a valid database with required tables', () => {
      // If we can call logIntent without error, schema was created correctly
      expect(() => {
        ledger.logIntent('schema test', 'pending')
      }).not.toThrow()
    })

    it('can open an existing database without re-initialising', () => {
      ledger.logIntent('first entry', 'pending')
      // Open the same database again — should not throw or corrupt data
      const ledger2 = new StateLedger(dbPath)
      const id = ledger2.logIntent('second entry', 'pending')
      expect(id).toBeGreaterThan(1)
    })
  })
})
```

> Adapt method names (`logIntent`, `logEvent`, `searchMemory`, `registerAsset`) to match
> the ACTUAL method signatures you read in `state-ledger.ts`. Do not assume names.

**Step 5: Run the tests:**

```bash
cd copernicus && npx vitest run electron/db/state-ledger.test.ts --reporter=verbose
```

All 6+ tests must pass.

---

## Task 5: Fix electron-builder `asar` Config

### File: `copernicus/package.json`

**Step 1: Read `package.json` in full**, specifically the `build` section.

**Step 2: Add `asar` and `asarUnpack` to the `build` block:**

```json
"build": {
  "appId": "com.copernicus.ide",
  "productName": "COPERNICUS",
  "asar": true,
  "asarUnpack": [
    "**/node_modules/node-pty/**",
    "**/node_modules/better-sqlite3/**"
  ],
  ...existing config...
}
```

> `node-pty` and `better-sqlite3` are native Node modules. They must be excluded from
> the asar archive (`asarUnpack`) so they can be loaded as native binaries.
> Without this, the packaged app will crash with `MODULE_NOT_FOUND` for PTY and DB.

---

## Task 6: Add Platform Guard for macOS Vibrancy

### File: `copernicus/electron/main.ts`

**Step 1: Read the `createWindow()` function.**

Find the `BrowserWindow` creation with `vibrancy: 'under-window'` and
`visualEffectState: 'active'`.

**Step 2: Wrap macOS-only properties:**

```typescript
// BEFORE:
win = new BrowserWindow({
  width: 1200,
  height: 800,
  backgroundColor: '#050505',
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 10, y: 10 },
  vibrancy: 'under-window',
  visualEffectState: 'active',
  ...
})

// AFTER:
const macOSWindowOptions = process.platform === 'darwin' ? {
  titleBarStyle: 'hiddenInset' as const,
  trafficLightPosition: { x: 10, y: 10 },
  vibrancy: 'under-window' as const,
  visualEffectState: 'active' as const,
} : {}

win = new BrowserWindow({
  width: 1200,
  height: 800,
  backgroundColor: '#050505',
  ...macOSWindowOptions,
  ...
})
```

---

## Task 7: Final Verification

**Step 1: TypeScript compile check:**

```bash
cd copernicus && npx tsc --noEmit 2>&1
```

Must exit 0 with no errors.

**Step 2: Lint check:**

```bash
cd copernicus && npm run lint 2>&1 | grep -E "^.*error" | head -20
```

Must have zero errors (warnings allowed).

**Step 3: Test run:**

```bash
cd copernicus && npm test 2>&1
```

Must collect ≥ 6 tests and all pass.

**Step 4: Dev launch:**

```bash
cd copernicus && npm run dev
```

App must open without console errors.

---

## Completion Checklist

- [ ] `eslint`, `@typescript-eslint/*`, `eslint-plugin-react*` in `devDependencies`
- [ ] `vitest`, `@vitest/coverage-v8`, `@testing-library/*`, `jsdom` in `devDependencies`
- [ ] `@types/node`, `@types/js-yaml` in `devDependencies`
- [ ] `js-yaml` in `dependencies`
- [ ] `copernicus/.eslintrc.json` created
- [ ] `copernicus/vitest.config.ts` populated (was empty)
- [ ] `copernicus/src/test/setup.ts` created
- [ ] `state-ledger.test.ts` has ≥ 6 passing tests
- [ ] `package.json` build config has `asar: true` and `asarUnpack` for native modules
- [ ] `electron/main.ts` vibrancy/visualEffectState wrapped in `platform === 'darwin'`
- [ ] `npm run lint` exits 0 (no errors)
- [ ] `npm test` collects ≥ 6 tests, all pass
- [ ] `npx tsc --noEmit` exits 0

**Commit message:**
```
chore(build): install missing toolchain deps and establish test baseline

- Install eslint, @typescript-eslint, eslint-plugin-react, vitest, @types/node
- Create .eslintrc.json with TypeScript + React rules
- Populate vitest.config.ts with jsdom env, coverage, and path aliases
- Create src/test/setup.ts global test setup
- Write 6 baseline tests for StateLedger database layer
- Add asar:true and asarUnpack for node-pty and better-sqlite3 to electron-builder
- Wrap macOS-only vibrancy settings in process.platform guard
```
