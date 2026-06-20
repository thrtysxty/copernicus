import type { Database } from 'libsql';
import DatabaseConstructor from 'libsql';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { SCHEMA } from './schema';
import { runMigrations, validateSchemaVersion, MIGRATION_VERSION } from './migrations';
import type {
  Intent, EventLog, MemoryFragment, SharedAsset,
  StoryRecord, KanbanColumnRecord, ProjectRecord,
  TestRunRecord, ModelCallRecord, ModelCallStats,
  JulesSession, WorkflowWave
} from './types';

import * as storyQueries from './queries/stories';
import * as modelQueries from './queries/model-calls';
import * as workflowQueries from './queries/workflows';
import * as memoryQueries from './queries/memory';
import * as kanbanQueries from './queries/kanban';
import * as templateQueries from './queries/templates';
import * as txQueries from './queries/transactions';
import * as projectQueries from './queries/projects';
import * as testQueries from './queries/tests';
import * as julesQueries from './queries/jules';
import * as retroQueries from './queries/retros';
import * as analyticsQueries from './queries/analytics';
import * as miscQueries from './queries/misc';
import * as intelQueries from './queries/intel';
import * as knowledgeQueries from './queries/knowledge';
import * as nlmQueries from './queries/nlm';
import * as snapshotQueries from './queries/snapshots';
import * as vecQueries from './queries/vec';
import * as migrationQueries from './queries/migrations';
import * as intentsQueries from './queries/intents';
import * as eventsQueries from './queries/events';
import * as legacyMemoryQueries from './queries/legacy-memory';
import * as assetsQueries from './queries/assets';

export type {
  Intent, EventLog, MemoryFragment, SharedAsset,
  StoryRecord, KanbanColumnRecord, ProjectRecord,
  TestRunRecord, ModelCallRecord, ModelCallStats,
  JulesSession, WorkflowWave
} from './types';

