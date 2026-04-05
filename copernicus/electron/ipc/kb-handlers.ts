import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { stateLedger } from '../db/state-ledger';

export function registerKbHandlers(): void {
  ipcMain.handle('kb:list-articles', async () =>
    handleIpc(async () => {
      const articles = stateLedger.listKbArticles();
      return articles;
    })
  );

  ipcMain.handle('kb:get-article', async (_e, id: string) =>
    handleIpc(async () => {
      const article = stateLedger.getKbArticle(id);
      return article;
    })
  );

  ipcMain.handle('kb:search', async (_e, query: string) =>
    handleIpc(async () => {
      const results = stateLedger.searchKbArticles(query);
      return results;
    })
  );
}
