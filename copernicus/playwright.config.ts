import { defineConfig } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  timeout: 60_000,
  retries: 0,
  // Run test files sequentially — single Electron instance at a time.
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: '**/smoke.test.ts',
    },
    {
      name: 'screenshots',
      testMatch: '**/screenshots.test.ts',
      // Screenshots tests are slow — longer per-test timeout.
      timeout: 90_000,
    },
  ],
  // Require a built app. Run `npm run build:app` first.
  // globalSetup: './e2e/global-setup.ts',
})
