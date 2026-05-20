import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleIpc } from './handle-ipc'
import log from 'electron-log'

// Mock electron-log to capture error calls
vi.mock('electron-log', () => ({
  default: {
    error: vi.fn(),
  },
}))

describe('handleIpc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('success envelope', () => {
    it('should return { ok: true, data: T } for synchronous success', async () => {
      const result = await handleIpc('test:sync', [], () => 'hello')
      expect(result).toEqual({ ok: true, data: 'hello' })
    })

    it('should return { ok: true, data: T } for async success', async () => {
      const result = await handleIpc('test:async', [], async () => Promise.resolve(42))
      expect(result).toEqual({ ok: true, data: 42 })
    })

    it('should return complex data types correctly', async () => {
      const testData = { id: 1, name: 'test', nested: { value: true } }
      const result = await handleIpc('test:object', [], () => testData)
      expect(result).toEqual({ ok: true, data: testData })
    })
  })

  describe('error envelope', () => {
    it('should return { ok: false, error: string } for synchronous error', async () => {
      const result = await handleIpc('test:error', [], () => {
        throw new Error('Something went wrong')
      })
      expect(result).toEqual({ ok: false, error: 'Something went wrong' })
    })

    it('should return { ok: false, error: string } for async rejection', async () => {
      const result = await handleIpc('test:reject', [], async () => {
        throw new Error('Async failure')
      })
      expect(result).toEqual({ ok: false, error: 'Async failure' })
    })

    it('should handle Promise.reject directly', async () => {
      const result = await handleIpc('test:promise-reject', [], () =>
        Promise.reject(new Error('Rejected promise'))
      )
      expect(result).toEqual({ ok: false, error: 'Rejected promise' })
    })
  })

  describe('error-to-string conversion', () => {
    it('should convert Error objects to their message', async () => {
      const result = await handleIpc('test:error-obj', [], () => {
        throw new Error('Error message here')
      })
      expect(result).toEqual({ ok: false, error: 'Error message here' })
    })

    it('should convert non-Error objects to strings', async () => {
      const result = await handleIpc('test:string-error', [], () => {
        throw 'Plain string error'
      })
      expect(result).toEqual({ ok: false, error: 'Plain string error' })
    })

    it('should handle number errors', async () => {
      const result = await handleIpc('test:number-error', [], () => {
        throw 404
      })
      expect(result).toEqual({ ok: false, error: '404' })
    })

    it('should handle null/undefined errors', async () => {
      const nullResult = await handleIpc('test:null-error', [], () => {
        throw null
      })
      expect(nullResult).toEqual({ ok: false, error: 'null' })

      const undefinedResult = await handleIpc('test:undefined-error', [], () => {
        throw undefined
      })
      expect(undefinedResult).toEqual({ ok: false, error: 'undefined' })
    })

    it('should handle object errors', async () => {
      const result = await handleIpc('test:object-error', [], () => {
        throw { code: 'ENOENT', message: 'File not found' }
      })
      expect(result).toEqual({ ok: false, error: '[object Object]' })
    })
  })

  describe('channel name logging', () => {
    it('should log error with channel name for string channel', async () => {
      await handleIpc('inventory:read', ['arg1'], () => {
        throw new Error('Test error')
      })

      expect(log.error).toHaveBeenCalledWith(
        '[ipc:inventory:read]',
        { args: ['arg1'], message: 'Test error' }
      )
    })

    it('should log with "unknown" channel for function-only form', async () => {
      await handleIpc(() => {
        throw new Error('Fn error')
      })

      expect(log.error).toHaveBeenCalledWith(
        '[ipc:unknown]',
        { args: [], message: 'Fn error' }
      )
    })

    it('should log empty args array when no args provided', async () => {
      await handleIpc('test:no-args', undefined, () => {
        throw new Error('No args error')
      })

      expect(log.error).toHaveBeenCalledWith(
        '[ipc:test:no-args]',
        { args: [], message: 'No args error' }
      )
    })
  })

  describe('function-only signature', () => {
    it('should handle function-only form (no channel string)', async () => {
      const result = await handleIpc(() => 'direct result')
      expect(result).toEqual({ ok: true, data: 'direct result' })
    })

    it('should handle async function-only form', async () => {
      const result = await handleIpc(async () => {
        return await Promise.resolve('async direct')
      })
      expect(result).toEqual({ ok: true, data: 'async direct' })
    })

    it('should handle error in function-only form', async () => {
      const result = await handleIpc(() => {
        throw new Error('Direct error')
      })
      expect(result).toEqual({ ok: false, error: 'Direct error' })
    })
  })

  describe('type safety', () => {
    it('should preserve generic type in success case', async () => {
      const result = await handleIpc<number>('test:number', [], () => 123)
      if (result.ok) {
        expect(typeof result.data).toBe('number')
        expect(result.data).toBe(123)
      }
    })

    it('should work with object types', async () => {
      interface UserData {
        id: number
        name: string
      }
      const result = await handleIpc<UserData>('test:user', [], () => ({
        id: 1,
        name: 'Alice',
      }))
      if (result.ok) {
        expect(result.data.id).toBe(1)
        expect(result.data.name).toBe('Alice')
      }
    })
  })
})
