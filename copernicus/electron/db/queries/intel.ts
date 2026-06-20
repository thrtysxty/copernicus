import type { Database } from 'libsql';

interface IntelDocRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string | null;
  content: string | null;
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

export function listIntelDocs(db: Database, projectId: string): any[] {
  const rows = db.prepare(`
    SELECT * FROM intelligence_documents
    WHERE project_id = ?
    ORDER BY type ASC, title ASC
  `).all(projectId) as IntelDocRow[];

  return rows.map(r => ({
    id: r.id,
    projectId: r.project_id,
    type: r.type,
    title: r.title,
    description: r.description,
    content: r.content,
    pathScope: r.path_scope ? JSON.parse(r.path_scope) : null,
    toolRestrictions: r.tool_restrictions ? JSON.parse(r.tool_restrictions) : null,
    preferredModel: r.preferred_model,
    providers: r.providers ? JSON.parse(r.providers) : [],
    syncStatus: r.sync_status ? JSON.parse(r.sync_status) : {},
    agentModel: r.agent_model,
    agentMaxTokens: r.agent_max_tokens,
    agentTemperature: r.agent_temperature,
    agentSkills: r.agent_skills ? JSON.parse(r.agent_skills) : null,
    agentTools: r.agent_tools ? JSON.parse(r.agent_tools) : null,
    ts: r.ts
  }));
}

export function getIntelDoc(db: Database, id: string): any {
  const row = db.prepare('SELECT * FROM intelligence_documents WHERE id = ?').get(id) as IntelDocRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    description: row.description,
    content: row.content,
    pathScope: row.path_scope ? JSON.parse(row.path_scope) : null,
    toolRestrictions: row.tool_restrictions ? JSON.parse(row.tool_restrictions) : null,
    preferredModel: row.preferred_model,
    providers: row.providers ? JSON.parse(row.providers) : [],
    syncStatus: row.sync_status ? JSON.parse(row.sync_status) : {},
    agentModel: row.agent_model,
    agentMaxTokens: row.agent_max_tokens,
    agentTemperature: row.agent_temperature,
    agentSkills: row.agent_skills ? JSON.parse(row.agent_skills) : null,
    agentTools: row.agent_tools ? JSON.parse(row.agent_tools) : null,
    ts: row.ts
  };
}

export function createIntelDoc(db: Database, data: {
  projectId: string;
  type: string;
  title: string;
  description?: string;
  content?: string;
  pathScope?: string[];
  providers?: any[];
}): any {
  const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const ts = Date.now();
  const syncStatus = {};

  db.prepare(`
    INSERT INTO intelligence_documents (
      id, project_id, type, title, description, content, path_scope, providers, sync_status, ts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.type,
    data.title,
    data.description || '',
    data.content || '',
    data.pathScope ? JSON.stringify(data.pathScope) : null,
    data.providers ? JSON.stringify(data.providers) : '[]',
    JSON.stringify(syncStatus),
    ts
  );

  return {
    id,
    projectId: data.projectId,
    type: data.type,
    title: data.title,
    description: data.description || '',
    content: data.content || '',
    pathScope: data.pathScope || null,
    toolRestrictions: null,
    preferredModel: null,
    providers: data.providers || [],
    syncStatus,
    ts
  };
}

export function updateIntelDoc(db: Database, id: string, partial: any): any {
  const ts = Date.now();
  const allowed = [
    'title', 'description', 'content', 'pathScope', 'toolRestrictions',
    'preferredModel', 'providers', 'syncStatus',
    'agentModel', 'agentMaxTokens', 'agentTemperature', 'agentSkills', 'agentTools'
  ];
  const sets: string[] = ['ts = ?'];
  const vals: any[] = [ts];

  const keyMap: Record<string, string> = {
    pathScope: 'path_scope',
    toolRestrictions: 'tool_restrictions',
    preferredModel: 'preferred_model',
    syncStatus: 'sync_status',
    agentModel: 'agent_model',
    agentMaxTokens: 'agent_max_tokens',
    agentTemperature: 'agent_temperature',
    agentSkills: 'agent_skills',
    agentTools: 'agent_tools'
  };

  for (const [k, v] of Object.entries(partial)) {
    if (allowed.includes(k)) {
      const dbKey = keyMap[k] || k;
      sets.push(`${dbKey} = ?`);

      if (['pathScope', 'toolRestrictions', 'providers', 'syncStatus', 'agentSkills', 'agentTools'].includes(k)) {
         vals.push(v ? JSON.stringify(v) : null);
      } else {
        vals.push(v);
      }
    }
  }

  vals.push(id);
  db.prepare(`UPDATE intelligence_documents SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  return getIntelDoc(db, id);
}

export function deleteIntelDoc(db: Database, id: string): boolean {
  db.prepare('DELETE FROM intelligence_documents WHERE id = ?').run(id);
  return true;
}
