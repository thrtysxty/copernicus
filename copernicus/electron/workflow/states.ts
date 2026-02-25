export type WorkflowState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE' | 'FAILED';

export interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
}

export const VALID_TRANSITIONS: WorkflowTransition[] = [
  { from: 'IDLE', to: 'RUNNING' },
  { from: 'RUNNING', to: 'PAUSED' },
  { from: 'RUNNING', to: 'COMPLETE' },
  { from: 'RUNNING', to: 'FAILED' },
  { from: 'PAUSED', to: 'RUNNING' },
  { from: 'PAUSED', to: 'FAILED' },
  { from: 'FAILED', to: 'IDLE' },
  { from: 'COMPLETE', to: 'IDLE' },
];
