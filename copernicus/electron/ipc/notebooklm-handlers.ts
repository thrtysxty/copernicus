import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'
import { stateLedger } from '../db/state-ledger'
import { spawn } from 'node:child_process'

export function register(_deps: IpcHandlerDeps) {
  ipcMain.handle('nlm:list-notebooks', () =>
    handleIpc(() => stateLedger.getNlmNotebooks())
  )

  ipcMain.handle('nlm:register-notebook', (_e, notebook: { id: string; name: string; domain: string; description: string }) =>
    handleIpc(() => stateLedger.registerNlmNotebook(notebook))
  )

  ipcMain.handle('nlm:remove-notebook', (_e, id: string) =>
    handleIpc(() => stateLedger.removeNlmNotebook(id))
  )

  ipcMain.handle('notebooklm:notebook-contents', async (_e, notebookId: string) =>
    handleIpc(async () => {
      const authHeader = _deps.authManager.getApiKey('jules');
      const response = await fetch(`http://localhost:5001/api/notebooklm/notebooks/${notebookId}/contents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { 'Authorization': `Bearer ${authHeader}` } : {})
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch notebook contents: ${response.status}`);
      }
      return await response.json();
    })
  )

  ipcMain.handle('nlm:query', async (_e, _args: { notebookId: string; question: string }) =>
    handleIpc(async () => {
      return new Promise((resolve) => {
        // const cookieFile = path.join(os.homedir(), '.secrets', 'nlm-cookies.json')

        const script = `
import sys
import json
import asyncio
try:
    from notebooklm import NotebookLM
except ImportError:
    print(json.dumps({"error": "NbLM bridge unavailable - notebooklm-py not installed"}))
    sys.exit(0)

async def main():
    try:
        # Minimal snippet demonstrating how notebooklm-py might be queried
        print(json.dumps({"answer": "NotebookLM response mock", "sources": []}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
`

        const py = spawn('python3', ['-c', script])
        let output = ''
        let errOutput = ''

        py.stdout.on('data', (data) => {
          output += data.toString()
        })

        py.stderr.on('data', (data) => {
          errOutput += data.toString()
        })

        py.on('close', (code) => {
          if (code !== 0) {
            resolve({ error: 'NbLM bridge unavailable', details: errOutput })
            return
          }

          try {
            const result = JSON.parse(output.trim())
            if (result.error) {
              resolve({ error: 'NbLM bridge unavailable', details: result.error })
            } else {
              resolve(result)
            }
          } catch (e) {
            resolve({ error: 'NbLM bridge unavailable', details: 'Parse error' })
          }
        })

        py.on('error', (err) => {
           resolve({ error: 'NbLM bridge unavailable', details: err.message })
        })
      })
    })
  )
}
