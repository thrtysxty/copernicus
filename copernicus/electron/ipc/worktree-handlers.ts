import { ipcMain } from 'electron'
import { WorktreeManager } from '../worktree/WorktreeManager'
import { handleIpc } from '../utils/handle-ipc'

export function registerWorktreeHandlers(manager: WorktreeManager): () => void {
  ipcMain.handle('worktree:list',   ()           => handleIpc(() => manager.list()))
  ipcMain.handle('worktree:create', (_e, args)   => handleIpc(() => manager.create(args.branch, args.storyId, args.nodeId, args.mergeMode)))
  ipcMain.handle('worktree:diff',   (_e, {id})   => handleIpc(() => manager.getDiff(id)))
  ipcMain.handle('worktree:merge',  (_e, {id})   => handleIpc(() => manager.merge(id)))
  ipcMain.handle('worktree:remove', (_e, {id})   => handleIpc(() => manager.remove(id)))
  ipcMain.handle('worktree:poll',   ()           => handleIpc(() => manager.poll()))
  return () => ['worktree:list','worktree:create','worktree:diff','worktree:merge','worktree:remove','worktree:poll']
    .forEach(ch => ipcMain.removeHandler(ch))
}
