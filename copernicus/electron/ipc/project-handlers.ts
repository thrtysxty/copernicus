import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { stateLedger } from '../db/state-ledger'
import { settingsStore } from '../main'
import log from 'electron-log'

export function registerProjectHandlers() {
  log.info('[Project] Registering IPC handlers')

  ipcMain.handle('project:get-config', () =>
    handleIpc(() => {
      const workspace = settingsStore.get('workspace') as string
      if (!workspace) {
        log.info('[Project] No workspace, returning AGNOSTIC config')
        return { target_device: 'AGNOSTIC' }
      }

      const project = stateLedger.getProjectByPath(workspace)
      if (!project) {
        log.info(`[Project] No project found for ${workspace}, returning AGNOSTIC config`)
        return { target_device: 'AGNOSTIC' }
      }

      log.info(`[Project] Returning config for ${workspace}: ${project.target_device || 'AGNOSTIC'}`)
      return { target_device: project.target_device || 'AGNOSTIC' }
    })
  )

  ipcMain.handle('project:save-config', (_e, { target_device }: { target_device: string }) =>
    handleIpc(() => {
      if (!['MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC'].includes(target_device)) {
        log.error(`[Project] Invalid target_device: ${target_device}`)
        throw new Error(`Invalid target_device: ${target_device}`)
      }

      const workspace = settingsStore.get('workspace') as string
      if (!workspace) {
        log.error('[Project] No active workspace to update')
        throw new Error('No active workspace to update')
      }

      log.info(`[Project] Saving config for ${workspace}: ${target_device}`)
      stateLedger.updateProjectTargetDevice(workspace, target_device)
      return { success: true }
    })
  )
}
