import { WorkflowState, VALID_TRANSITIONS } from './states';

export class WorkflowEngine {
  private currentState: WorkflowState = 'IDLE';

  constructor() {
    console.log('[SYSTEM] WorkflowEngine Initialized in IDLE state.');
  }

  public getState(): WorkflowState {
    return this.currentState;
  }

  public transition(newState: WorkflowState): boolean {
    const isValid = VALID_TRANSITIONS.some(
      t => t.from === this.currentState && t.to === newState
    );

    if (isValid) {
      console.log(`[SYSTEM] Workflow transition: ${this.currentState} -> ${newState}`);
      this.currentState = newState;
      return true;
    }

    console.warn(`[SECURITY] Invalid workflow transition attempted: ${this.currentState} -> ${newState}`);
    return false;
  }
}

export const workflowEngine = new WorkflowEngine();
