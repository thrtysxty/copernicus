/**
 * IPC Envelope Contract Tests (Story 709)
 *
 * Verifies the handleIpc/unwrapIpc envelope contract:
 * - Happy path: { ok: true, data: T }
 * - Error path: { ok: false, error: string }
 *
 * Channel manifest (from ipcMain.handle in electron/):
 * - app:workspace-changed, app:switch-workspace, app:get-env-state
 * - devtime:*, ledger:*, oauth:*, auth:*
 * - git:*, mcp:*, chat:*, memory:*
 * - stories:*, kanban:*, fs:*, terminal:*
 * - lsp:*, workflow:*, extension:*, jules:*
 * - security:*, db:*
 */

import { describe, it, expect } from 'vitest'
import { handleIpc } from '../utils/handle-ipc'
import { unwrapIpc } from '../../src/renderer/types/ipc'

describe('handleIpc', () => {
  it('happy path — returns { ok: true, data: 42 }', async () => {
    const result = await handleIpc(() => 42)
    expect(result).toEqual({ ok: true, data: 42 })
  })

  it('error path — returns { ok: false, error: "boom" }', async () => {
    const result = await handleIpc(() => { throw new Error('boom') })
    expect(result).toEqual({ ok: false, error: 'boom' })
    // Verify no exception escapes
    expect(() => handleIpc(() => { throw new Error('boom') })).not.toThrow()
  })

  it('async happy path — returns { ok: true, data: "hello" }', async () => {
    const result = await handleIpc(async () => 'hello')
    expect(result).toEqual({ ok: true, data: 'hello' })
  })

  it('async error path — returns { ok: false, error: "async fail" }', async () => {
    const result = await handleIpc(async () => { throw new Error('async fail') })
    expect(result).toEqual({ ok: false, error: 'async fail' })
  })

  it('with channel name — channel is captured in log', async () => {
    const result = await handleIpc('stories:list', [], () => [{ id: 'story_001' }])
    expect(result.ok).toBe(true)
    expect((result as { ok: true; data: unknown[] }).data).toEqual([{ id: 'story_001' }])
  })

  it('null return value becomes { ok: true, data: null }', async () => {
    const result = await handleIpc(() => null)
    expect(result).toEqual({ ok: true, data: null })
  })

  it('undefined return value becomes { ok: true, data: undefined }', async () => {
    const result = await handleIpc(() => undefined)
    expect(result).toEqual({ ok: true, data: undefined })
  })
})

describe('unwrapIpc', () => {
  it('happy path — unwraps { ok: true, data: 99 } to 99', () => {
    expect(unwrapIpc<number>({ ok: true, data: 99 })).toBe(99)
  })

  it('error path — throws Error with message', () => {
    expect(() => unwrapIpc({ ok: false, error: 'bad' })).toThrow('bad')
  })

  it('error path — throws "IPC call failed" when no error message', () => {
    expect(() => unwrapIpc({ ok: false })).toThrow('IPC call failed')
  })

  it('null input — returns null without throwing', () => {
    expect(unwrapIpc(null)).toBeNull()
  })

  it('undefined input — returns undefined without throwing', () => {
    expect(unwrapIpc(undefined)).toBeUndefined()
  })

  it('non-IpcResult object — returns the object as-is', () => {
    expect(unwrapIpc(123)).toBe(123)
    expect(unwrapIpc('hello')).toBe('hello')
    expect(unwrapIpc(true)).toBe(true)
  })

  it('plain array — returns as-is', () => {
    expect(unwrapIpc([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('object without ok property — returns as-is', () => {
    expect(unwrapIpc({ value: 42 })).toEqual({ value: 42 })
  })
})