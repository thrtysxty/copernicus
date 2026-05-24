import log from 'electron-log';
import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'

import { IpcHandlerDeps } from './deps'
// @ts-ignore
import { syncUserAction, syncStoryState } from '../../../scripts/agent-daemon/lib/hub.mjs';


export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const { storiesManager, stateLedger } = deps

  // Story Handlers
  ipcMain.handle('stories:list', (_e, filter?: { status?: string }) =>
    handleIpc('stories:list', [filter], () => storiesManager.listStories(filter))
  )
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
    if (!/^story_\d+$/.test(id)) throw new Error(`Invalid story id: ${id}`);
    return storiesManager.setField(id, field, value)
  }))
  ipcMain.handle('stories:update', (_event, id: string, status: string) => handleIpc('stories:update', [id, status], () => {
    if (!/^story_\d+$/.test(id)) throw new Error(`Invalid story id: ${id}`);
    const res = storiesManager.updateStoryStatus(id, status);
    win?.webContents.send('stories:status-changed', { id, status });
    Promise.resolve().then(() => {
      try {
        const match = id.match(/^story_(\d+)$/);
        const storyId = match ? match[1] : id;
        syncUserAction({
          surface: 'story-editor',
          action_type: 'story:status_changed',
          story_id: storyId,
          from_state: null,
          to_state: status,
          notes: 'Status updated via stories:update'
        });
        syncStoryState(storyId, { status });
      } catch (e) { log.error(e); }
    });
    return res;
  }))
  ipcMain.handle('stories:hydrate', (_event, id: string) => handleIpc('stories:hydrate', [id], () => {
    if (!/^story_\d+$/.test(id)) throw new Error(`Invalid story id: ${id}`);
    const content = storiesManager.getStoryContent(id)
    const filePath = storiesManager.getStoryPath(id)
    win?.webContents.send('editor:open', { path: filePath, content })
    return true
  }))
  ipcMain.handle('stories:delete', (_event, id: string) => handleIpc('stories:delete', [id], () => {
    if (!/^story_\d+/.test(id)) throw new Error(`Invalid story id: ${id}`);
    return storiesManager.deleteStory(id)
  }))
  ipcMain.handle('stories:archive', (_event, id: string) => handleIpc('stories:archive', [id], () => {
    if (!/^story_\d+/.test(id)) throw new Error(`Invalid story id: ${id}`);
    return storiesManager.archiveStory(id)
  }))

  ipcMain.handle('stories:target-project', (_e, projectPath: string) =>
    handleIpc('stories:target-project', [projectPath], () => {
      const imported = storiesManager.targetProject(projectPath)
      return { imported }
    })
  )

  ipcMain.handle('stories:import-from-path', (_e, importPath: string) =>
    handleIpc('stories:import-from-path', [importPath], () => {
      const imported = storiesManager.targetProject(importPath)
      return { imported }
    })
  )

  ipcMain.handle('stories:throughput', () => handleIpc('stories:throughput', [], () => stateLedger.getStoriesThroughput()))

  ipcMain.handle('stories:status-distribution', () => handleIpc('stories:status-distribution', [], () => stateLedger.getStoriesStatusDistribution()))

  ipcMain.handle('stories:bugs-by-assignee', () => handleIpc('stories:bugs-by-assignee', [], () => stateLedger.getStoriesBugsByAssignee()))

  ipcMain.handle('stories:set-status', (_e, { storyNumber, status }: { storyNumber: number, status: string }) =>
    handleIpc('stories:set-status', [storyNumber, status], async () => {
      await storiesManager.setStoryStatus(storyNumber, status)
      win.webContents.send('stories:status-changed', { storyNumber, status })
      Promise.resolve().then(() => {
        try {
          syncUserAction({
            surface: 'story-editor',
            action_type: 'story:status_changed',
            story_id: storyNumber.toString(),
            from_state: null,
            to_state: status,
            notes: 'Status updated via stories:set-status'
          });
          syncStoryState(storyNumber.toString(), { status });
        } catch (e) { log.error(e); }
      });
      return { ok: true }
    })
  )

  // Story scaffold — invoked from command palette
  ipcMain.handle('story:scaffold', (_e, title: string, type = 'Feature') => handleIpc('story:scaffold', [title, type], () => storiesManager.createStory({ title: title?.trim() || 'New Story', type, epic: '', priority: 'P2' }))
  )
}
