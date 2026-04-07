import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { getDbMcpClient } from '../mcp-database-client'

export function registerDbMcpHandlers(): void {
  ipcMain.handle('db:query', (_e, sql: string) => handleIpc(async () => {
    // Basic SELECT queries to enforce read-only
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error('Read-only: only SELECT statements permitted via MCP')
    }
    const client = await getDbMcpClient()
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: { query: sql }
    })
    return result
  }))

  ipcMain.handle('db:list-tables', (_e) => handleIpc(async () => {
    const client = await getDbMcpClient()
    const result = await client.callTool({
      name: 'list_tables',
      arguments: {}
    })
    return result
  }))

  ipcMain.handle('db:search-episodes', (_e, keyword: string) => handleIpc(async () => {
    const client = await getDbMcpClient()
    const result = await client.callTool({
      name: 'search_episodes',
      arguments: { keyword1: keyword, keyword2: keyword }
    })
    return result
  }))

  ipcMain.handle('db:story-status', (_e, storyId: string) => handleIpc(async () => {
    const client = await getDbMcpClient()
    const result = await client.callTool({
      name: 'story_status',
      arguments: { story_id: storyId }
    })
    return result
  }))

  ipcMain.handle('db:recent-episodes', (_e, n: number, role: string) => handleIpc(async () => {
    const client = await getDbMcpClient()
    const result = await client.callTool({
      name: 'recent_episodes',
      arguments: { n, role }
    })
    return result
  }))

  ipcMain.handle('db:quality-summary', (_e, days: number) => handleIpc(async () => {
    const client = await getDbMcpClient()
    const result = await client.callTool({
      name: 'quality_summary',
      arguments: { days }
    })
    return result
  }))
}
