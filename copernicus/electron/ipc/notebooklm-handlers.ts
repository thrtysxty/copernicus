import { app, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'

interface NotebookEntry {
  id: string
  title: string
}

export function register(deps: IpcHandlerDeps) {
  ipcMain.handle('notebooklm:status', () =>
    handleIpc(async () => {
      const token = await deps.authManager.getApiKey('notebooklm')
      const response = await fetch('http://localhost:5001/api/notebooklm/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch NotebookLM status: ${response.statusText}`)
      }
      return response.json()
    })
  )

  ipcMain.handle('notebooklm:list-notebooks', () =>
    handleIpc(async () => {
      const token = await deps.authManager.getApiKey('notebooklm')
      const response = await fetch('http://localhost:5001/api/notebooklm/notebooks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error(`Failed to list NotebookLM notebooks: ${response.statusText}`)
      }
      return response.json() as Promise<NotebookEntry[]>
    })
  )

  ipcMain.handle('notebooklm:setup', () =>
    handleIpc(async () => {
      return new Promise<void>((resolve, reject) => {
        // notebooklm login might need terminal, spawn detached with shell: true
        let command = 'notebooklm'
        let args = ['login']
        let options = {
          shell: true,
          detached: true,
          stdio: 'ignore' as const
        }

        if (app.isPackaged) {
          const binaryName = process.platform === 'win32' ? 'copernicus-backend.exe' : 'copernicus-backend'
          command = path.join(process.resourcesPath, binaryName)
          args = ['--notebooklm-login']
          options.shell = false // Packaged binary doesn't need shell execution
        } else {
          // Dev mode
          command = 'notebooklm login'
          args = []
        }

        const child = spawn(command, args, options)

        child.on('error', (err) => {
          reject(err)
        })

        child.on('exit', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`NotebookLM setup failed with exit code ${code}`))
          }
        })
      })
    })
  )
}
