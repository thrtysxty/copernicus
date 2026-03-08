import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'

import { IpcHandlerDeps } from './deps'

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const { storiesManager, stateLedger } = deps

  // Story Handlers
  ipcMain.handle('stories:list', () => handleIpc('stories:list', [], () => storiesManager.listStories()))
  ipcMain.handle('stories:sync', () => handleIpc('stories:sync', [], () => storiesManager.syncFromDisk()))
  ipcMain.handle('stories:is-repo-targeted', () => handleIpc('stories:is-repo-targeted', [], () => storiesManager.isRepoTargeted()))
  ipcMain.handle('stories:create', (_event, args: string | { title: string; type?: string; epic?: string; priority?: string }) => handleIpc('stories:create', [args], () => {
    const { title, type, epic, priority } = typeof args === 'string'
      ? { title: args, type: undefined, epic: undefined, priority: undefined }
      : args
    return storiesManager.createStory({ title, type, epic, priority })
  }))
  ipcMain.handle('stories:get-content', (_event, id: string) => handleIpc('stories:get-content', [id], () => storiesManager.getStoryContent(id)))
  ipcMain.handle('stories:update-content', (_event, { id, content }: { id: string; content: string }) => handleIpc('stories:update-content', [{ id, content }], () => storiesManager.updateStoryContent(id, content)))
  ipcMain.handle('stories:set-field', (_event, { id, field, value }: { id: string; field: string; value: string }) => handleIpc('stories:set-field', [{ id, field, value }], () => {
    if (!/^story_\d+$/.test(id)) return
    return storiesManager.setField(id, field, value)
  }))
  ipcMain.handle('stories:update', (_event, id: string, status: string) => handleIpc('stories:update', [id, status], () => {
    if (!/^story_\d+$/.test(id)) return;
    return storiesManager.updateStoryStatus(id, status)
  }))
  ipcMain.handle('stories:hydrate', (_event, id: string) => handleIpc('stories:hydrate', [id], () => {
    if (!/^story_\d+$/.test(id)) return;
    const content = storiesManager.getStoryContent(id)
    const filePath = storiesManager.getStoryPath(id)
    win?.webContents.send('editor:open', { path: filePath, content })
    return true
  }))
  ipcMain.handle('stories:delete', (_event, id: string) => handleIpc('stories:delete', [id], () => {
    if (!/^story_\d+$/.test(id)) return;
    return storiesManager.deleteStory(id)
  }))
  ipcMain.handle('stories:archive', (_event, id: string) => handleIpc('stories:archive', [id], () => {
    if (!/^story_\d+$/.test(id)) return;
    return storiesManager.archiveStory(id)
  }))

  ipcMain.handle('stories:throughput', () => handleIpc('stories:throughput', [], () =>
    stateLedger.db.prepare(`
      SELECT strftime('%Y-W%W', updated_at) as week, COUNT(*) as completed
      FROM stories WHERE status = 'COMPLETE' AND updated_at >= date('now', '-84 days')
      GROUP BY week ORDER BY week ASC
    `).all()
  ))

  ipcMain.handle('stories:status-distribution', () => handleIpc('stories:status-distribution', [], () =>
    stateLedger.db.prepare(`
      SELECT status, COUNT(*) as count FROM stories GROUP BY status ORDER BY count DESC
    `).all()
  ))

  ipcMain.handle('stories:bugs-by-assignee', () => handleIpc('stories:bugs-by-assignee', [], () =>
    stateLedger.db.prepare(`
      SELECT COALESCE(assigned_to, 'unassigned') as assignee, COUNT(*) as bug_count
      FROM stories WHERE type = 'bug' GROUP BY assigned_to ORDER BY bug_count DESC
    `).all()
  ))

  // Story scaffold — invoked from command palette
  ipcMain.handle('story:scaffold', (_e, title: string, type = 'Feature') => handleIpc('story:scaffold', [title, type], () => storiesManager.createStory({ title: title?.trim() || 'New Story', type, epic: '', priority: 'P2' }))
  )
}
