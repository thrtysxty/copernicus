import type { Database } from 'libsql';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
  down?: (db: Database) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (_db: Database) => {
      // All initial tables created in StateLedger.init() via SCHEMA
    },
  },
  {
    version: 2,
    name: 'model_calls_persona_role',
    up: (_db: Database) => {
      _db.exec("ALTER TABLE model_calls ADD COLUMN persona_role TEXT DEFAULT 'unknown'");
    },
  },
  {
    version: 3,
    name: 'replay_debugging_prompt_response_context',
    up: (_db: Database) => {
      _db.exec(`ALTER TABLE model_calls ADD COLUMN prompt_text TEXT`);
      _db.exec(`ALTER TABLE model_calls ADD COLUMN response_text TEXT`);
      _db.exec(`ALTER TABLE model_calls ADD COLUMN context_json TEXT`);
    },
  },
  {
    version: 4,
    name: 'knowledge_base_migrations',
    up: (_db: Database) => {
      // Handled by migrateKnowledgeBase() in StateLedger
    },
  },
  {
    version: 5,
    name: 'model_calls_prompt_commit',
    up: (_db: Database) => {
      _db.exec(`ALTER TABLE model_calls ADD COLUMN IF NOT EXISTS prompt_id TEXT`);
      _db.exec(`ALTER TABLE model_calls ADD COLUMN IF NOT EXISTS commit_sha TEXT`);
    },
  },
  {
    version: 6,
    name: 'projects_target_device',
    up: (_db: Database) => {
      _db.exec("ALTER TABLE projects ADD COLUMN target_device TEXT NOT NULL DEFAULT 'AGNOSTIC'");
    },
  },
  {
    version: 7,
    name: 'agent_memory_story_id',
    up: (_db: Database) => {
      _db.exec("ALTER TABLE agent_memory ADD COLUMN story_id TEXT");
      _db.exec("ALTER TABLE agent_work_log ADD COLUMN story_id TEXT");
    },
  },
  {
    version: 8,
    name: 'intelligence_documents_sync',
    up: (_db: Database) => {
      // Intelligence documents sync_status is TEXT DEFAULT '{}'
      // No ALTER needed if created with proper schema
    },
  },
];

export const MIGRATION_VERSION = 8;

export function runMigrations(db: Database, targetVersion: number = MIGRATION_VERSION): void {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion >= targetVersion) {
    return;
  }

  for (const migration of migrations) {
    if (migration.version > currentVersion && migration.version <= targetVersion) {
      try {
        migration.up(db);
        setSchemaVersion(db, migration.version);
      } catch (error) {
        throw new Error(`Migration v${migration.version} (${migration.name}) failed: ${error}`);
      }
    }
  }
}

export function getSchemaVersion(db: Database): number {
  try {
    const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    return row?.version ?? 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

export function setSchemaVersion(db: Database, version: number): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(version);
}

export function validateSchemaVersion(db: Database): void {
  const current = getSchemaVersion(db);
  if (current !== MIGRATION_VERSION) {
    throw new Error(
      `Schema version mismatch: expected ${MIGRATION_VERSION}, got ${current}. ` +
      `Run migrations or check database integrity.`
    );
  }
}