import type { Database } from 'libsql';

interface KbArticleRow {
  id: string;
  title: string;
  section: string | null;
  tags: string | null;
  source: string;
  version: number;
  content: string;
  excerpt: string | null;
  project_id: string;
  type: string;
  description: string | null;
  path_scope: string | null;
  tool_restrictions: string | null;
  preferred_model: string | null;
  providers: string | null;
  sync_status: string | null;
  agent_model: string | null;
  agent_max_tokens: number | null;
  agent_temperature: number | null;
  agent_skills: string | null;
  agent_tools: string | null;
  ts: number;
}

export function migrateKnowledgeBase(db: Database): void {
  const newCols = [
    'ALTER TABLE intelligence_documents ADD COLUMN section TEXT',
    'ALTER TABLE intelligence_documents ADD COLUMN tags TEXT',
    'ALTER TABLE intelligence_documents ADD COLUMN source TEXT NOT NULL DEFAULT \'curated\'',
    'ALTER TABLE intelligence_documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE intelligence_documents ADD COLUMN excerpt TEXT',

    // Story 590: Agent YAML Schema
    'ALTER TABLE intelligence_documents ADD COLUMN agent_model TEXT',
    'ALTER TABLE intelligence_documents ADD COLUMN agent_max_tokens INTEGER',
    'ALTER TABLE intelligence_documents ADD COLUMN agent_temperature REAL',
    'ALTER TABLE intelligence_documents ADD COLUMN agent_skills TEXT',
    'ALTER TABLE intelligence_documents ADD COLUMN agent_tools TEXT'
  ];
  for (const sql of newCols) {
    try { db.exec(sql); } catch (_err) { /* column already exists */ }
  }
}

export function upsertKbArticle(db: Database, doc: {
  id: string;
  title: string;
  section: string;
  tags: string[];
  source: string;
  version: number;
  content: string;
  excerpt?: string;
}): void {
  const ts = Date.now();
  const existing = db.prepare('SELECT version FROM intelligence_documents WHERE id = ?').get(doc.id) as { version: number } | undefined;

  if (existing) {
    if (doc.version > existing.version) {
      db.prepare(`
        UPDATE intelligence_documents
        SET title = ?, section = ?, tags = ?, source = ?, version = ?, content = ?, excerpt = ?, ts = ?
        WHERE id = ?
      `).run(doc.title, doc.section, JSON.stringify(doc.tags), doc.source, doc.version, doc.content, doc.excerpt || '', ts, doc.id);
    }
  } else {
    db.prepare(`
      INSERT INTO intelligence_documents (
        id, project_id, type, title, description, content, section, tags, source, version, excerpt, ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      doc.id,
      'default', // project_id
      'kb_article', // type
      doc.title,
      '', // description
      doc.content,
      doc.section,
      JSON.stringify(doc.tags),
      doc.source,
      doc.version,
      doc.excerpt || '',
      ts
    );
  }
}

export function listKbArticles(db: Database): Record<string, any[]> {
  const rows = db.prepare(`
    SELECT id, title, section, tags
    FROM intelligence_documents
    WHERE source = 'curated'
    ORDER BY section ASC, title ASC
  `).all() as KbArticleRow[];

  const mapped = rows.map(r => ({
    id: r.id,
    title: r.title,
    section: r.section,
    tags: r.tags ? JSON.parse(r.tags) : []
  }));

  return mapped.reduce((acc, curr) => {
    const sec = curr.section || 'uncategorized';
    if (!acc[sec]) {
      acc[sec] = [];
    }
    acc[sec].push(curr);
    return acc;
  }, {} as Record<string, any[]>);
}

export function getKbArticle(db: Database, id: string): any {
  const row = db.prepare('SELECT * FROM intelligence_documents WHERE id = ?').get(id) as KbArticleRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    title: row.title,
    description: row.description,
    content: row.content,
    section: row.section,
    tags: row.tags ? JSON.parse(row.tags) : [],
    source: row.source,
    version: row.version,
    excerpt: row.excerpt,
    path_scope: row.path_scope,
    tool_restrictions: row.tool_restrictions,
    preferred_model: row.preferred_model,
    providers: row.providers,
    sync_status: row.sync_status,
    agent_model: row.agent_model,
    agent_max_tokens: row.agent_max_tokens,
    agent_temperature: row.agent_temperature,
    agent_skills: row.agent_skills,
    agent_tools: row.agent_tools,
    ts: row.ts
  };
}

export function searchKbArticles(db: Database, query: string): any[] {
  const searchPattern = `%${query}%`;
  return db.prepare(`
    SELECT id, title, section, excerpt
    FROM intelligence_documents
    WHERE source IN ('curated', 'user', 'community')
    AND (title LIKE ? OR content LIKE ?)
    ORDER BY ts DESC
  `).all(searchPattern, searchPattern);
}
