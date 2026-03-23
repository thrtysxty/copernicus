import { WavePlan } from './types';
import { workflowEngine } from './engine';
import { StateLedger } from '../db/state-ledger';
import { SettingsStore } from '../settings-store';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import crypto from 'crypto';

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

  async executeWaves(workflowId: string, plan: WavePlan, stateLedger: StateLedger, settingsStore: SettingsStore): Promise<void> {
    const maxConcurrent = (settingsStore.get('workflow.maxConcurrent', 3) as number) ?? 3;
    log.info(`[WorkflowWaveExecutor] Starting execution of ${plan.waves.length} waves for workflow ${workflowId} with max concurrency ${maxConcurrent}`);

    for (let waveIndex = 0; waveIndex < plan.waves.length; waveIndex++) {
      const wave = plan.waves[waveIndex];
      if (!wave || wave.storyIds.length === 0) continue;

      const waveId = crypto.randomUUID();
      
      stateLedger.insertWorkflowWave(waveId, workflowId, waveIndex, wave.storyIds, Date.now());
      stateLedger.updateWorkflowWaveStatus(waveId, 'running');

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
            // "spawns up to maxConcurrent agent nodes in parallel using existing workflowEngine.runNode() internals"
            // We use executeNode since runNode does not exist. A story is essentially an agent node.
            const node: import('./types').WFNode = {
              id: `agent-story-${storyId}`,
              type: 'agent',
              label: `Implement ${storyId}`,
              x: 0,
              y: 0,
              data: {
                variant: 'agent',
                provider: 'anthropic',
                modelId: 'claude-3-5-sonnet-20241022',
                persona: 'coder',
                systemPrompt: 'You are an agent executing a story.',
                task: `Implement story ${storyId}`,
                contextFiles: [],
                outputChannel: 'chat',
                useWorktree: true,
                mergeMode: 'gated'
              }
            };
            
            // Set context for this node execution
            workflowEngine.updateContext({ '__storyId': storyId, '__workflowId': workflowId });
            await workflowEngine.executeNode(node);
            storiesCompleted++;
          } catch (e) {
            log.error(`[WorkflowWaveExecutor] Failed to execute story ${storyId}:`, e);
            storiesFailed++;
          }
        });

        await Promise.all(promises);
      }

      const waveStatus = storiesFailed > 0 && storiesCompleted === 0 ? 'failed' : 'done';

      stateLedger.updateWorkflowWaveStatus(waveId, waveStatus, Date.now());

      const win = BrowserWindow.getAllWindows()[0];
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