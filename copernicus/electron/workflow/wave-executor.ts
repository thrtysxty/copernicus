import { ContextAssembler } from './context-assembler';
import { WavePlan } from './types';
import * as crypto from 'crypto';
import { workflowEngine } from './engine';
import { StateLedger } from '../db/state-ledger';
import { SettingsStore } from '../settings-store';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { PlanChecker, PlanCheckResult } from './plan-checker';
import { HandoffRouter, AgentTransition } from './handoff-router';

export class WorkflowWaveExecutor {
  async planWaves(storyIds: string[], stateLedger: StateLedger): Promise<WavePlan> {
    const stories = storyIds.map(id => stateLedger.getStoryById(id)).filter(s => !!s);
    const storyIdSet = new Set(stories.map(s => s!.id));
    const blocksMap = new Map<string, string[]>();
    const blockedByMap = new Map<string, string[]>();

    for (const story of stories) {
      if (!story) continue;
      const id = story.id;
      // Initialize with empty arrays
      blocksMap.set(id, []);
      blockedByMap.set(id, []);

      // Filter blocked/blocking arrays to only include stories within this workflow plan
      const blockedBy = (story.blocked_by || []).filter((b: string) => storyIdSet.has(b));
      const blocks = (story.blocks || []).filter((b: string) => storyIdSet.has(b));

      blockedByMap.set(id, blockedBy);
      blocksMap.set(id, blocks);
    }

    const waves: Array<{ storyIds: string[] }> = [];
    let remainingStories = new Set(storyIdSet);

    // Iteratively build waves
    while (remainingStories.size > 0) {
      const currentWave: string[] = [];

      for (const id of remainingStories) {
        const predecessors = blockedByMap.get(id) || [];
        // A story can be scheduled if all its predecessors have been scheduled in earlier waves
        const hasUnscheduledPredecessors = predecessors.some(p => remainingStories.has(p));
        
        if (!hasUnscheduledPredecessors) {
          currentWave.push(id);
        }
      }

      if (currentWave.length === 0) {
        // We have a cycle! 
        // Force the remaining stories into a final wave to break infinite loop
        log.warn(`[WorkflowWaveExecutor] Cycle detected in dependencies for stories: ${Array.from(remainingStories).join(', ')}. Treating remaining as wave.`);
        waves.push({ storyIds: Array.from(remainingStories) });
        break;
      }

      waves.push({ storyIds: currentWave });
      currentWave.forEach(id => remainingStories.delete(id));
    }

    return { waves };
  }

