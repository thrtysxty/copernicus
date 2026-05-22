import log from '../utils/logger'
import { unwrapIpc } from '../types/ipc'

export interface DocMetadata {
  id: string;
  title: string;
  status: string;
  agentId: string;
  epicId: string;
  date: string;
  narrative: string;
  artifacts: string[];
  techSummary: string;
}

export class DocFactory {
  static async generateStoryMarkdown(meta: DocMetadata, invoke?: <T>(c: string, ...a: any[]) => Promise<T>): Promise<string> {
    let template = '';

    try {
      if (!invoke) throw new Error('invoke not provided');
      // Hydra logic: read template from file system via IPC
      const res = await invoke<any>('fs:read-file', 'copernicus/src/renderer/templates/story-doc.md');
      template = unwrapIpc<string>(res);
    } catch (e) {
      log.warn('[DOC_FACTORY] Using fallback string template');
      template = `# IMPLEMENTATION REPORT: [STORY_ID]\n\n[NARRATIVE_TEXT]`;
    }

    const artifactList = meta.artifacts.map(a => `- ${a}`).join('\n');

    return template
      .replace('[STORY_ID]', meta.id)
      .replace('[STORY_TITLE]', meta.title)
      .replace('[STATUS]', meta.status)
      .replace('[DATE]', meta.date)
      .replace('[AGENT_ID]', meta.agentId)
      .replace('[EPIC_ID]', meta.epicId)
      .replace('[NARRATIVE_TEXT]', meta.narrative)
      .replace('[ARTIFACT_LIST]', artifactList)
      .replace('[TECHNICAL_SUMMARY]', meta.techSummary);
  }

  static async saveDocumentation(path: string, content: string, invoke?: <T>(c: string, ...a: any[]) => Promise<T>) {
    if (invoke) {
      const res = await invoke<any>('fs:write-file', path, content);
      return unwrapIpc(res);
    }
    log.warn('[DOC_FACTORY] IPC not available, documentation not saved.');
  }
}
