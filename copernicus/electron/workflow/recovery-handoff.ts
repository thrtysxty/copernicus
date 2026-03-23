import { StateLedger } from '../db/state-ledger';

export interface RecoveryInput {
  projectId: string;
  storyId: string;
  failedAgentId: string;    // node id or session id of the agent that failed
  failureStatus: 'stuck' | 'failed' | 'manual_remove';
}

export interface RecoveryContext {
  failureBrief: string;     // structured markdown summary
  lastGoodState: string;    // description of last confirmed-good state
  triedApproaches: string[];
  failureClassification: 'timeout' | 'error_loop' | 'wrong_approach' | 'external_block' | 'unknown';
  assembledAt: number;
}

export class RecoveryHandoff {
  private stateLedger: StateLedger;

  constructor(stateLedger: StateLedger) {
    this.stateLedger = stateLedger;
  }

  async assemble(input: RecoveryInput): Promise<RecoveryContext> {
    const { projectId, storyId, failedAgentId, failureStatus } = input;

    // Step 1: Query agent_work_log
    const rows = this.stateLedger.getFailedAgentWorkLog(projectId, storyId, failedAgentId);
    
    if (rows.length === 0) {
      return {
        failureBrief: 'No work log available for this agent.',
        lastGoodState: 'Unknown',
        triedApproaches: [],
        failureClassification: 'unknown',
        assembledAt: Date.now()
      };
    }

    // Parse meta JSON for all rows
    const logs = rows.map((r: any) => ({
      ...r,
      metaObj: (() => {
        try {
          return JSON.parse(r.meta);
        } catch {
          return {};
        }
      })()
    }));

    // Step 2: Classify failure
    let failureClassification: RecoveryContext['failureClassification'] = 'unknown';
    
    // Check error loops
    let consecutiveErrors = 0;
    let maxConsecutiveErrors = 0;
    
    for (const log of logs) {
      if (log.event_type === 'error') {
        consecutiveErrors++;
        maxConsecutiveErrors = Math.max(maxConsecutiveErrors, consecutiveErrors);
      } else {
        consecutiveErrors = 0;
      }
    }

    const lastLog = logs[logs.length - 1];
    const toolCallLogs = logs.filter((l: any) => l.event_type === 'tool_call');
    
    if (maxConsecutiveErrors > 10) {
      failureClassification = 'error_loop';
    } else if (lastLog.event_type === 'timeout') {
      failureClassification = 'timeout';
    } else if (toolCallLogs.length === 0) {
      failureClassification = 'wrong_approach';
    } else if (failureStatus === 'manual_remove') {
      failureClassification = 'external_block';
    }

    // Step 3: Build triedApproaches
    const approachesMap = new Map<string, number>();
    const triedApproaches: string[] = [];
    
    for (const log of logs) {
      if (log.event_type === 'tool_call' && log.metaObj?.toolName) {
        const str = `Called tool: ${log.metaObj.toolName}`;
        approachesMap.set(str, (approachesMap.get(str) || 0) + 1);
      } else if (log.event_type === 'file_edit' && log.metaObj?.filePath) {
        const str = `Modified ${log.metaObj.filePath}`;
        approachesMap.set(str, (approachesMap.get(str) || 0) + 1);
      }
    }
    
    for (const key of approachesMap.keys()) {
      triedApproaches.push(key);
    }

    // Limit distinct approaches to a reasonable number, e.g., 5
    const topApproaches = triedApproaches.slice(0, 5);

    // Step 4: Build lastGoodState
    let lastGoodState = 'Unknown';
    let lastGoodLog = null;
    let errorCount = 0;
    
    // Find the last file_edit or git_commit before the *first* error sequence (>10 errors)
    // Actually simpler: iterate backwards. If we hit a sequence of errors, we skip until we find an edit/commit before that sequence.
    for (let i = logs.length - 1; i >= 0; i--) {
       const log = logs[i];
       if (log.event_type === 'error') {
         errorCount++;
       } else if (log.event_type === 'file_edit' || log.event_type === 'git_commit') {
         // if we are not in a long error sequence yet, or this is before the sequence
         // well, backwards means "after the sequence" if we just started, 
         // but wait: we want the *first* error sequence...
         lastGoodLog = log;
         break;
       } else {
         errorCount = 0; // reset
       }
    }

    if (lastGoodLog) {
      if (lastGoodLog.event_type === 'file_edit') {
        const fp = lastGoodLog.metaObj?.filePath || 'unknown file';
        lastGoodState = `Last edit: ${fp} at ${new Date(lastGoodLog.ts).toISOString()}`;
      } else if (lastGoodLog.event_type === 'git_commit') {
        const msg = lastGoodLog.metaObj?.message || 'commit';
        lastGoodState = `Last commit: ${msg}`;
      }
    }

    // Step 5: Build failureBrief markdown
    const explanationMap = {
      timeout: 'The agent took too long to complete the task.',
      error_loop: 'The agent repeatedly encountered errors and could not recover.',
      wrong_approach: 'The agent failed to take any concrete action (no tools called).',
      external_block: 'The agent was manually removed, likely due to an external block.',
      unknown: 'The reason for failure is unclear.'
    };

    const repeatedApproaches = Array.from(approachesMap.entries())
      .filter(([_, count]) => count > 2)
      .map(([appr]) => appr);

    let notToDoSection = '';
    if (repeatedApproaches.length > 0) {
      notToDoSection = `### What NOT to do\n- ${repeatedApproaches.join('\n- ')}\n`;
    }

    let approachesList = topApproaches.length > 0 ? `- ${topApproaches.join('\n- ')}` : 'No actions taken.';

    const failureBrief = `## Recovery Brief for Story ${storyId}

**Status:** ${failureStatus} — ${failureClassification}
**Last confirmed good state:** ${lastGoodState}

### What was tried
${approachesList}

### Why it failed
${explanationMap[failureClassification]}

${notToDoSection}`.trim();

    return {
      failureBrief,
      lastGoodState,
      triedApproaches: topApproaches,
      failureClassification,
      assembledAt: Date.now()
    };
  }
}
