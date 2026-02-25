/// <reference types="vitest/globals" />

/**
 * Vitest global test setup.
 * Runs before every test file.
 */

// Suppress React act() and prop-types warnings in test output
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
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
