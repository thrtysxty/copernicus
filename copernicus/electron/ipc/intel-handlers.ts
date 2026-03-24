import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { stateLedger } from '../db/state-ledger';
import { IntelligenceDocument, IntelligenceDocSuggestion } from '../intelligence/types';
import { providerSyncEngine } from '../intelligence/provider-sync-engine';
import { fsManager } from '../fs-manager';
import { detectStack } from '../skills/stack-detector';

function generateId(): string {
  return `suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function registerIntelHandlers() {
  ipcMain.handle('intel:suggest', (_e, { projectId: _projectId }: { projectId: string }) => handleIpc(() => {
    const rootPath = fsManager.getRootPath();
    if (!rootPath) {
      return [];
    }
    
    const stack = detectStack(rootPath);
    const suggestions: IntelligenceDocSuggestion[] = [];

    // Always include project overview if no docs exist
    suggestions.push({
      id: generateId(),
      type: 'instruction',
      title: 'Project Overview',
      description: 'General project context and architecture guidelines',
      content: '# Project Overview\n\nProvide a high-level overview of the project architecture and core directives here.',
      rationale: 'A general project overview helps align agents with the codebase structure.'
    });

    if (stack.hasTypeScript) {
      suggestions.push({
        id: generateId(),
        type: 'rule',
        title: 'TypeScript Standards',
        description: 'Enforce strict null checks and typing rules',
        content: '# TypeScript Standards\n\n- Enable strict null checks.\n- Avoid `any` types where possible.\n- Use explicit return types on public methods.',
        rationale: 'TypeScript detected in package.json or tsconfig.json.'
      });
    }

    if (stack.hasElectron) {
      suggestions.push({
        id: generateId(),
        type: 'rule',
        title: 'Electron IPC Patterns',
        description: 'Security rules and IPC envelope standards',
        content: '# Electron IPC Patterns\n\n- All main process handlers must use `handleIpc()` wrapper.\n- Never use `ipcRenderer.invoke` directly in renderer; use `useIpcError()`.\n- Add channels to `SEND_CHANNELS` and `RECEIVE_CHANNELS` in `preload.ts`.\n- Context isolation must be enabled.',
        rationale: 'Electron framework detected in dependencies.'
      });
    }

    if (stack.hasReact) {
      suggestions.push({
        id: generateId(),
        type: 'rule',
        title: 'React Component Conventions',
        description: 'Rules for hooks, state, and rendering',
        content: '# React Component Conventions\n\n- Use functional components and hooks.\n- Access Zustand stores with field-specific selectors to avoid re-renders (e.g. `useStore(s => s.field)`).\n- Use Tailwind CSS for styling.',
        rationale: 'React detected in dependencies.'
      });
    }

    if (stack.hasFlask) {
      suggestions.push({
        id: generateId(),
        type: 'rule',
        title: 'Flask Route Conventions',
        description: 'API endpoint and response formatting rules',
        content: '# Flask Route Conventions\n\n- API endpoints should return `{ ok: boolean, data?: any, error?: string }` envelope.\n- Use standard `sqlite3` for database access.\n- Ensure API key validation via middleware.',
        rationale: 'Flask detected in requirements.txt or pyproject.toml.'
      });
    }

    if (stack.frameworks.some(f => f.toLowerCase() === 'sqlite') || stack.hasCopernicus) {
      // Assuming SQLite is used in Copernicus. We can also check if SQLite is generally used.
      suggestions.push({
        id: generateId(),
        type: 'rule',
        title: 'SQLite WAL Mode',
        description: 'Database connection configuration',
        content: '# SQLite WAL Mode\n\n- All SQLite connections must use WAL mode for concurrency.\n- Use `better-sqlite3` strictly in the main process.',
        rationale: 'SQLite usage is a core part of this tech stack.'
      });
    }

    return suggestions;
  }));

  ipcMain.handle('intel:list', (_e, { projectId }: { projectId: string }) => handleIpc(() => {
    return stateLedger.listIntelDocs(projectId);
  }));

  ipcMain.handle('intel:get', (_e, { id }: { id: string }) => handleIpc(() => {
    return stateLedger.getIntelDoc(id);
  }));

  ipcMain.handle('intel:create', (_e, data: {
    projectId: string;
    type: string;
    title: string;
    description?: string;
    content?: string;
    pathScope?: string[];
    providers?: any[];
  }) => handleIpc(() => {
    const doc = stateLedger.createIntelDoc(data);
    const rootPath = fsManager.getRootPath();
    if (rootPath) {
      providerSyncEngine.sync(doc, rootPath).catch(err => {
        console.error('Provider sync failed on create:', err);
      });
    }
    return doc;
  }));

  ipcMain.handle('intel:update', (_e, data: { id: string } & Partial<IntelligenceDocument>) => handleIpc(() => {
    const { id, ...partial } = data;
    const doc = stateLedger.updateIntelDoc(id, partial);
    const rootPath = fsManager.getRootPath();
    if (rootPath) {
      providerSyncEngine.sync(doc, rootPath).catch(err => {
        console.error('Provider sync failed on update:', err);
      });
    }
    return doc;
  }));

ipcMain.handle('intel:delete', (_e, { id }: { id: string }) => handleIpc(() => {
    return { ok: stateLedger.deleteIntelDoc(id) };
  }));

  ipcMain.handle('intel:audit-length', (_e, { id }: { id: string }) => handleIpc(() => {
    const doc = stateLedger.getIntelDoc(id);
    if (!doc) {
      throw new Error(`Document ${id} not found`);
    }
    const lines = (doc.content || '').split('\n').length;
    return {
      lines,
      overThreshold: lines > 200,
      threshold: 200
    };
  }));
}
