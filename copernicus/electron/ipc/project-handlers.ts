import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { stateLedger } from '../db/state-ledger'
import { settingsStore } from '../main'

export function registerProjectHandlers() {
  ipcMain.handle('project:get-config', () =>
    handleIpc(() => {
      const workspace = settingsStore.get('workspace') as string
      if (!workspace) return { target_device: 'AGNOSTIC' }

      const project = stateLedger.getProjectByPath(workspace)
      if (!project) return { target_device: 'AGNOSTIC' }

      return { target_device: project.target_device || 'AGNOSTIC' }
    })
  )

  ipcMain.handle('project:save-config', (_e, { target_device }: { target_device: string }) =>
    handleIpc(() => {
      if (!['MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC'].includes(target_device)) {
        throw new Error(`Invalid target_device: ${target_device}`)
      }

      const workspace = settingsStore.get('workspace') as string
      if (!workspace) throw new Error('No active workspace to update')

      stateLedger.updateProjectTargetDevice(workspace, target_device)
      return { success: true }
    })
  )
}
