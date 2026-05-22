import { describe, it, expect } from 'vitest'
import { unwrapIpc } from './ipc'

describe('unwrapIpc', () => {
  it('returns null when input is null', () => {
    expect(unwrapIpc(null)).toBeNull()
  })

  it('returns undefined when input is undefined', () => {
    expect(unwrapIpc(undefined)).toBeUndefined()
  })

  it('returns non-object inputs as-is', () => {
    expect(unwrapIpc(123)).toBe(123)
    expect(unwrapIpc('hello')).toBe('hello')
    expect(unwrapIpc(true)).toBe(true)
  })

  it('returns object inputs without ok property as-is', () => {
    const input = { foo: 'bar' }
    expect(unwrapIpc(input)).toBe(input)
  })

  it('returns data when ok is true', () => {
    const input = { ok: true, data: { value: 42 } }
    expect(unwrapIpc(input)).toEqual({ value: 42 })
  })

  it('returns undefined when ok is true and data is missing', () => {
    const input = { ok: true }
    expect(unwrapIpc(input)).toBeUndefined()
  })

  it('throws error when ok is false with error message', () => {
    const input = { ok: false, error: 'something went wrong' }
    expect(() => unwrapIpc(input)).toThrow('something went wrong')
  })

  it('throws default error when ok is false and error message is missing', () => {
    const input = { ok: false }
    expect(() => unwrapIpc(input)).toThrow('IPC call failed')
  })
})
