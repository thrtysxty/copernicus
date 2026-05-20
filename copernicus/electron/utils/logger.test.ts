import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron-log/main', () => {
  const fileTransport = { level: 'silly' as string }
  const consoleTransport = { level: 'silly' as string }

  return {
    default: {
      transports: {
        file: fileTransport,
        console: consoleTransport,
      },
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      log: vi.fn(),
    },
  }
})

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.NODE_ENV = 'test'
  })

  it('should export a logger with standard log levels', async () => {
    const { default: log } = await import('./logger')
    expect(log).toBeDefined()
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.debug).toBe('function')
  })

  it('should have transports configured', async () => {
    const { default: log } = await import('./logger')
    expect(log.transports).toBeDefined()
    expect(log.transports.file).toBeDefined()
    expect(log.transports.console).toBeDefined()
  })

  it('should set file transport level to info', async () => {
    vi.resetModules()
    await import('./logger')
    const { default: log } = await import('electron-log/main')
    expect(log.transports.file.level).toBe('info')
  })

  it('should configure console transport level based on NODE_ENV', async () => {
    process.env.NODE_ENV = 'test'
    vi.resetModules()
    await import('./logger')
    const { default: log } = await import('electron-log/main')
    expect(log.transports.console.level).toBe('warn')
  })

  it('should set console to debug in development mode', async () => {
    process.env.NODE_ENV = 'development'
    vi.resetModules()
    await import('./logger')
    const { default: log } = await import('electron-log/main')
    expect(log.transports.console.level).toBe('debug')
  })
})
