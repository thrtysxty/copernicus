import { OrchestratorTile } from '../../../store/orchestrator'

export type { OrchestratorTile } from '../../../store/orchestrator'

export const ORCHESTRATOR_TILES: OrchestratorTile[] = [
  {
    id: 'git',
    category: 'vcs',
    label: 'Git',
    icon: 'GitBranch',
    defaultConfig: {
      repoUrl: '',
      branch: 'main',
      operation: 'status',
      command: 'git status',
    },
    configSchema: [
      { key: 'repoUrl', label: 'Repository URL', type: 'text' },
      { key: 'branch', label: 'Branch', type: 'text' },
      { key: 'operation', label: 'Operation', type: 'select', options: ['clone', 'pull', 'push', 'status'] },
    ],
  },
  {
    id: 'search',
    category: 'search',
    label: 'Search',
    icon: 'MagnifyingGlass',
    defaultConfig: {
      query: '',
      scope: 'text',
      command: '',
    },
    configSchema: [
      { key: 'query', label: 'Query', type: 'text' },
      { key: 'scope', label: 'Scope', type: 'select', options: ['file', 'symbol', 'text'] },
    ],
  },
  {
    id: 'review',
    category: 'review',
    label: 'Review',
    icon: 'CheckCircle',
    defaultConfig: {
      target: '',
      model: 'claude-3-5-sonnet',
    },
    configSchema: [
      { key: 'target', label: 'Target (file or PR)', type: 'text' },
      { key: 'model', label: 'Model', type: 'select', options: ['claude-3-5-sonnet', 'gemini-1.5-pro', 'gpt-4o'] },
    ],
  },
  {
    id: 'docker',
    category: 'container',
    label: 'Docker',
    icon: 'Cube',
    defaultConfig: {
      image: '',
      command: 'docker run --rm {{image}}',
    },
    configSchema: [
      { key: 'image', label: 'Image', type: 'text' },
    ],
  },
  {
    id: 'playwright',
    category: 'browser',
    label: 'Playwright',
    icon: 'Browser',
    defaultConfig: {
      url: '',
      action: 'navigate',
      selector: '',
      command: 'npx playwright test --url {{url}}',
    },
    configSchema: [
      { key: 'url', label: 'URL', type: 'text' },
      { key: 'action', label: 'Action', type: 'select', options: ['navigate', 'screenshot', 'click'] },
      { key: 'selector', label: 'Selector', type: 'text' },
    ],
  },
]
