import { test, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerDbMcpHandlers } from './db-mcp-handlers'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (cb) => {
    try {
      const data = await cb()
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })
}))

vi.mock('../mcp-database-client', () => ({
  getDbMcpClient: vi.fn(() => Promise.resolve({
    callTool: vi.fn(async ({ name }) => {
      return { success: true, tool: name }
    })
  }))
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test('db:query restricts write operations', async () => {
  registerDbMcpHandlers()

  const queryHandlerArgs = vi.mocked(ipcMain.handle).mock.calls.find(call => call[0] === 'db:query')
  expect(queryHandlerArgs).toBeDefined()

  const handler = queryHandlerArgs![1] as any
  const resultSelect = await handler({} as any, 'SELECT * FROM test')
  expect(resultSelect.ok).toBe(true)

  const resultInsert = await handler({} as any, 'INSERT INTO test VALUES (1)')
  expect(resultInsert.ok).toBe(false)
  expect(resultInsert.error).toMatch(/only SELECT statements permitted/i)
})

test('db:search-episodes gets registered', async () => {
  registerDbMcpHandlers()

  const searchHandlerArgs = vi.mocked(ipcMain.handle).mock.calls.find(call => call[0] === 'db:search-episodes')
  expect(searchHandlerArgs).toBeDefined()
})
