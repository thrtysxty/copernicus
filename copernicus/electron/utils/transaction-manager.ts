import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import log from 'electron-log'

export interface Transaction {
  id: string
  timestamp: number
  backups: Record<string, string> // originalFilePath -> backupFilePath
  pending: Record<string, string> // originalFilePath -> newContent
}

export class TransactionManager {
  private transactionsDir: string
  private activeTransaction: Transaction | null = null

  constructor(baseDir: string) {
    this.transactionsDir = path.join(baseDir, 'transactions')
    if (!fs.existsSync(this.transactionsDir)) {
      fs.mkdirSync(this.transactionsDir, { recursive: true })
    }
  }

  createTransaction(): string {
    if (this.activeTransaction) {
      throw new Error(`Transaction ${this.activeTransaction.id} already active`)
    }
    const id = randomUUID()
    this.activeTransaction = {
      id,
      timestamp: Date.now(),
      backups: {},
      pending: {}
    }
    log.info(`[TransactionManager] Created transaction: ${id}`)
    return id
  }

  stageEdit(originalPath: string, content: string): void {
    if (!this.activeTransaction) {
      throw new Error('No active transaction')
    }

    // Only backup if we haven't already backed up this file in this transaction
    if (!this.activeTransaction.backups[originalPath]) {
      if (fs.existsSync(originalPath)) {
        const backupFileName = `${this.activeTransaction.id}_${path.basename(originalPath)}_${Date.now()}.bak`
        const backupPath = path.join(this.transactionsDir, backupFileName)
        fs.copyFileSync(originalPath, backupPath)
        this.activeTransaction.backups[originalPath] = backupPath
      } else {
        // Sentinel for new file creation
        this.activeTransaction.backups[originalPath] = 'NEW_FILE'
      }
    }

    this.activeTransaction.pending[originalPath] = content
    log.info(`[TransactionManager] Staged edit for: ${originalPath}`)
  }

  commit(): void {
    if (!this.activeTransaction) {
      throw new Error('No active transaction')
    }

    try {
      for (const [originalPath, content] of Object.entries(this.activeTransaction.pending)) {
        const dir = path.dirname(originalPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(originalPath, content, 'utf-8')
      }
      log.info(`[TransactionManager] Committed transaction: ${this.activeTransaction.id}`)
      this.cleanup()
    } catch (err) {
      log.error(`[TransactionManager] Commit failed, rolling back: ${this.activeTransaction.id}`, err)
      this.rollback()
      throw err
    }
  }

  rollback(): void {
    if (!this.activeTransaction) {
      throw new Error('No active transaction')
    }

    for (const [originalPath, backupPath] of Object.entries(this.activeTransaction.backups)) {
      if (backupPath === 'NEW_FILE') {
        if (fs.existsSync(originalPath)) {
          fs.unlinkSync(originalPath)
        }
      } else {
        fs.copyFileSync(backupPath, originalPath)
      }
    }
    log.info(`[TransactionManager] Rolled back transaction: ${this.activeTransaction.id}`)
    this.cleanup()
  }

  private cleanup(): void {
    if (!this.activeTransaction) return

    // Remove backup files
    for (const backupPath of Object.values(this.activeTransaction.backups)) {
      if (backupPath !== 'NEW_FILE' && fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath)
      }
    }

    this.activeTransaction = null
  }

  getActiveTransactionId(): string | null {
    return this.activeTransaction?.id ?? null
  }
}
