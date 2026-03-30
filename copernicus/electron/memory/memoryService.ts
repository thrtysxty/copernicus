import log from '../utils/logger'
import * as crypto from 'crypto';
import path from 'node:path';
import { stateLedger } from '../db/state-ledger';
import { MemoryRow, WorkLogRow } from '../../src/renderer/types/memory';
import { retroTrigger } from '../retro/retro-trigger';

export interface AddMemoryParams {
  projectId: string;
  bankId: string;
  eventType: string;
  content: string;
  importance?: number;
  tags?: string[];
  entities?: string[];
  meta?: any;
}

export interface LogWorkParams {
  projectId: string;
  bankId: string;
  eventType: string;
  meta: any;
}

export class MemoryService {
  public activeProjectId: string = '';

  public setActiveProject(dirPath: string): void {
    if (!dirPath) {
      this.activeProjectId = '';
    } else {
      this.activeProjectId = path.resolve(dirPath);
    }
  }

  async addMemory(params: AddMemoryParams): Promise<string> {
    if (!this.activeProjectId) {
      log.error('Memory write rejected: activeProjectId is empty');
      return '';
    }

    const id = crypto.randomUUID();
    const ts = Math.floor(Date.now() / 1000);
    const tagsStr = params.tags ? JSON.stringify(params.tags) : null;
    const entitiesStr = params.entities ? JSON.stringify(params.entities) : null;
    const metaStr = params.meta ? JSON.stringify(params.meta) : null;

    stateLedger.addAgentMemory({
      id,
      projectId: this.activeProjectId,
      bankId: params.bankId,
      eventType: params.eventType,
      content: params.content,
      importance: params.importance ?? 5,
      tags: tagsStr,
      entities: entitiesStr,
      meta: metaStr,
      ts
    });

    if (params.eventType === 'session_start') {
      retroTrigger.checkAndTrigger(this.activeProjectId).catch(err => {
        log.error('Failed to check and trigger retro:', err);
      });
    }

    return id;
  }

  async getWorkingSet(projectId: string, bankId: string, limit: number = 50): Promise<MemoryRow[]> {
    const rows = stateLedger.getMemoryWorkingSet(projectId, bankId, limit);

    return rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      bankId: r.bank_id,
      eventType: r.event_type,
      content: r.content,
      importance: r.importance,
      tags: r.tags ? JSON.parse(r.tags) : undefined,
      entities: r.entities ? JSON.parse(r.entities) : undefined,
      meta: r.meta ? JSON.parse(r.meta) : undefined,
      supersedesId: r.supersedes_id,
      ts: r.ts,
      score: r.score
    }));
  }

  async supersede(oldId: string, newId: string): Promise<void> {
    stateLedger.supersedeMemory(oldId, newId);
  }

  async logWork(params: LogWorkParams): Promise<string> {
    if (!this.activeProjectId) {
      log.error('Memory write rejected: activeProjectId is empty');
      return '';
    }

    const id = crypto.randomUUID();
    const ts = Math.floor(Date.now() / 1000);
    const metaStr = JSON.stringify(params.meta);

    stateLedger.logAgentWork({
      id,
      projectId: this.activeProjectId,
      bankId: params.bankId,
      eventType: params.eventType,
      meta: metaStr,
      ts
    });

    return id;
  }

  async getWorkLog(projectId: string, bankId: string, limit: number = 50): Promise<WorkLogRow[]> {
    const rows = stateLedger.getAgentWorkLog(projectId, bankId, limit);

    return rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      bankId: r.bank_id,
      eventType: r.event_type,
      meta: JSON.parse(r.meta),
      ts: r.ts
    }));
  }
}

export const memoryService = new MemoryService();
