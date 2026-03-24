import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'
import { knowledgeRouter } from '../local-model/KnowledgeRouter'
import { localModelManager } from '../local-model/LocalModelManager'
import { MemoryRow } from '../../src/renderer/types/memory'
import { autoExtractor } from '../memory/auto-extractor'
import { stateLedger } from '../db/state-ledger'
import { fsManager } from '../fs-manager'

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const { modelRegistry, llmService } = deps

  // LLM Chat
  ipcMain.handle('chat:send', (_event, payload: any) => handleIpc('chat:send', [payload], async () => {
    let { model, imageBase64 } = payload
    
    // AC3: NotebookLM provider override
    if (model?.startsWith('notebooklm:')) {
      payload.provider = 'notebooklm'
    }

    // AC3: Vision model check
    if (imageBase64) {
      const modelConfig = modelRegistry.getModels().find(m => m.id === model)
      if (!modelConfig?.supportsVision) {
        return { 
          error: 'VISION_NOT_SUPPORTED', 
          message: 'Switch to a vision-capable model (Claude 3, GPT-4o, Gemini 1.5+) to send images.' 
        }
      }
    }

    // Knowledge injection for bundled BitNet model
    if (payload.model === 'bitnet-b158-2b' && localModelManager.isRunning()) {
      const userQuery = [...(payload.messages ?? [])].reverse()
        .find((m: any) => m.role === 'user')?.content ?? ''
      const knowledge = knowledgeRouter.getContext(String(userQuery))
      if (knowledge) {
        const baseSystem = payload.systemPrompt ?? ''
        payload = {
          ...payload,
          systemPrompt: `You are COPERNICUS Assistant, a local AI embedded in the COPERNICUS IDE. Answer questions about using COPERNICUS accurately using the documentation below. If the documentation does not cover the question, say so and suggest the user ask the cloud AI panel.\n\nDOCUMENTATION:\n${knowledge}\n\n${baseSystem}`.trim()
        }
      }
    }

    llmService.streamChat(payload).then(() => {
      // The service streamChat has finished. Wait for its broadcast to complete.
    }).catch((err: unknown) => log.error('[LLM] streamChat error:', err))
    return { ok: true }
  }))

  ipcMain.on('chat:done-extraction', (_e, payload: { fullResponseText: string }) => {
    const rootPath = fsManager.getRootPath() ?? ''
    const projectId = stateLedger.getProjectByPath(rootPath)?.id ?? 'default'
    if (payload.fullResponseText) {
      autoExtractor.extract(payload.fullResponseText, 'chat', projectId).catch(err => {
        log.error('[AutoExtractor] unhandled error:', err)
      })
    }
  })

  ipcMain.handle('chat:confirm-model-switch', (_e, payload: any) => handleIpc('chat:confirm-model-switch', [payload], async () => {
    // Notify all windows
    BrowserWindow.getAllWindows().forEach(w =>
      w.webContents.send('chat:model-switch-decision', payload))
    
    // Notify Python backend (Story 228 AC-3)
    try {
      await fetch('http://localhost:5001/api/orchestration/resolve-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: payload.request_id || payload.sessionId, // accommodate both naming conventions
          approved: payload.accepted
        })
      })
    } catch (err) {
      log.error('[Main] Failed to notify backend of model switch decision:', err)
    }
    return { ok: true }
  }))

  // Story 343 AC4: Ghost Implementation
  ipcMain.handle('agent:send-code-stream', (_e, payload: { sessionId: string, filePath: string, proposedDiff: string }) =>
    handleIpc('agent:send-code-stream', [payload], () => {
      win.webContents.send('agent:code-stream', payload)
      return { ok: true }
    })
  )

  ipcMain.handle('chat:compress-delta', (_e, payload: { rows: MemoryRow[], maxTokens: number }) => 
    handleIpc(async () => {
      const { rows, maxTokens } = payload;
      const content = rows.map(r => r.content).join('\n');
      const prompt = `Compress these memory facts into ≤${maxTokens} tokens for a new model context:\n${content}`;
      const fastModel = modelRegistry.getFastModel().id;
      const summary = await llmService.generateText(prompt, fastModel);
      return { summary };
    })
  );
}
