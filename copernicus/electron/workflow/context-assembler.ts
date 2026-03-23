import { StateLedger } from '../db/state-ledger';
import { WFNodeRole } from './types';
import { minimatch } from 'minimatch';

export interface ContextAssemblyInput {
  projectId: string;
  storyId: string;
  nodeRole: WFNodeRole;
  priorWaveSummaries?: string[];
}

export interface AssembledContext {
  systemPrompt: string;
  taskPrompt: string;
  memorySnippets: string[];
  intelDocSummaries: string[];
  assembledAt: number;
}

export class ContextAssembler {
  private stateLedger: StateLedger;
  // Approximated as 4000 tokens * 4 chars/token = 16000 chars
  private readonly TOKEN_BUDGET_CHARS = 16000;

  constructor(stateLedger: StateLedger) {
    this.stateLedger = stateLedger;
  }

  private extractSection(markdown: string, sectionName: string): string | null {
    if (!markdown) return null;
    const regex = new RegExp(`##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
    const match = markdown.match(regex);
    return match && match[1] ? match[1].trim() : null;
  }

  private matchPathScope(pathScope: string[] | null, targetFiles: string[]): boolean {
    if (!pathScope || pathScope.length === 0) return true; // No scope means applies to all
    if (!targetFiles || targetFiles.length === 0) return false;
    
    for (const pattern of pathScope) {
      for (const file of targetFiles) {
        if (minimatch && minimatch(file, pattern, { matchBase: true })) {
          return true;
        }
      }
    }
    return false;
  }

  async assemble(input: ContextAssemblyInput): Promise<AssembledContext> {
    const { projectId, storyId, priorWaveSummaries } = input;
    
    // Section 2: Story Context
    const story = this.stateLedger.getStoryById(storyId);
    let taskPrompt = `# Task: ${story?.title || storyId}\n\n`;
    
    // Try to infer domain bank_id from tags/title/epic
    let domainBankId: string | undefined = undefined;
    
    // Parse target files from "Files in Scope" or "Files to Modify" section if present
    let targetFiles: string[] = [];

    if (story) {
      const ac = this.extractSection(story.body_md, 'Acceptance Criteria');
      if (ac) taskPrompt += `## Acceptance Criteria\n${ac}\n\n`;
      
      const dod = this.extractSection(story.body_md, 'Definition of Done');
      if (dod) taskPrompt += `## Definition of Done\n${dod}\n\n`;
      
      const fs = this.extractSection(story.body_md, 'Frozen Surfaces');
      if (fs) taskPrompt += `## Frozen Surfaces\n${fs}\n\n`;

      const filesInScope = this.extractSection(story.body_md, 'Files in Scope') || this.extractSection(story.body_md, 'Files to Modify');
      if (filesInScope) {
        // Simple extraction of file paths from markdown list
        const matches = filesInScope.match(/`([^`]+)`/g);
        if (matches) {
          targetFiles = matches.map((m: string) => m.replace(/`/g, ''));
        }
      }

      // Domain mapping heuristics
      if (story.epic) {
         domainBankId = story.epic;
      } else if (story.type) {
         domainBankId = story.type;
      }
    }

    if (priorWaveSummaries && priorWaveSummaries.length > 0) {
      taskPrompt += `## Prior wave output\n${priorWaveSummaries.join('\n\n')}\n\n`;
    }

    const systemPrompt = "You are an agent executing a workflow node for this story.\nFollow the Acceptance Criteria exactly. Do not modify frozen surfaces.";

    // Section 1: Memory
    const allMemoryRows = this.stateLedger.getMemoryWorkingSetForProject(projectId, 20); // fetch more to filter
    
    let domainMemory = domainBankId 
      ? allMemoryRows.filter(r => r.bank_id === domainBankId)
      : allMemoryRows;

    if (domainMemory.length === 0 && domainBankId) {
       // fallback to all rows if no domain match
       domainMemory = allMemoryRows;
    }

    // Limit to 10
    const memorySnippets = domainMemory.slice(0, 10).map(r => r.content);

    // Section 3: Intelligence documents
    const intelDocs = this.stateLedger.listIntelDocs(projectId);
    const intelDocSummaries: string[] = [];

    for (const doc of intelDocs) {
      if (doc.type === 'rule') {
        const matchesScope = this.matchPathScope(doc.pathScope, targetFiles);
        if (matchesScope || !doc.pathScope || doc.pathScope.length === 0) {
           intelDocSummaries.push(`Rule: ${doc.title}\nDescription: ${doc.description}\n${doc.content}`);
        }
      } else if (doc.type === 'instruction') {
        intelDocSummaries.push(`Instruction: ${doc.title}\nDescription: ${doc.description}`);
      }
    }

    // Section 6: Token budget truncation
    let currentChars = systemPrompt.length + taskPrompt.length;

    const finalIntelDocSummaries: string[] = [];
    const finalMemorySnippets: string[] = [];

    // Calculate total lengths
    const totalIntelChars = intelDocSummaries.reduce((sum, text) => sum + text.length, 0);
    const totalMemoryChars = memorySnippets.reduce((sum, text) => sum + text.length, 0);

    if (currentChars + totalIntelChars + totalMemoryChars <= this.TOKEN_BUDGET_CHARS) {
       // Everything fits
       finalIntelDocSummaries.push(...intelDocSummaries);
       finalMemorySnippets.push(...memorySnippets);
    } else {
       // Need to truncate.
       // 1. Can we fit all intel docs and just truncate some memory?
       let remainingBudget = this.TOKEN_BUDGET_CHARS - currentChars;

       // Add intel docs first as per spec "truncate memory snippets first ... then intel doc summaries"
       for (const doc of intelDocSummaries) {
         if (doc.length <= remainingBudget) {
           finalIntelDocSummaries.push(doc);
           remainingBudget -= doc.length;
         } else if (remainingBudget > 100) { // arbitrary min size to bother including a truncated version
           // We'll just omit it entirely if it doesn't fit, instead of a broken string, 
           // but let's just break for simplicity.
           break;
         }
       }

       // Add memory snippets (they are ordered by score DESC, so index 0 is highest score)
       for (const snippet of memorySnippets) {
         if (snippet.length <= remainingBudget) {
           finalMemorySnippets.push(snippet);
           remainingBudget -= snippet.length;
         } else {
           break; // truncate least-scored (which are at the end)
         }
       }
    }

    return {
      systemPrompt,
      taskPrompt: taskPrompt.trim(),
      memorySnippets: finalMemorySnippets,
      intelDocSummaries: finalIntelDocSummaries,
      assembledAt: Date.now()
    };
  }
}
