export const DEFAULT_PERSONAS = [
  { id: 'architect',     name: 'Architect',      description: 'High-level system design and planning', systemPrompt: 'System design, planning, and schema management',    system: true, role: 'Architect' },
  { id: 'senior-dev',    name: 'Senior Dev',     description: 'Complex implementation and code review', systemPrompt: 'Task breakdown, code review, and agent management',  system: true, role: 'Developer' },
  { id: 'junior-dev',    name: 'Junior Dev',     description: 'Focused task implementation', systemPrompt: 'Focused task implementation using TDD',             system: true, role: 'Developer' },
  { id: 'product-owner', name: 'Product Owner',  description: 'Requirement analysis and story management', systemPrompt: 'MVP strategy and user story management',            system: true, role: 'Reviewer' },
  { id: 'deployer',      name: 'Deployer',       description: 'Cloud and infrastructure automation', systemPrompt: 'Pi operations, Docker, and deployment tasks',       system: true, role: 'Custom' },
  { id: 'sentinel',      name: 'Sentinel',       description: 'Security and vulnerability scanning', systemPrompt: 'Autonomous hardening and secret detection',         system: true, role: 'Custom' },
  { id: 'scribe',        name: 'Scribe',         description: 'Documentation and release notes', systemPrompt: 'Documentation, READMEs, and technical writing',         system: true, role: 'Custom' },
]
