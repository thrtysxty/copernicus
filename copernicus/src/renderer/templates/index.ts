export interface TemplateManifest {
  id: string
  label: string
  filename: string
}

export const TEMPLATE_MANIFEST: TemplateManifest[] = [
  { id: 'story',             label: 'Story',             filename: 'story-doc.md' },
  { id: 'api',               label: 'API',               filename: 'api-doc.md' },
  { id: 'epic',              label: 'Epic',              filename: 'epic.md' },
  { id: 'bug',               label: 'Bug',               filename: 'bug.md' },
  { id: 'feature',           label: 'Feature',           filename: 'feature.md' },
  { id: 'security',          label: 'Security',          filename: 'security.md' },
  { id: 'foundation',        label: 'Foundation',        filename: 'foundation.md' },
  { id: 'dependency-update', label: 'Dependency Update', filename: 'dependency-update.md' },
  { id: 'regression',        label: 'Regression',        filename: 'regression.md' },
  { id: 'refactor',          label: 'Refactor',          filename: 'refactor.md' },
]
