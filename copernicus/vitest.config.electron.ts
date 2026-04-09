/**
 * Vitest config for tests that require Electron's Node.js ABI.
 *
 * Run with:
 *   npm run test:electron
 *
 * This config is executed via `ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs`
 * so libsql (compiled for Electron's Node ABI) loads correctly.
 *
 * Uses `pool: 'forks'` — required for native .node modules which are not thread-safe.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    // Node environment — these are main-process tests, not renderer.
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    // Only include main-process tests that need the Electron ABI.
    include: ['electron/db/**/*.test.ts'],
    exclude: ['node_modules', 'release'],
    coverage: {
      reporter: ['text'],
      include: ['electron/db/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