export class StateLedger {
  public db: Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath ?? path.join(app.getPath('userData'), 'copernicus.db');
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseConstructor(finalPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  private init() {
    runMigrations(this.db, MIGRATION_VERSION);
    this.db.exec(SCHEMA.intents);
    this.db.exec(SCHEMA.events);
    this.db.exec(SCHEMA.memory);
    this.db.exec(SCHEMA.shared_assets);
    this.db.exec(SCHEMA.context_snapshots);
    this.db.exec(SCHEMA.project_memory);
    this.db.exec(SCHEMA.stories);
    migrationQueries.migrateStories(this.db);
    this.db.exec(SCHEMA.jules_sessions);
    this.db.exec(SCHEMA.review_sessions);
    this.db.exec(SCHEMA.test_runs);
    this.db.exec(SCHEMA.model_calls);
    knowledgeQueries.migrateKnowledgeBase(this.db);
    this.db.exec(SCHEMA.projects);
    this.db.exec(SCHEMA.epics);
    this.db.exec(SCHEMA.dev_sessions);
    this.db.exec(SCHEMA.file_transactions);
    this.db.exec(SCHEMA.file_transaction_entries);
    this.db.exec(SCHEMA.dispatch_queue);
    this.db.exec(SCHEMA.template_overrides);
    this.db.exec(SCHEMA.workflow_snapshots);
    this.db.exec(SCHEMA.workflow_snapshots_idx);
    this.db.exec(SCHEMA.agent_worktrees);
    this.db.exec(SCHEMA.kanban_columns);
    migrationQueries.initKanbanColumns(this.db);
    this.db.exec(SCHEMA.agent_memory);
    this.db.exec(SCHEMA.agent_work_log);
    this.db.exec(SCHEMA.memory_working_set);
    this.db.exec(SCHEMA.nlm_notebooks);
    this.db.exec(SCHEMA.intelligence_documents);
    migrationQueries.migrateAgentMemory(this.db);
    validateSchemaVersion(this.db);
  }

  addAgentMemory(params: { id: string, projectId: string, bankId: string, eventType: string, content: string, importance: number, tags: string | null, entities: string | null, meta: string | null, ts: number }): void {
    memoryQueries.addAgentMemory(this.db, params);
  }
  getAllAgentMemoryForProject(projectId: string): MemoryFragment[] {
    return memoryQueries.getAllAgentMemoryForProject(this.db, projectId);
  }
  getMemoryWorkingSet(projectId: string, bankId: string, limit: number): any[] {
    return memoryQueries.getMemoryWorkingSet(this.db, projectId, bankId, limit);
  }
  getMemoryWorkingSetForProject(projectId: string, limit: number, bankId?: string): any[] {
    return memoryQueries.getMemoryWorkingSetForProject(this.db, projectId, limit, bankId);
  }
  getAgentMemoryTimeRange(projectId: string, fromTs: number, toTs: number, limit: number): MemoryFragment[] {
    return memoryQueries.getAgentMemoryTimeRange(this.db, projectId, fromTs, toTs, limit);
  }
  getAgentWorkLogTimeRange(projectId: string, fromTs: number, toTs: number, limit: number): any[] {
    return memoryQueries.getAgentWorkLogTimeRange(this.db, projectId, fromTs, toTs, limit);
  }
  recallAgentMemory(projectId: string, bankId: string, query: string, limit: number): MemoryFragment[] {
    return memoryQueries.recallAgentMemory(this.db, projectId, bankId, query, limit);
  }
  supersedeMemory(oldId: string, newId: string): void {
    memoryQueries.supersedeMemory(this.db, oldId, newId);
  }
  demoteMemoryImportance(id: string): void {
    memoryQueries.demoteMemoryImportance(this.db, id);
  }
  logAgentWork(params: { id: string, projectId: string, bankId: string, eventType: string, meta: string, ts: number }): void {
    memoryQueries.logAgentWork(this.db, params);
  }
  getAgentWorkLog(projectId: string, bankId: string, limit: number): any[] {
    return memoryQueries.getAgentWorkLog(this.db, projectId, bankId, limit);
  }
  insertWorkflowWave(id: string, workflowId: string, waveIndex: number, storyIds: string[], startedAt: number): void {
    workflowQueries.insertWorkflowWave(this.db, id, workflowId, waveIndex, storyIds, startedAt);
  }
  updateWorkflowWaveStatus(id: string, status: string, completedAt?: number): void {
    workflowQueries.updateWorkflowWaveStatus(this.db, id, status, completedAt);
  }
  getWorkflowWaves(workflowId: string): WorkflowWave[] {
    return workflowQueries.getWorkflowWaves(this.db, workflowId);
  }
  getKanbanColumns(): KanbanColumnRecord[] {
    return kanbanQueries.getKanbanColumns(this.db);
  }
  setKanbanColumn(id: string, updates: Partial<KanbanColumnRecord>): void {
    kanbanQueries.setKanbanColumn(this.db, id, updates);
  }
  getTemplateOverride(id: string): { content: string } | null {
    return templateQueries.getTemplateOverride(this.db, id);
  }
  saveTemplateOverride(id: string, content: string): void {
    templateQueries.saveTemplateOverride(this.db, id, content);
  }
  deleteTemplateOverride(id: string): void {
    templateQueries.deleteTemplateOverride(this.db, id);
  }
  logTransaction(tx: { id: string, status: string, description?: string, files: { path: string, beforeHash?: string, afterHash?: string, originalDataPath?: string }[] }): void {
    txQueries.logTransaction(this.db, tx);
  }
  getLastTransaction(): { id: string, files: { path: string, beforeHash?: string, afterHash?: string, originalDataPath?: string }[] } | null {
    return txQueries.getLastTransaction(this.db);
  }
  upsertProject(p: ProjectRecord): void {
    projectQueries.upsertProject(this.db, p);
  }
  updateProjectTargetDevice(path: string, targetDevice: string): void {
    projectQueries.updateProjectTargetDevice(this.db, path, targetDevice);
  }
  getProjectByPath(path: string): ProjectRecord | null {
    return projectQueries.getProjectByPath(this.db, path);
  }
  getActiveProject(): ProjectRecord | null {
    const { settingsStore } = require('../main');
    const p = settingsStore.get('workspace') as string;
    return p ? this.getProjectByPath(p) : null;
  }
  getProjectById(id: string): ProjectRecord | null {
    return projectQueries.getProjectById(this.db, id);
  }
  upsertTestRun(data: Omit<TestRunRecord, 'id' | 'run_at'>): number {
    return testQueries.upsertTestRun(this.db, data);
  }
  getTestRunHistory(limit = 20): TestRunRecord[] {
    return testQueries.getTestRunHistory(this.db, limit);
  }
  logModelCall(record: Omit<ModelCallRecord, 'id' | 'created_at'>): number {
    return modelQueries.logModelCall(this.db, record);
  }
  getSessionStats(session_id: string): ModelCallStats {
    return modelQueries.getSessionStats(this.db, session_id);
  }
  getRecentCalls(limit = 100, panel_id?: string): ModelCallRecord[] {
    return modelQueries.getRecentCalls(this.db, limit, panel_id);
  }
  getEditDecisionsCounts(promptId: string): { accept: number, reject: number, abort: number } {
    return modelQueries.getEditDecisionsCounts(this.db, promptId);
  }
  getAllTimeCost(): number {
    return modelQueries.getAllTimeCost(this.db);
  }
  getSessionStatsByRole(sessionId: string): { role: string, tokens: number, cost: number }[] {
    return modelQueries.getSessionStatsByRole(this.db, sessionId);
  }
  getAllTimeStatsByRole(): { role: string, tokens: number, cost: number }[] {
    return modelQueries.getAllTimeStatsByRole(this.db);
  }
  queryModelCallsSprint(since: number): object[] {
    return modelQueries.queryModelCallsSprint(this.db, since);
  }
  queryModelPerformanceSprint(since: number): object[] {
    return modelQueries.queryModelPerformanceSprint(this.db, since);
  }
  upsertJulesSession(s: JulesSession): void {
    julesQueries.upsertJulesSession(this.db, s);
  }
  getJulesSessionsByStory(story_id: string): JulesSession[] {
    return julesQueries.getJulesSessionsByStory(this.db, story_id);
  }
  listJulesSessions(status?: string): JulesSession[] {
    return julesQueries.listJulesSessions(this.db, status);
  }
  upsertStory(s: Omit<StoryRecord, 'updated_at' | 'last_synced_at'>): void {
    storyQueries.upsertStory(this.db, s as StoryRecord);
  }
  listStoriesFromDb(projectId?: string): StoryRecord[] {
    return storyQueries.listStoriesFromDb(this.db, projectId);
  }
  deleteOrphanedStories(projectId: string, validFilePaths: string[]): void {
    storyQueries.deleteOrphanedStories(this.db, projectId, validFilePaths);
  }
  getStoryById(id: string): StoryRecord | null {
    return storyQueries.getStoryById(this.db, id);
  }
  updateStoryFields(id: string, fields: Partial<Pick<StoryRecord,
    'status' | 'priority' | 'type' | 'epic' | 'assigned_to' | 'workflow_id' | 'body_md' | 'file_path' | 'flagged'
  >>): void {
    storyQueries.updateStoryFields(this.db, id, fields);
  }
  deleteStory(id: string): void {
    storyQueries.deleteStory(this.db, id);
  }
  vacuum(): void {
    this.db.exec('VACUUM')
  }
  saveSnapshot(payload: any): void {
    snapshotQueries.saveSnapshot(this.db, payload);
  }
  getLatestSnapshot(panelId: string): any | null {
    return snapshotQueries.getLatestSnapshot(this.db, panelId);
  }
  insertAgentWorkLog(params: { id: string, projectId: string, bankId: string, eventType: string, meta: string, ts: number }): void {
    miscQueries.insertAgentWorkLog(this.db, params);
  }
  getFailedAgentWorkLog(projectId: string, storyId: string, failedAgentId: string): any[] {
    return miscQueries.getFailedAgentWorkLog(this.db, projectId, storyId, failedAgentId);
  }
  addProjectMemory(payload: { content: string, importance?: number, source: string }): void {
    miscQueries.addProjectMemory(this.db, payload);
  }
  searchProjectMemory(limit: number = 5): MemoryFragment[] {
    return miscQueries.searchProjectMemory(this.db, limit);
  }
  listRetroReports(projectId: string): any[] {
    return retroQueries.listRetroReports(this.db, projectId);
  }
  getRetroReport(id: string): any {
    return retroQueries.getRetroReport(this.db, id);
  }
  createRetroReport(data: {
    project_id: string; scope: string; status: string; ts_generated: number;
    ts_approved?: number; sessions_range: string; inflection_ids?: string;
    items: { item_type: string; content: string; target?: string; importance?: number;
      supersedes_memory_id?: string; status: string; edited_content?: string; ts: number }[]
  }): string {
    return retroQueries.createRetroReport(this.db, data);
  }
  updateRetroItem(id: string, data: { status: string; edited_content?: string }): boolean {
    return retroQueries.updateRetroItem(this.db, id, data);
  }
  approveRetroReport(id: string, originatedStories: string[]): boolean {
    return retroQueries.approveRetroReport(this.db, id, originatedStories);
  }
  pushRetroReady(id: string): boolean {
    return retroQueries.pushRetroReady(this.db, id);
  }
  upsertKbArticle(doc: {
    id: string; title: string; section: string; tags: string[];
    source: string; version: number; content: string; excerpt?: string;
  }): void {
    knowledgeQueries.upsertKbArticle(this.db, doc);
  }
  listKbArticles(): Record<string, any[]> {
    return knowledgeQueries.listKbArticles(this.db);
  }
  getKbArticle(id: string): any {
    return knowledgeQueries.getKbArticle(this.db, id);
  }
  searchKbArticles(query: string): any[] {
    return knowledgeQueries.searchKbArticles(this.db, query);
  }
  listIntelDocs(projectId: string): any[] {
    return intelQueries.listIntelDocs(this.db, projectId);
  }
  getIntelDoc(id: string): any {
    return intelQueries.getIntelDoc(this.db, id);
  }
  createIntelDoc(data: {
    projectId: string; type: string; title: string;
    description?: string; content?: string; pathScope?: string[]; providers?: any[];
  }): any {
    return intelQueries.createIntelDoc(this.db, data);
  }
  updateIntelDoc(id: string, partial: any): any {
    return intelQueries.updateIntelDoc(this.db, id, partial);
  }
  deleteIntelDoc(id: string): boolean {
    return intelQueries.deleteIntelDoc(this.db, id);
  }
  getNlmNotebooks() {
    return nlmQueries.getNlmNotebooks(this.db);
  }
  registerNlmNotebook(notebook: { id: string; name: string; domain: string; description: string }) {
    return nlmQueries.registerNlmNotebook(this.db, notebook);
  }
  removeNlmNotebook(id: string) {
    return nlmQueries.removeNlmNotebook(this.db, id);
  }
  initCodebaseVecTable() {
    vecQueries.initCodebaseVecTable(this.db);
  }
  clearCodebaseVecFile(filePath: string) {
    vecQueries.clearCodebaseVecFile(this.db, filePath);
  }
  insertCodebaseVecChunk(
    chunkId: string, filePath: string, lineStart: number, lineEnd: number,
    symbols: string, symbolUid: string | null, lspMetadata: string | null,
    chunkIndex: number, content: string, embedding: Float32Array
  ) {
    vecQueries.insertCodebaseVecChunk(this.db, chunkId, filePath, lineStart, lineEnd, symbols, symbolUid, lspMetadata, chunkIndex, content, embedding);
  }
  searchCodebaseVecBySymbol(symbolUid: string): any[] {
    return vecQueries.searchCodebaseVecBySymbol(this.db, symbolUid);
  }
  searchCodebaseVec(embedding: Float32Array, topK: number): any[] {
    return vecQueries.searchCodebaseVec(this.db, embedding, topK);
  }
  getDailyCosts(days: number): any[] {
    return analyticsQueries.getDailyCosts(this.db, days);
  }
  getCostByModel(): any[] {
    return analyticsQueries.getCostByModel(this.db);
  }
  getCostByStory(): any[] {
    return analyticsQueries.getCostByStory(this.db);
  }
  getWeeklyVelocity(weeks: number): any[] {
    return analyticsQueries.getWeeklyVelocity(this.db, weeks);
  }
  getCostHeatmapData(): { churnMap: Record<string, number>, costMap: Record<string, number> } {
    return analyticsQueries.getCostHeatmapData(this.db);
  }
  getCapexLeaderboard(days: number | 'all'): any[] {
    return analyticsQueries.getCapexLeaderboard(this.db, days);
  }
  getStoriesThroughput(): any[] {
    return analyticsQueries.getStoriesThroughput(this.db);
  }
  getStoriesStatusDistribution(): any[] {
    return analyticsQueries.getStoriesStatusDistribution(this.db);
  }
  getStoriesBugsByAssignee(): any[] {
    return analyticsQueries.getStoriesBugsByAssignee(this.db);
  }
  logIntent(content: string, status: string = 'pending', agent_id: string = 'default'): number {
    return intentsQueries.logIntent(this.db, content, status, agent_id);
  }
  getRecentIntents(limit: number = 10): Intent[] {
    return intentsQueries.getRecentIntents(this.db, limit);
  }
  logEvent(type: string, content: string, metadata: any = {}, agent_id: string = 'default'): number {
    return eventsQueries.logEvent(this.db, type, content, metadata, agent_id);
  }
  getRecentEvents(limit: number = 50): EventLog[] {
    return eventsQueries.getRecentEvents(this.db, limit);
  }
  addMemory(content: string, tags: string[] = [], agent_id: string = 'default'): number {
    return legacyMemoryQueries.addMemory(this.db, content, tags, agent_id);
  }
  searchMemory(query: string): MemoryFragment[] {
    return legacyMemoryQueries.searchMemory(this.db, query);
  }
  registerAsset(assetPath: string, type: string, content_hash?: string) {
    assetsQueries.registerAsset(this.db, assetPath, type, content_hash);
  }
  findAsset(assetPath: string): SharedAsset | undefined {
    return assetsQueries.findAsset(this.db, assetPath);
  }
  runTransaction(fn: () => void): void {
    this.db.transaction(fn)();
  }
  close() {
    this.db.close();
  }
}

// Module-level singleton for use across main-process modules
export const stateLedger = new StateLedger()
