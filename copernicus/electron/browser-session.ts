import type { Browser, Page } from 'playwright-core'

export interface BrowserSession {
  browser: Browser | null
  page: Page | null
}

export const browserSession: BrowserSession = {
  browser: null,
  page: null,
}
