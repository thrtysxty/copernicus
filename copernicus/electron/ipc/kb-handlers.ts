// Story 566 — KB IPC Handlers
// STUB: Full implementation delivered by Jules

import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'

export function registerKbHandlers(): void {
  // kb:list-articles — returns all articles grouped by section (id, title, section, tags; no body)
  ipcMain.handle('kb:list-articles', () =>
    handleIpc('kb:list-articles', [], () => {
      // TODO (Story 566): query intelligence_documents where source IN ('curated','user','community')
      throw new Error('Not implemented')
    })
  )

  // kb:get-article — returns full article including body by id
  ipcMain.handle('kb:get-article', (_e, id: string) =>
    handleIpc('kb:get-article', [id], () => {
      // TODO (Story 566): query intelligence_documents by id
      throw new Error('Not implemented')
    })
  )

  // kb:search — full-text search, returns title, section, id, excerpt
  ipcMain.handle('kb:search', (_e, query: string) =>
    handleIpc('kb:search', [query], () => {
      // TODO (Story 566): FTS query over intelligence_documents
      throw new Error('Not implemented')
    })
  )
}
