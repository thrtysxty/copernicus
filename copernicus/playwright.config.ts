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
      testMatch: ['**/smoke.test.ts', '**/story-wizard.spec.ts', '**/kanban-drag.spec.ts', '**/agent-run.spec.ts', '**/chat-llm.spec.ts', '**/story-create.spec.ts'],
    },
    {
      name: 'functional',
      testMatch: ['**/workflow.test.ts', '**/onboarding.test.ts', '**/debug.test.ts', '**/settings.test.ts', '**/navigation.test.ts', '**/hub-ipc.test.ts', '**/critical-path.test.ts'],
      retries: 2,
    },
    {
      name: 'screenshots',
      testMatch: '**/screenshots.test.ts',
      // Screenshots tests are slow — longer per-test timeout.
      timeout: 90_000,
    },
    {
      name: 'views',
      testMatch: '**/views/**/*.agent.test.ts',
      timeout: 120_000,
      retries: 0,
    },
  ],
  // Require a built app. Run `npm run build:app` first.
  // globalSetup: './e2e/global-setup.ts',
})
