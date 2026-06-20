import type { Database } from 'libsql';

export function initCodebaseVecTable(db: Database) {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS codebase_vec USING vec0(
      chunk_id TEXT PRIMARY KEY,
      file_path TEXT,
      line_start INTEGER,
      line_end INTEGER,
      symbols TEXT,
      symbol_uid TEXT,
      lsp_metadata TEXT,
      chunk_index INTEGER,
      content TEXT,
      embedding FLOAT[768]
    );
  `);
}

export function clearCodebaseVecFile(db: Database, filePath: string) {
  db.prepare('DELETE FROM codebase_vec WHERE file_path = ?').run(filePath);
}

export function insertCodebaseVecChunk(
  db: Database,
  chunkId: string,
  filePath: string,
  lineStart: number,
  lineEnd: number,
  symbols: string,
  symbolUid: string | null,
  lspMetadata: string | null,
  chunkIndex: number,
  content: string,
  embedding: Float32Array
) {
  db.prepare(`
    INSERT INTO codebase_vec(chunk_id, file_path, line_start, line_end, symbols, symbol_uid, lsp_metadata, chunk_index, content, embedding)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chunkId, filePath, lineStart, lineEnd, symbols, symbolUid, lspMetadata, chunkIndex, content, embedding);
}

export function searchCodebaseVecBySymbol(db: Database, symbolUid: string): any[] {
  return db.prepare(`
    SELECT chunk_id, file_path, line_start, line_end, symbols, content
    FROM codebase_vec
    WHERE symbol_uid = ?
  `).all(symbolUid);
}

export function searchCodebaseVec(db: Database, embedding: Float32Array, topK: number): any[] {
  return db.prepare(`
    SELECT chunk_id, file_path, line_start, line_end, symbols, content, distance
    FROM codebase_vec
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `).all(embedding, topK);
}
