import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test/setup.ts'],
    // Scope tests to project source only — excludes release/ and node_modules/.
    // state-ledger.test.ts is excluded because better-sqlite3 is compiled for Electron's Node
    // ABI (119) and cannot run under system Node.js vitest (141). Needs electron-mocha.
    include: ['{electron,src}/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'release', '**/electron/db/state-ledger.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/renderer/test/setup.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
