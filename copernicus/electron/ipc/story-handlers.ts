import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'

export function register(win: BrowserWindow, deps: any) {
  const { storiesManager, stateLedger } = deps

  // Story Handlers
  ipcMain.handle('stories:list', () => handleIpc(() => storiesManager.listStories()))
  ipcMain.handle('stories:sync', () => handleIpc(() => storiesManager.syncFromDisk()))
  ipcMain.handle('stories:is-repo-targeted', () => handleIpc(() => storiesManager.isRepoTargeted()))
  ipcMain.handle('stories:create', (_event, args) => handleIpc(() => {
    const { title, type, epic, priority } = typeof args === 'string'
      ? { title: args, type: undefined, epic: undefined, priority: undefined }
      : args
    return storiesManager.createStory({ title, type, epic, priority })
  }))
  ipcMain.handle('stories:get-content', (_event, id) => handleIpc(() => storiesManager.getStoryContent(id)))
  ipcMain.handle('stories:update-content', (_event, { id, content }) => handleIpc(() => storiesManager.updateStoryContent(id, content)))
  ipcMain.handle('stories:set-field', (_event, { id, field, value }) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return
    return storiesManager.setField(id, field, value)
  }))
  ipcMain.handle('stories:update', (_event, id, status) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return;
    return storiesManager.updateStoryStatus(id, status)
  }))
  ipcMain.handle('stories:hydrate', (_event, id) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return;
    const content = storiesManager.getStoryContent(id)
    const filePath = storiesManager.getStoryPath(id)
    win?.webContents.send('editor:open', { path: filePath, content })
    return true
  }))
  ipcMain.handle('stories:delete', (_event, id) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return;
    return storiesManager.deleteStory(id)
  }))
  ipcMain.handle('stories:archive', (_event, id) => handleIpc(() => {
    if (!/^story_\d+$/.test(id)) return;
    return storiesManager.archiveStory(id)
  }))

  ipcMain.handle('stories:throughput', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT strftime('%Y-W%W', updated_at) as week, COUNT(*) as completed
      FROM stories WHERE status = 'COMPLETE' AND updated_at >= date('now', '-84 days')
      GROUP BY week ORDER BY week ASC
    `).all()
  ))

  ipcMain.handle('stories:status-distribution', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT status, COUNT(*) as count FROM stories GROUP BY status ORDER BY count DESC
    `).all()
  ))

  ipcMain.handle('stories:bugs-by-assignee', () => handleIpc(() =>
    stateLedger.db.prepare(`
      SELECT COALESCE(assigned_to, 'unassigned') as assignee, COUNT(*) as bug_count
      FROM stories WHERE type = 'bug' GROUP BY assigned_to ORDER BY bug_count DESC
    `).all()
  ))

  // Story scaffold — invoked from command palette
  ipcMain.handle('story:scaffold', (_e, title: string, type = 'Feature') =>
    handleIpc(() => storiesManager.createStory({ title: title?.trim() || 'New Story', type, epic: '', priority: 'P2' }))
  )
}
