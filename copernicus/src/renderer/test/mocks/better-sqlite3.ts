// Minimal better-sqlite3 stub for vitest (system Node cannot load the Electron-ABI native binary).
// Covers only the subset of the API exercised by StateLedger at module init time.

class MockStatement {
  run(..._args: unknown[]) { return { changes: 0, lastInsertRowid: 0 } }
  get(..._args: unknown[]) { return undefined }
  all(..._args: unknown[]) { return [] }
}

class MockDatabase {
  pragma(_s: string) { return this }
  prepare(_sql: string) { return new MockStatement() }
  exec(_sql: string) { return this }
  transaction(fn: (...args: unknown[]) => unknown) {
    return (...args: unknown[]) => fn(...args)
  }
  close() {}
}

export default function Database(_path: string, _opts?: unknown): MockDatabase {
  return new MockDatabase()
}
