import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { stateLedger } from '../db/state-ledger';

export class JsonlExporter {
  public async export(projectId: string): Promise<void> {
    const exportDir = path.join(app.getPath('userData'), 'memory', this.hashProjectId(projectId));
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const rows = stateLedger.getAllAgentMemoryForProject(projectId);

    // Group by bank_id
    const banks = new Map<string, any[]>();
    for (const row of rows) {
      const bankId = row.bank_id ?? 'default';
      if (!banks.has(bankId)) banks.set(bankId, []);
      banks.get(bankId)!.push(row);
    }

    // Write one file per bank_id, overwriting existing
    for (const [bankId, bankRows] of banks.entries()) {
      const filePath = path.join(exportDir, `${bankId}.jsonl`);
      const lines = bankRows.map(row => {
        return JSON.stringify({
          id: row.id,
          bank_id: row.bank_id ?? 'default',
          event_type: row.event_type ?? 'memory_fact',
          content: row.content,
          importance: row.importance,
          tags: row.tags ? JSON.parse(row.tags) : undefined,
          entities: row.entities ? JSON.parse(row.entities) : undefined,
          meta: row.meta ? JSON.parse(row.meta) : undefined,
          ts: row.ts
        });
      });
      // Ensure the content ends with a newline, but if no lines just write empty
      fs.writeFileSync(filePath, lines.length > 0 ? lines.join('\n') + '\n' : '', 'utf-8');
    }
  }

  public hashProjectId(id: string): string {
    return crypto.createHash('sha1').update(id).digest('hex').slice(0, 12);
  }
}

export const jsonlExporter = new JsonlExporter();
