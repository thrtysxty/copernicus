import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import { StateLedger } from '../db/state-ledger';

// Constants
const SHADOW_SUFFIX = '.shadow';
const METADATA_FIELD_MAP = ['mode', 'mtime', 'atime', 'uid', 'gid'];

// Types
interface WALRecord {
  id: string;
  timestamp: number;
  transactionId: string;
  operation: 'write' | 'delete' | 'commit' | 'begin';
  filePath: string;
  prevHash?: string; // SHA-256 before modification
  prevStat?: {
    mode?: number;
    mtime?: number;
    atime?: number;
    uid?: number;
    gid?: number;
  };
  dataHash?: string; // SHA-256 of new data
  dataPath?: string; // path to shadow copy
}

interface TransactionConfig {
  id: string;
  parent?: Transaction;
  readOnly?: boolean;
}

// Utility
const ensureDir = async (dir: string) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw e;
  }
};

const sha256 = (data: Buffer | string) =>
  crypto.createHash('sha256').update(data).digest('hex');

const hashFile = async (filepath: string): Promise<string | undefined> => {
  try {
    const buffer = await fs.readFile(filepath);
    return sha256(buffer);
  } catch {
    return undefined;
  }
};

const preserveStat = async (filepath: string): Promise<WALRecord['prevStat'] | undefined> => {
  try {
    const stat = await fs.stat(filepath);
    const result: WALRecord['prevStat'] = {};
    for (const field of METADATA_FIELD_MAP) {
      if (field === 'mtime' || field === 'atime') {
        result[field] = (stat as any)[field + 'Ms'];
      } else {
        result[field as keyof typeof result] = (stat as any)[field];
      }
    }
    return result;
  } catch {
    return undefined;
  }
};

// --- Advisory Locking ---
export class AdvisoryLock {
  private fd?: fs.FileHandle;
  private lockPath: string;
  // private exclusive: boolean;

  constructor(targetPath: string, lockDir: string, _exclusive = false) {
    this.lockPath = path.join(lockDir, crypto.createHash('md5').update(targetPath).digest('hex') + '.lock');
    // this.exclusive = exclusive;
  }

  async acquire() {
    await ensureDir(path.dirname(this.lockPath));
    this.fd = await fs.open(this.lockPath, 'w');
    // Using simple file existence/open for lock in this implementation 
    // as flock requires specific platform support or libraries.
    // For a more robust implementation, we'd use a dedicated library.
  }

  async release() {
    if (this.fd) {
      await this.fd.close();
      this.fd = undefined;
      await fs.unlink(this.lockPath).catch(() => {});
    }
  }

  async with<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}

export class TransactionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TransactionError';
  }
}

export class Transaction {
  public readonly id: string;
  private walStream?: any;
  // private readonly config: TransactionConfig;
  private isCommitted = false;
  private isAborted = false;
  private readonly walFile: string;
  private readonly shadowDir: string;
  // private readonly lockDir: string;

  constructor(config: TransactionConfig, walDir: string) {
    this.id = config.id;
    // this.config = config;
    this.walFile = path.join(walDir, `wal.${this.id}.wal`);
    this.shadowDir = path.join(walDir, this.id);
    // this.lockDir = path.join(walDir, 'locks');
  }

  private async ensureWalStream(): Promise<void> {
    if (!this.walStream) {
      await ensureDir(path.dirname(this.walFile));
      this.walStream = createWriteStream(this.walFile, { flags: 'a' });
    }
  }

