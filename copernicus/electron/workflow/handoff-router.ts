import { ContextAssembler, AssembledContext } from './context-assembler';
import { RecoveryHandoff, RecoveryContext } from './recovery-handoff';
import { StateLedger } from '../db/state-ledger';
import { NodeStatus } from './types';
import { BrowserWindow } from 'electron';

export interface AgentTransition {
  projectId: string;
  storyId: string;
  fromNodeId: string;
  toNodeId: string;
  fromStatus: NodeStatus | 'manual_remove' | 'stuck';
  modelChanged: boolean;
  planCheckerEscalated: boolean;
}

export type HandoffType = 'wave_transition' | 'recovery' | 'model_switch' | 'escalation';

export class HandoffRouter {
  private contextAssembler: ContextAssembler;
  private recoveryHandoff: RecoveryHandoff;
  private stateLedger: StateLedger;

  constructor(stateLedger: StateLedger) {
    this.stateLedger = stateLedger;
    this.contextAssembler = new ContextAssembler(stateLedger);
    this.recoveryHandoff = new RecoveryHandoff(stateLedger);
  }

  async classify(transition: AgentTransition): Promise<HandoffType> {
    if (transition.planCheckerEscalated) return 'escalation';
    if (['stuck', 'failed', 'error', 'manual_remove'].includes(transition.fromStatus)) return 'recovery';
    if (transition.modelChanged) return 'model_switch';
    return 'wave_transition';
  }

  async route(transition: AgentTransition): Promise<AssembledContext | RecoveryContext> {
    const handoffType = await this.classify(transition);
    let resultContext: AssembledContext | RecoveryContext;
    
    if (handoffType === 'wave_transition') {
      resultContext = await this.contextAssembler.assemble({
        projectId: transition.projectId,
        storyId: transition.storyId,
        nodeRole: 'executor',
      });
    } else if (handoffType === 'recovery') {
      const failureStatus = ['stuck', 'manual_remove'].includes(transition.fromStatus)
         ? (transition.fromStatus as 'stuck' | 'manual_remove')
         : 'failed';

      resultContext = await this.recoveryHandoff.assemble({
        projectId: transition.projectId,
        storyId: transition.storyId,
        failedAgentId: transition.fromNodeId,
        failureStatus: failureStatus,
      });
    } else if (handoffType === 'model_switch') {
      const logs = this.stateLedger.getAgentWorkLog(transition.projectId, transition.storyId, 50)
           .filter((log: any) => log.event_type === 'delta_summary')
           .sort((a: any, b: any) => b.ts - a.ts);
      
      const priorWaveSummaries = logs.length > 0 && logs[0].meta ? [JSON.parse(logs[0].meta).summary || ''] : [];

      resultContext = await this.contextAssembler.assemble({
        projectId: transition.projectId,
        storyId: transition.storyId,
        nodeRole: 'executor',
        priorWaveSummaries
      });
    } else if (handoffType === 'escalation') {
      const logs = this.stateLedger.getAgentWorkLog(transition.projectId, transition.storyId, 50)
          .filter((log: any) => log.event_type === 'plan_check_escalation')
          .sort((a: any, b: any) => a.ts - b.ts);
          
      const critiques = logs.map((l: any) => {
         const meta = JSON.parse(l.meta);
         return `Cycle ${meta.cycle}: ${meta.issues?.map((i: any) => i.description).join(', ')}`;
      });
      
      const priorWaveSummaries = critiques.length > 0 ? [`Critique History:\n${critiques.join('\n')}`] : [];

      resultContext = await this.contextAssembler.assemble({
        projectId: transition.projectId,
        storyId: transition.storyId,
        nodeRole: 'executor',
        priorWaveSummaries
      });
    } else {
       resultContext = await this.contextAssembler.assemble({
        projectId: transition.projectId,
        storyId: transition.storyId,
        nodeRole: 'executor',
      });
    }

    let contextTokenCount = 0;
    if ('systemPrompt' in resultContext) {
      contextTokenCount = Math.ceil(((resultContext as AssembledContext).systemPrompt.length + (resultContext as AssembledContext).taskPrompt.length) / 4);
    } else {
      contextTokenCount = Math.ceil(((resultContext as RecoveryContext).failureBrief.length) / 4);
    }

    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('workflow:handoff-complete', {
        toNodeId: transition.toNodeId,
        handoffType,
        contextTokenCount
      });
    }

    return resultContext;
  }
}
