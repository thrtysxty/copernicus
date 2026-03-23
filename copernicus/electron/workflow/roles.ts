import { WFNodeRole, WFNodeRoleConfig } from './types';

export const ROLE_CONFIGS: Record<WFNodeRole, WFNodeRoleConfig> = {
  researcher: { role: 'researcher', modelTier: 'fast', toolPolicy: 'read-only', description: 'Stack analysis, spec research' },
  planner:    { role: 'planner',    modelTier: 'thinker', toolPolicy: 'read-only', description: 'Phase breakdown, XML plan generation' },
  checker:    { role: 'checker',    modelTier: 'fast', toolPolicy: 'read-no-exec', description: 'Plan verification, AC coverage audit' },
  executor:   { role: 'executor',   modelTier: 'coder', toolPolicy: 'all', description: 'Implementation' },
  verifier:   { role: 'verifier',   modelTier: 'fast', toolPolicy: 'read-bash-no-write', description: 'Post-execution AC verification' },
  auditor:    { role: 'auditor',    modelTier: 'fast', toolPolicy: 'read-no-exec', description: 'Test coverage, security, style' },
};
