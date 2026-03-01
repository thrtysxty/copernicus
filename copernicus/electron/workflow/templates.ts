import { WorkflowGraph } from './types';
import type { AgentNodeData, ToolNodeData, TriggerNodeData, DecisionNodeData } from './types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
}

const agentNode = (
  id: string, label: string, x: number, y: number,
  persona: string, provider: any, modelId: string
) => ({
  id, type: 'agent' as const, label, x, y,
  data: {
    variant: 'agent',
    provider,
    modelId,
    persona,
    systemPrompt: '',
    task: '',
    contextFiles: [],
    outputChannel: 'terminal',
  } as AgentNodeData
});

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'story-pipeline',
    name: 'Story Implementation Pipeline',
    description: 'Standard story development: plan → implement → test → review',
    graph: {
      id: 'tpl-story-pipeline',
      name: 'Story Implementation Pipeline',
      nodes: [
        { id: 'trigger', type: 'trigger', label: 'Story Activated', x: 50, y: 150,
          data: { variant: 'story-activated' } as TriggerNodeData },
        agentNode('architect', 'Architect', 230, 150, 'Architect', 'anthropic', 'claude-sonnet-4-6'),
        agentNode('implementer', 'Implementer', 410, 150, 'Implementer', 'anthropic', 'claude-sonnet-4-6'),
        { id: 'test', type: 'tool', label: 'Run Tests', x: 590, y: 150,
          data: { variant: 'makefile-run', command: 'test' } as ToolNodeData },
        { id: 'gate', type: 'decision', label: 'Tests Pass?', x: 770, y: 150,
          data: { variant: 'exit-code-gate' } as DecisionNodeData },
        { id: 'commit', type: 'tool', label: 'Commit', x: 950, y: 80,
          data: { variant: 'shell-command', command: 'git add -A && git commit -m "feat: story implementation"' } as ToolNodeData },
        agentNode('reviewer', 'Reviewer', 950, 220, 'Reviewer', 'google', 'gemini-1.5-pro'),
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'architect' },
        { id: 'e2', source: 'architect', target: 'implementer' },
        { id: 'e3', source: 'implementer', target: 'test' },
        { id: 'e4', source: 'test', target: 'gate' },
        { id: 'e5', source: 'gate', target: 'commit', label: 'Yes' },
        { id: 'e6', source: 'gate', target: 'reviewer', label: 'No' },
      ],
    },
  },
  {
    id: 'review-gate',
    name: 'Code Review Gate',
    description: 'Automated review pass before merge',
    graph: {
      id: 'tpl-review-gate',
      name: 'Code Review Gate',
      nodes: [
        { id: 'trigger', type: 'trigger', label: 'PR Opened', x: 50, y: 150,
          data: { variant: 'manual' } as TriggerNodeData },
        agentNode('reviewer', 'Reviewer', 230, 150, 'Reviewer', 'google', 'gemini-1.5-pro'),
        { id: 'gate', type: 'decision', label: 'Approved?', x: 410, y: 150,
          data: { variant: 'human-approval' } as DecisionNodeData },
        { id: 'merge', type: 'tool', label: 'Merge', x: 590, y: 80,
          data: { variant: 'shell-command', command: 'git merge --ff-only' } as ToolNodeData },
        agentNode('revise', 'Revise', 590, 220, 'Implementer', 'anthropic', 'claude-sonnet-4-6'),
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'reviewer' },
        { id: 'e2', source: 'reviewer', target: 'gate' },
        { id: 'e3', source: 'gate', target: 'merge', label: 'Yes' },
        { id: 'e4', source: 'gate', target: 'revise', label: 'No' },
      ],
    },
  },
  {
    id: 'hotfix-pipeline',
    name: 'Hotfix Pipeline',
    description: 'Fast-track fix: implement → test → commit',
    graph: {
      id: 'tpl-hotfix',
      name: 'Hotfix Pipeline',
      nodes: [
        { id: 'trigger', type: 'trigger', label: 'Hotfix Triggered', x: 50, y: 150,
          data: { variant: 'manual' } as TriggerNodeData },
        agentNode('implementer', 'Implementer', 230, 150, 'Implementer', 'anthropic', 'claude-sonnet-4-6'),
        { id: 'test', type: 'tool', label: 'Run Tests', x: 410, y: 150,
          data: { variant: 'makefile-run', command: 'test' } as ToolNodeData },
        { id: 'gate', type: 'decision', label: 'Tests Pass?', x: 590, y: 150,
          data: { variant: 'exit-code-gate' } as DecisionNodeData },
        { id: 'commit', type: 'tool', label: 'Hotfix Commit', x: 770, y: 80,
          data: { variant: 'shell-command', command: 'git add -A && git commit -m "hotfix:"' } as ToolNodeData },
        { id: 'escalate', type: 'trigger', label: 'Escalate', x: 770, y: 220,
          data: { variant: 'manual' } as TriggerNodeData },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'implementer' },
        { id: 'e2', source: 'implementer', target: 'test' },
        { id: 'e3', source: 'test', target: 'gate' },
        { id: 'e4', source: 'gate', target: 'commit', label: 'Yes' },
        { id: 'e5', source: 'gate', target: 'escalate', label: 'No' },
      ],
    },
  },
];
