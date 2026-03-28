export const DEFAULT_TEMPLATES = [
  {
    id: 'story',
    name: 'Story',
    body: `# {{storyTitle}}

## Narrative
**As a** [role]
**I want** [action]
**So that** [value]

## Context
[Provide background context, why this is needed, or what problem it solves.]

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Tests pass
- [ ] Requirements met
`
  },
  {
    id: 'api',
    name: 'API',
    body: `# {{storyTitle}}

## Context
[Context about the API changes.]

## Endpoints
- \`GET /api/v1/resource\`

## Request/Response Shape
- Request:
- Response:

## Auth
- [Auth requirements]

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Tests pass
- [ ] Requirements met
`
  },
  {
    id: 'epic',
    name: 'Epic',
    body: `# {{storyTitle}}

## Narrative
**As a** [role]
**I want** [action]
**So that** [value]

## Context
[Context about this epic.]

## Sub-Stories
- [ ] Story 1
- [ ] Story 2

## Files in Scope
- 

## Definition of Done
- [ ] All sub-stories complete
- [ ] Epic goals met
`
  },
  {
    id: 'bug',
    name: 'Bug',
    body: `# {{storyTitle}}

## Context
[Describe the bug and how to reproduce it.]

## Expected Behavior
[What should happen.]

## Actual Behavior
[What actually happens.]

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Tests pass
- [ ] Bug is fixed
`
  },
  {
    id: 'feature',
    name: 'Feature',
    body: `# {{storyTitle}}

## Narrative
**As a** [role]
**I want** [action]
**So that** [value]

## Context
[Context about the feature.]

## User Flow
1. User does X
2. System does Y

## Edge Cases
- What if Z happens?

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Tests pass
- [ ] Requirements met
`
  },
  {
    id: 'security',
    name: 'Security',
    body: `# {{storyTitle}}

## Context
[Security context or vulnerability details.]

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Vulnerability mitigated
- [ ] Tests pass
`
  },
  {
    id: 'foundation',
    name: 'Foundation',
    body: `# {{storyTitle}}

## Context
[Foundation or infrastructure context.]

## Architecture Decision
[Explain the architecture decision.]

## Migration Plan
[How to migrate to this new foundation.]

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Tests pass
- [ ] Foundation solid
`
  },
  {
    id: 'dependency-update',
    name: 'Dependency Update',
    body: `# {{storyTitle}}

## Context
[Which dependencies need updating and why.]

## Changelog Summary
[Summary of changes in new versions.]

## Breaking Changes
[Any breaking changes to address.]

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Dependencies updated
- [ ] Tests pass
`
  },
  {
    id: 'regression',
    name: 'Regression',
    body: `# {{storyTitle}}

## Context
[Details about the regression.]

## Root Cause
[Why did this regression happen?]

## Reproduction Steps
1.
2.

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Regression fixed
- [ ] Tests pass
`
  },
  {
    id: 'refactor',
    name: 'Refactor',
    body: `# {{storyTitle}}

## Context
[Why the code needs refactoring.]

## Before / After
- Before:
- After:

## Risk Assessment
[What could break?]

## Acceptance Criteria
1. 
2. 

## Files in Scope
- 

## Definition of Done
- [ ] Code refactored
- [ ] Tests pass
`
  }
]
