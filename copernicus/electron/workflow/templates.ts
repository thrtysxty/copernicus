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
    id: 'jules-pr-manager',
    name: 'Jules PR Manager',
    description: 'Monitors a Jules session, reviews the PR, and flags for merge approval.',
    graph: {
      id: 'tpl-jules-pr-manager',
      name: 'Jules PR Manager',
      nodes: [
        { id: 'watch-session', type: 'tool', label: 'Watch Jules Session', x: 50,  y: 150,
          data: { 
            variant: 'jules-watch',
            label: 'Watch Jules Session',
            description: 'Poll Jules session status until PR is created or session fails.'
          } as any },
        { id: 'fetch-diff',    type: 'tool', label: 'Fetch PR Diff',       x: 230, y: 150,
          data: { 
            variant: 'github-fetch-diff',
            label: 'Fetch PR Diff',
            description: 'Fetch PR diff from GitHub when Jules creates the PR.'
          } as any },
        {
          id: 'review-agent', type: 'agent', label: 'Claude Code Review', x: 410, y: 150,
          data: {
            variant: 'agent',
            provider: 'anthropic',
            modelId: 'claude-sonnet-4-6',
            persona: 'senior_dev',
            label: 'Claude Code Review',
            description: 'AI agent that reviews PR diffs and provides feedback.',
            systemPrompt: 'You are a senior engineer reviewing a pull request. Read the diff and provide concise, actionable feedback. Flag any bugs, security issues, or style violations. End with a verdict: APPROVE or REQUEST_CHANGES.',
            task: 'Review the following PR diff and provide feedback:\n\n{{__prDiff}}',
            contextFiles: [],
            outputChannel: 'terminal',
          } as any,
        },
        { id: 'post-review',   type: 'tool', label: 'Post Review Comment',   x: 590, y: 150,
          data: { 
            variant: 'github-post-comment',
            label: 'Post Review Comment',
            description: 'Post the review agent output as a PR comment.'
          } as any },
        { id: 'flag-approval', type: 'tool', label: 'Flag Card for Approval', x: 770, y: 150,
          data: { 
            variant: 'kanban-flag-card',
            label: 'Flag Card for Approval',
            description: 'Set story card to amber-highlighted state, awaiting human merge.'
          } as any },
      ],
      edges: [
        { id: 'e1', source: 'watch-session',  target: 'fetch-diff' },
        { id: 'e2', source: 'fetch-diff',     target: 'review-agent' },
        { id: 'e3', source: 'review-agent',   target: 'post-review' },
        { id: 'e4', source: 'post-review',    target: 'flag-approval' },
      ],
    },
  },
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
  {
    id: 'release-retrospective',
    name: 'Release Retrospective',
    description: 'Automated retrospective and memory reinforcement flow',
    graph: {
      id: 'tpl-release-retrospective',
      name: 'Release Retrospective',
      nodes: [
        { id: 'git-log-reader', type: 'tool', label: 'Git Log Reader', x: 50, y: 150,
          data: { variant: 'shell-command', command: "git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD" } as any },
        { id: 'model-calls-summary', type: 'tool', label: 'Model Calls Summary', x: 250, y: 150,
          data: { variant: 'db-query', query: 'model-calls-sprint', contextKey: 'model_calls_data' } as any },
        { id: 'performance-analyser', type: 'tool', label: 'Performance Analyser', x: 450, y: 150,
          data: { variant: 'db-query', query: 'model-performance-sprint', contextKey: 'perf_data' } as any },
        { id: 'build-error-reader', type: 'tool', label: 'Build Error Reader', x: 650, y: 150,
          data: { variant: 'file-read', filePath: (process.env.HOME ?? '/tmp') + '/.copernicus/logs/copernicus.log' } as any },
        { id: 'user-reflection', type: 'decision', label: 'User Reflection', x: 850, y: 150,
          data: { variant: 'human-approval', message: "Please describe retrospective points, successes, and failures from the past sprint." } as any },
        { id: 'learning-extractor', type: 'agent', label: 'Learning Extractor', x: 1050, y: 150,
          data: {
            variant: 'agent',
            provider: 'anthropic',
            modelId: 'claude-sonnet-4-6',
            persona: 'senior_dev',
            systemPrompt: 'You are a software engineering retrospective facilitator. Analyse the sprint evidence and extract concrete, actionable learning rules that can improve agent performance next sprint. Format each learning as: [RETROSPECTIVE vX.X.X] <pattern>: <what went wrong> → <reinforced rule>',
            task: 'Sprint Evidence:\n\nGit commits:\n{{git-log-reader}}\n\nModel usage:\n{{model_calls_data}}\n\nPerformance scores:\n{{perf_data}}\n\nBuild errors:\n{{build-error-reader}}\n\nUser reflection:\n{{user-reflection}}\n\nExtract 5-10 concrete learning rules. Output one rule per line, no preamble.',
            outputChannel: 'context'
          } as any },
        { id: 'routing-weight-updater', type: 'tool', label: 'Routing Weight Updater', x: 1250, y: 150,
          data: { variant: 'memory-write', content: '{{learning-extractor}}', importance: 9, source: 'retrospective-routing' } as any },
        { id: 'memory-writer', type: 'tool', label: 'Memory Writer', x: 1450, y: 150,
          data: { variant: 'memory-write', content: '{{learning-extractor}}', importance: 8, source: 'retrospective' } as any },
        { id: 'agents-md-updater', type: 'tool', label: 'Agents MD Updater', x: 1650, y: 150,
          data: { variant: 'agents-md-append', content: '\n## Reinforcements ({{learning-extractor}})\n' } as any },
      ],
      edges: [
        { id: 'e1', source: 'git-log-reader', target: 'model-calls-summary' },
        { id: 'e2', source: 'model-calls-summary', target: 'performance-analyser' },
        { id: 'e3', source: 'performance-analyser', target: 'build-error-reader' },
        { id: 'e4', source: 'build-error-reader', target: 'user-reflection' },
        { id: 'e5', source: 'user-reflection', target: 'learning-extractor' },
        { id: 'e6', source: 'learning-extractor', target: 'routing-weight-updater' },
        { id: 'e7', source: 'routing-weight-updater', target: 'memory-writer' },
        { id: 'e8', source: 'memory-writer', target: 'agents-md-updater' },
      ],
    },
  },
];
