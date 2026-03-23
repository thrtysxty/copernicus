import * as fs from 'fs';
import * as path from 'path';
import { IntelligenceDocument, IntelligenceDocType, ProviderKey } from './types';
import { BrowserWindow } from 'electron';
import { stateLedger } from '../db/state-ledger';
import log from 'electron-log';

export type SyncResult = { status: 'synced' | 'unsupported' | 'error'; error?: string };

export class ProviderSyncEngine {
  async sync(doc: IntelligenceDocument, rootPath: string): Promise<Record<ProviderKey, SyncResult>> {
    const syncStatus: Record<ProviderKey, SyncResult> = {};
    
    // Copy existing status to avoid overwriting unaffected providers
    for (const [provider, status] of Object.entries(doc.syncStatus || {})) {
      syncStatus[provider] = { status: status as 'synced' | 'unsupported' | 'error' };
    }

    for (const target of doc.providers || []) {
      // By default assume true if options.enabled is missing or options is missing
      const isEnabled = target.options?.enabled !== false;
      if (!isEnabled) {
          continue;
      }

      const provider = target.provider;
      const slug = this.slugify(doc.title);
      const resolvedPath = this.resolvePath(doc.type, provider, slug);
      
      if (!resolvedPath) {
        syncStatus[provider] = { status: 'unsupported' };
        continue;
      }

      const fullPath = path.join(rootPath, resolvedPath);
      const formattedContent = this.formatContent(doc, provider);

      try {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        if (doc.type === 'rule' && (provider === 'copilot' || provider === 'windsurf')) {
           // append
           const separator = '\n---\n';
           if (fs.existsSync(fullPath)) {
               const existing = fs.readFileSync(fullPath, 'utf8');
               if (!existing.includes(formattedContent.trim())) {
                 fs.appendFileSync(fullPath, separator + formattedContent);
               }
           } else {
               fs.writeFileSync(fullPath, formattedContent);
           }
        } else {
            // overwrite
            fs.writeFileSync(fullPath, formattedContent);
        }

        syncStatus[provider] = { status: 'synced' };
      } catch (err: any) {
        syncStatus[provider] = { status: 'error', error: err.message };
      }
    }

    // Call intel:update internally to persist updated syncStatus to DB
    const finalStatus: Record<ProviderKey, any> = {};
    for (const [k, v] of Object.entries(syncStatus)) {
        finalStatus[k] = v.status;
    }
    
    try {
        stateLedger.updateIntelDoc(doc.id, { syncStatus: finalStatus });
    } catch (e) {
        log.error("Failed to update syncStatus in DB", e);
    }
    
    // Send push event to renderer
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0 && windows[0]) {
        windows[0].webContents.send('intel:sync-complete', { id: doc.id, syncStatus: finalStatus });
    }

    return syncStatus;
  }

  private slugify(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  resolvePath(docType: IntelligenceDocType, provider: ProviderKey, slug: string): string | null {
    if (docType === 'instruction') {
      switch (provider) {
        case 'claude': return 'CLAUDE.md';
        case 'cursor': return '.cursorrules';
        case 'copilot': return '.github/copilot-instructions.md';
        case 'windsurf': return '.windsurfrules';
        case 'gemini': return 'GEMINI.md';
        case 'aider': return 'CONVENTIONS.md';
        default: return null;
      }
    }

    if (docType === 'rule') {
      switch (provider) {
        case 'claude': return `.claude/rules/${slug}.md`;
        case 'cursor': return `.cursor/rules/${slug}.mdc`;
        case 'copilot': return '.github/copilot-instructions.md';
        case 'windsurf': return '.windsurfrules';
        default: return null;
      }
    }

    if (docType === 'agent') {
      if (provider === 'claude') return `.claude/agents/${slug}.md`;
      return null;
    }

    if (docType === 'skill') {
      if (provider === 'claude') return `.claude/skills/${slug}/SKILL.md`;
      return null;
    }

    if (docType === 'command') {
      if (provider === 'claude') return `.claude/commands/${slug}.md`;
      return null;
    }

    return null;
  }

  formatContent(doc: IntelligenceDocument, provider: ProviderKey): string {
    let content = doc.content || '';
    
    if (doc.type === 'rule' && doc.pathScope && doc.pathScope.length > 0) {
      if (provider === 'claude') {
        const pathsStr = doc.pathScope.map(p => `  - ${p}`).join('\n');
        content = `---\npaths:\n${pathsStr}\n---\n${content}`;
      } else if (provider === 'cursor') {
        const globsStr = doc.pathScope.map(p => `  - ${p}`).join('\n');
        content = `---\nglobs:\n${globsStr}\n---\n${content}`;
      }
    }

    return content;
  }
}

export const providerSyncEngine = new ProviderSyncEngine();
