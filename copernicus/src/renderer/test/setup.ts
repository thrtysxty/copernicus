/// <reference types="vitest/globals" />
import '@testing-library/jest-dom'

/**
 * Vitest global test setup.
 * Runs before every test file.
 */

// Suppress React act() and prop-types warnings in test output
const originalError = globalThis["console"]["error"]
beforeAll(() => {
  globalThis["console"]["error"] = (...args: unknown[]) => {
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
  globalThis["console"]["error"] = originalError
})