  private extractMarkdownSection(markdown: string | undefined, sectionName: string): string[] {
    if (!markdown) return [];
    const regex = new RegExp(`##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
    const match = markdown.match(regex);
    if (!match || !match[1]) return [];
    
    // Split lines that start with list item markers
    return match[1].split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-') || line.startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, ''));
  }

  async executeWaves(workflowId: string, plan: WavePlan, stateLedger: StateLedger, settingsStore: SettingsStore): Promise<void> {
    const maxConcurrent = (settingsStore.get('workflow.maxConcurrent', 3) as number) ?? 3;
    log.info(`[WorkflowWaveExecutor] Starting execution of ${plan.waves.length} waves for workflow ${workflowId} with max concurrency ${maxConcurrent}`);

    const planChecker = new PlanChecker(settingsStore);
    const handoffRouter = new HandoffRouter(stateLedger);
    const win = BrowserWindow.getAllWindows()[0];

    for (let waveIndex = 0; waveIndex < plan.waves.length; waveIndex++) {
      const wave = plan.waves[waveIndex];
      if (!wave || wave.storyIds.length === 0) continue;

      const waveId = crypto.randomUUID();
      
      stateLedger.insertWorkflowWave(waveId, workflowId, waveIndex, wave.storyIds, Date.now());
      stateLedger.updateWorkflowWaveStatus(waveId, 'running');

      // Before dispatching wave 0 (or any wave), run PlanChecker loop for each story
      for (const storyId of wave.storyIds) {
         let checkCycle = 0;
         let verdict: PlanCheckResult['verdict'] = 'revision_required';
         let revisionRequest: string | undefined = undefined;
         let checkResult: PlanCheckResult | null = null;
         
         const story = stateLedger.getStoryById(storyId);
         if (!story) continue;

         const ac = this.extractMarkdownSection(story.body_md, 'Acceptance Criteria');
         const dod = this.extractMarkdownSection(story.body_md, 'Definition of Done');
         const fs = this.extractMarkdownSection(story.body_md, 'Frozen Surfaces');

         while (checkCycle < 3 && verdict === 'revision_required') {
            checkCycle++;
            
            // Re-assemble context. Note ContextAssembler logic may append prior summaries.
            // For now, we manually pass the revision request.
            const contextAssembler = new ContextAssembler(stateLedger);
            const assembledContextData = await contextAssembler.assemble({
              projectId: workflowId,
              storyId,
              nodeRole: 'executor',
              priorWaveSummaries: revisionRequest ? [revisionRequest] : []
            });
            
            checkResult = await planChecker.check({
               storyId,
               acceptanceCriteria: ac,
               frozenSurfaces: fs,
               definitionOfDone: dod,
               assembledContext: assembledContextData.taskPrompt
            });
            verdict = checkResult.verdict;
            
            if (win && !win.isDestroyed()) {
              win.webContents.send('workflow:plan-check-result', { storyId, cycle: checkCycle, result: checkResult });
            }

            if (verdict === 'approved') {
               break;
            } else if (verdict === 'blocked' || checkCycle === 3) {
               // escalate
               stateLedger.insertAgentWorkLog({
                  id: crypto.randomUUID(),
                  projectId: workflowId,
                  bankId: storyId,
                  eventType: 'plan_check_escalation',
                  meta: JSON.stringify({ verdict: 'escalated', issues: checkResult.issues, cycle: checkCycle }),
                  ts: Date.now()
               });

               if (win && !win.isDestroyed()) {
                 win.webContents.send('workflow:plan-check-escalated', { storyId, result: checkResult, cycle: checkCycle });
               }

               log.error(`[WorkflowWaveExecutor] Plan check escalated for story ${storyId}. Halting wave.`);
               stateLedger.updateWorkflowWaveStatus(waveId, 'failed', Date.now());
               return; // halt execution
            } else {
               // verdict === 'revision_required'
               revisionRequest = checkResult.revision_request || 'Plan revision required';
            }
         }
      }

      let storiesCompleted = 0;
      let storiesFailed = 0;

      // Group stories into chunks of size maxConcurrent
      const chunks = [];
      for (let i = 0; i < wave.storyIds.length; i += maxConcurrent) {
        chunks.push(wave.storyIds.slice(i, i + maxConcurrent));
      }

      for (const chunk of chunks) {
        const promises = chunk.map(async (storyId) => {
          try {
            // For first run, node doesn't exist yet, we synthesize an ID
            const nodeId = `agent-story-${storyId}`;
            
            const transition: AgentTransition = {
               projectId: workflowId,
               storyId,
               fromNodeId: nodeId,
               toNodeId: nodeId,
               fromStatus: 'completed', // 'completed' implies done from prior wave logic
               modelChanged: false,
               planCheckerEscalated: false
            };

            const handoffContext = await handoffRouter.route(transition);
            
            let systemPrompt = '';
            let task = '';
            
            if ('systemPrompt' in handoffContext) {
               systemPrompt = handoffContext.systemPrompt;
               task = handoffContext.taskPrompt + '\n\n' +
                      (handoffContext.intelDocSummaries.length > 0 ? '## Intelligence\n' + handoffContext.intelDocSummaries.join('\n\n') + '\n\n' : '') +
                      (handoffContext.memorySnippets.length > 0 ? '## Memory\n' + handoffContext.memorySnippets.join('\n\n') + '\n\n' : '');
            } else {
               // RecoveryContext
               systemPrompt = "You are an agent executing a recovery node.";
               task = `# Recovery Context\n\n` +
                      `## Failure Brief\n${handoffContext.failureBrief}`;
            }

            const node: import('./types').WFNode = {
              id: nodeId,
              type: 'agent',
              label: `Implement ${storyId}`,
              x: 0,
              y: 0,
              data: {
                variant: 'agent',
                provider: 'anthropic',
                modelId: 'claude-3-5-sonnet-20241022',
                persona: 'coder',
                systemPrompt: systemPrompt,
                task: task,
                contextFiles: [],
                outputChannel: 'chat',
                useWorktree: true,
                mergeMode: 'gated'
              }
            };
            
            // Set context for this node execution
            workflowEngine.updateContext({ '__storyId': storyId, '__workflowId': workflowId });
            
            try {
              await workflowEngine.executeNode(node);
              
              const nodeStatusStr = node.status as string;
              if (nodeStatusStr === 'stuck' || nodeStatusStr === 'failed' || nodeStatusStr === 'error' || nodeStatusStr === 'manual_remove') {
                 throw new Error(`Node failed with status ${nodeStatusStr}`);
              }
              
              storiesCompleted++;
            } catch (e) {
              // Now that we have a failure, trigger the handoff router for recovery to assemble the brief
              // and log it, simulating the recovery loop.
              
              const nodeStatusStr = node.status as string;
              let failureStatus: 'stuck' | 'failed' | 'manual_remove' = 'failed';
              if (nodeStatusStr === 'stuck' || nodeStatusStr === 'manual_remove') {
                failureStatus = nodeStatusStr;
              }

              const failureTransition: AgentTransition = {
                  projectId: workflowId,
                  storyId,
                  fromNodeId: node.id,
                  toNodeId: `recovery-${node.id}`,
                  fromStatus: failureStatus,
                  modelChanged: false,
                  planCheckerEscalated: false
              };
              
              const recoveryContext = await handoffRouter.route(failureTransition);
                 
              // Log to agent_work_log
              stateLedger.insertAgentWorkLog({
                 id: crypto.randomUUID(),
                 projectId: workflowId,
                 bankId: storyId,
                 eventType: 'recovery_brief',
                 meta: JSON.stringify(recoveryContext),
                 ts: Date.now()
              });
            
              throw e;
            }

          } catch (e) {
            log.error(`[WorkflowWaveExecutor] Failed to execute story ${storyId}:`, e);
            storiesFailed++;
          }
        });

        await Promise.all(promises);
      }

      const waveStatus = storiesFailed > 0 && storiesCompleted === 0 ? 'failed' : 'done';

      stateLedger.updateWorkflowWaveStatus(waveId, waveStatus, Date.now());

      if (win) {
        win.webContents.send('workflow:wave-complete', {
          waveIndex,
          status: waveStatus,
          storiesCompleted,
          storiesFailed
        });
      }
    }
  }
}

export const workflowWaveExecutor = new WorkflowWaveExecutor();