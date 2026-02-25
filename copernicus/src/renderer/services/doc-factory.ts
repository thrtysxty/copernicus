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
  static async generateStoryMarkdown(meta: DocMetadata): Promise<string> {
    const ipcRenderer = (window as any).ipcRenderer;
    let template = '';
    
    try {
      // Hydra logic: read template from file system via IPC
      template = await ipcRenderer.invoke('fs:read-file', 'copernicus/src/renderer/templates/story-doc.md');
    } catch (e) {
      console.warn('[DOC_FACTORY] Using fallback string template');
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

  static async saveDocumentation(path: string, content: string) {
    const ipcRenderer = (window as any).ipcRenderer;
    if (ipcRenderer) {
      return await ipcRenderer.invoke('fs:write-file', path, content);
    }
    console.warn('[DOC_FACTORY] IPC not available, documentation not saved.');
  }
}
