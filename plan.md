1. **Explore & Verify Files**: Verify all required seed articles exist in `copernicus/resources/kb/` and match the requirements. If not, generate them with stub content and correct YAML frontmatter.
2. **Schema Migration & StateLedger Update**:
   - Update `copernicus/electron/db/schema.ts` `intelligence_documents` table creation string to add: `section TEXT`, `tags TEXT`, `source TEXT DEFAULT 'curated'`, `version INTEGER DEFAULT 1`, `excerpt TEXT`.
   - Update `copernicus/electron/db/state-ledger.ts` to include `ALTER TABLE intelligence_documents ADD COLUMN ...` migrations.
   - Update `stateLedger.getIntelDoc()` and `stateLedger.listIntelDocs()` to include new properties if necessary, though perhaps we can just add KB-specific methods to `state-ledger.ts` like `upsertKbArticle()`, `getKbArticle()`, `searchKbArticles()`, `listKbArticles()`.
3. **Knowledge Base Loader**:
   - Create `copernicus/electron/kb/kb-loader.ts`.
   - Function `loadKnowledgeBase()` uses `js-yaml` to parse frontmatter from files in `copernicus/resources/kb/`.
   - Upserts into `intelligence_documents` by comparing version, calling `stateLedger.upsertKbArticle(...)`.
4. **IPC Handlers**:
   - Create `copernicus/electron/ipc/kb-handlers.ts`.
   - Define `registerKbHandlers()` with `ipcMain.handle` wrapped in `handleIpc`.
   - Channels: `kb:list-articles`, `kb:get-article`, `kb:search`.
5. **Main & Preload Integration**:
   - Update `copernicus/electron/main.ts` to call `registerKbHandlers()` and `loadKnowledgeBase()` on startup.
   - Wait, `kb:list-articles` is already in `SEND_CHANNELS` in `preload.ts`? The grep showed it is.
   - Let's check `preload.ts` to confirm if we need to add them. (Already did `grep -n "kb:"` which matched line 143... Wait, I need to make sure I add them if they aren't there! Ah, the user grep of preload.ts showed it's actually there?! Oh wait, I checked `preload.ts` and it says "Knowledge Base (Story 566)". Someone might have added it to preload.ts already in a branch or I should check exactly what the grep returned).
6. **Pre-commit steps**:
   - `cd copernicus && npx tsc --noEmit` and ensure testing is good.
