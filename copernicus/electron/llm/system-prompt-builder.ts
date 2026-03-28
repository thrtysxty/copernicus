import log from 'electron-log'
import { stateLedger } from '../db/state-ledger';

export interface SystemPromptContext {
  projectName?: string;      // from SettingsStore
  bankId?: string;           // chat | chat:<panelId> | workflow:node:<id>
  persona?: string;          // agent persona name, if any
  taskDescription?: string;  // optional — from caller when known
  conventions?: string[];    // optional extra rules to inject
}

export class SystemPromptBuilder {
  private readonly CORE_PROTOCOLS = `1. REPO RAG: You have access to the local codebase via the 'search_codebase' and 'read_file' tools. If the user's request is vague or refers to existing logic, you MUST search the codebase before asking the user for paths.
2. LOCAL DELEGATION: For tactical tasks like documentation, quick bug fixes, or UI tweaks, you can delegate to local sidekick models using 'local_research'.
3. SURGICAL EDITS: When providing code, provide complete, valid blocks. Avoid placeholders like "// ... rest of code".
4. CONTEXT AWARENESS: You are running in a professional environment. Prefer efficiency and technical precision over conversational filler.
5. PM DISCIPLINE: For any task larger than a 2-line fix, you MUST: (1) use search_codebase to understand the codebase first, (2) create a story with create_story, (3) dispatch it with dispatch_agent. Never write more than 20 lines of code inline.`;

  build(ctx: SystemPromptContext): string {
    const sections: string[] = [];

    // Identity
    let identity = '## Identity\n';
    identity += `You are the primary AI orchestrator inside the COPERNICUS IDE.\n`;
    if (ctx.projectName) {
      identity += `Project Name: ${ctx.projectName}\n`;
    }
    if (ctx.persona) {
      identity += `Persona: ${ctx.persona}\n`;
    }
    sections.push(identity.trim());

    // Core Protocols
    let protocols = '## Core Protocols\n';
    protocols += this.CORE_PROTOCOLS;
    sections.push(protocols.trim());

    // Conventions
    if (ctx.conventions && ctx.conventions.length > 0) {
      let conventions = '## Conventions\n';
      conventions += ctx.conventions.map(c => `- ${c}`).join('\n');
      sections.push(conventions.trim());
    }

    // Current Task
    if (ctx.taskDescription) {
      let task = '## Current Task\n';
      task += ctx.taskDescription;
      sections.push(task.trim());
    }

    // Story Context
    if (ctx.bankId && ctx.bankId.startsWith('story:')) {
      const storyId = ctx.bankId.replace('story:', '');
      try {
        const story = stateLedger.getStoryById(storyId);
        if (story) {
          let storyCtx = '## Story Context\n';
          storyCtx += `You are currently scoped to the following story (${story.id}):\n\n`;
          storyCtx += `Title: ${story.title}\n\n`;
          storyCtx += `Content:\n${story.body_md}\n`;
          sections.push(storyCtx.trim());
        }
      } catch (err) {
        log.error('[SystemPromptBuilder] Failed to get story context:', err);
      }
    }

    return sections.join('\n\n');
  }
}

export const systemPromptBuilder = new SystemPromptBuilder();