  private async appendRecord(record: WALRecord): Promise<void> {
    await this.ensureWalStream();
    const line = JSON.stringify(record) + '\n';
    await new Promise<void>((resolve, reject) => {
      this.walStream.write(line, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async stageWrite(filePath: string, data: string): Promise<void> {
    if (this.isCommitted || this.isAborted) throw new TransactionError('TX_CLOSED', 'TX_CLOSED');
    
    const absPath = path.resolve(filePath);
    await ensureDir(this.shadowDir);

    const prevStat = await preserveStat(absPath);
    const prevHash = await hashFile(absPath);
    const dataBuffer = Buffer.from(data);
    const dataHash = sha256(dataBuffer);

    const shadowPath = path.join(this.shadowDir, crypto.randomUUID() + SHADOW_SUFFIX);
    await fs.writeFile(shadowPath, dataBuffer);

    const record: WALRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      transactionId: this.id,
      operation: 'write',
      filePath: absPath,
      prevStat,
      prevHash,
      dataHash,
      dataPath: shadowPath,
    };

    await this.appendRecord(record);
  }

  public async commit(): Promise<void> {
    if (this.isCommitted || this.isAborted) return;

    await this.readWAL();
    const records = await this.readWAL();
    for (const rec of records) {
      if (rec.operation === 'write' && rec.dataPath) {
        await fs.copyFile(rec.dataPath, rec.filePath);
        if (rec.prevStat) {
          await fs.utimes(rec.filePath, rec.prevStat.atime! / 1000, rec.prevStat.mtime! / 1000).catch(() => {});
        }
      }
    }

    await this.appendRecord({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      transactionId: this.id,
      operation: 'commit',
      filePath: '',
    });

    this.isCommitted = true;
    await this.cleanup();
  }

  public async rollback(): Promise<void> {
    if (this.isCommitted || this.isAborted) return;
    this.isAborted = true;
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    if (this.walStream) {
      await new Promise<void>(resolve => this.walStream.end(resolve));
    }
    await fs.rm(this.shadowDir, { recursive: true, force: true }).catch(() => {});
  }

  public async readWAL(): Promise<WALRecord[]> {
    try {
      const data = await fs.readFile(this.walFile, 'utf8');
      return data.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  public async revertChanges(): Promise<void> {
    await this.readWAL();
    // Rollback is usually defined as reverting a partially applied commit or crash recovery
    // In our WAL-first model, commit IS the application.
    // If we crash before commit, we just delete the shadow files.
    await this.cleanup();
  }
}

export class TransactionManager {
  private activeTx: Transaction | null = null;
  private readonly walDir: string;
  private ledger: StateLedger;

  constructor(baseDir: string, ledger: StateLedger) {
    this.walDir = path.join(baseDir, 'wal');
    this.ledger = ledger;
  }

  public async createTransaction(id?: string): Promise<string> {
    if (this.activeTx) throw new Error('Transaction already active');
    const txId = id || crypto.randomUUID();
    this.activeTx = new Transaction({ id: txId }, this.walDir);
    return txId;
  }

  public async stageEdit(filePath: string, content: string): Promise<void> {
    if (!this.activeTx) throw new Error('No active transaction');
    await this.activeTx.stageWrite(filePath, content);
  }

  public async commit(): Promise<void> {
    if (!this.activeTx) throw new Error('No active transaction');
    const tx = this.activeTx;
    const records = await tx.readWAL();
    
    await tx.commit();
    
    // Log to ledger after successful commit
    const files = records.filter(r => r.operation === 'write').map(r => ({
      path: r.filePath,
      beforeHash: r.prevHash,
      afterHash: r.dataHash
    }));
    
    this.ledger.logTransaction({
      id: tx.id,
      status: 'COMMITTED',
      files
    });
    
    this.activeTx = null;
  }

  public async rollback(): Promise<void> {
    if (!this.activeTx) throw new Error('No active transaction');
    const tx = this.activeTx;
    const records = await tx.readWAL();
    
    await tx.rollback();
    
    // Log to ledger
    const files = records.filter(r => r.operation === 'write').map(r => ({
      path: r.filePath,
      beforeHash: r.prevHash,
      afterHash: r.dataHash
    }));
    
    this.ledger.logTransaction({
      id: tx.id,
      status: 'ROLLED_BACK',
      files
    });
    
    this.activeTx = null;
  }

  public getActiveTransactionId(): string | null {
    return this.activeTx?.id ?? null;
  }
}
