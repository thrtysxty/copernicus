import { ipcMain, BrowserWindow } from 'electron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const execAsync = promisify(exec)
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const cwd = () => deps.settingsStore.get<string>('workspace', process.cwd())

  ipcMain.handle('codebase:text-search', (_e, { query, caseSensitive, regex, wholeWord }: any) =>
    handleIpc('codebase:text-search', [query], async () => {
      const flags = [
        '--json', '--max-count', '5', '--max-filesize', '500K',
        caseSensitive ? '' : '-i',
        regex ? '' : '--fixed-strings',
        wholeWord ? '-w' : '',
        '--glob', '!node_modules', '--glob', '!.git', '--glob', '!dist',
      ].filter(Boolean)
      try {
        const { stdout: out } = await execAsync(`rg ${flags.join(' ')} ${JSON.stringify(query)}`, {
          cwd: cwd(), maxBuffer: 2 * 1024 * 1024
        })
        return out.trim().split('\n').filter(Boolean).map(line => {
          try { return JSON.parse(line) } catch { return null }
        }).filter(Boolean).filter((r: any) => r.type === 'match').map((r: any) => ({
          file: r.data.path.text,
          line: r.data.line_number,
          col: r.data.submatches?.[0]?.start ?? 0,
          text: r.data.lines.text.trim()
        }))
      } catch (e: any) {
        if ((e as any).code === 1 || (e as any).status === 1) return [] // no matches
        throw e
      }
    })
  )

  ipcMain.handle('codebase:semantic-search', (_e, { query, topK = 10 }: any) =>
    handleIpc('codebase:semantic-search', [query], async () => {
      return deps.codebaseIndexer.search(query, topK)
    })
  )
}
