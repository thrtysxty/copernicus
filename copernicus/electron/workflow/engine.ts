import { WorkflowState, VALID_TRANSITIONS } from './states';
import { WorkflowGraph, WFNode, NodeStatus, WorkflowExecutionEvent, WorkflowStepStartEvent, WorkflowStepEndEvent } from './types';
import type { AuthManager } from '../auth-manager';
import type { ModelRegistry } from '../models/model-registry';
import type { PTYManager } from '../pty-manager';
import type { StateLedger } from '../db/state-ledger';
import type { FSManager } from '../fs-manager';
import type { TriggerNodeData } from './types';
import type { BrowserWindow } from 'electron';
import type { JulesManager } from '../jules/jules-manager';
import type { GithubManager } from '../github-manager';
import type { StoriesManager } from '../stories';
import { ExtensionRegistry } from '../extensions/ExtensionRegistry'; // Import as a concrete class
import log from '../utils/logger';
import path from 'path';
import { SnapshotManager } from './snapshot-manager';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type StateCallback = (event: WorkflowExecutionEvent) => void;

export interface EngineServices {
  authManager: AuthManager;
  modelRegistry: ModelRegistry;
  ptyManager: PTYManager;
  stateLedger: StateLedger;
  fsManager: FSManager;
  win: BrowserWindow;
  julesManager: JulesManager;
  githubManager: GithubManager;
  storiesManager: StoriesManager;
  lspManager: import('../lsp/lsp-manager').LspManager;
  worktreeManager?: import('../worktree/WorktreeManager').WorktreeManager;
  snapshotManager: SnapshotManager;
  extensionRegistry: ExtensionRegistry;
}

export class WorkflowEngine {
  private currentState: WorkflowState = 'IDLE';
  private nodeStatuses: Map<string, { status: NodeStatus; error?: string }> = new Map();
  private context: Map<string, string> = new Map();
  private currentTurn: number = 0;
  private services: EngineServices | null = null;

  constructor(private snapshotManager?: SnapshotManager) {
    log.info('[SYSTEM] WorkflowEngine Initialized in IDLE state.');
  }

  public setServices(services: EngineServices): void {
    this.services = services;
  }

  public setSnapshotManager(manager: SnapshotManager): void {
    this.snapshotManager = manager;
  }

  public getState(): WorkflowState {
    return this.currentState;
  }

  public getNodeStatuses(): Record<string, NodeStatus> {
    const statuses: Record<string, NodeStatus> = {};
    for (const [id, info] of this.nodeStatuses) {
      statuses[id] = info.status;
    }
    return statuses;
  }

  public getNodeStatusDetails(): Record<string, { status: NodeStatus; error?: string }> {
    return Object.fromEntries(this.nodeStatuses);
  }

  public getContext(): Record<string, string> {
    return Object.fromEntries(this.context);
  }

  public updateContext(obj: Record<string, string>): void {
    for (const [k, v] of Object.entries(obj)) {
      this.context.set(k, String(v));
    }
  }

  public reset(): void {
    log.info('[WorkflowEngine] Administrative reset to IDLE.');
    this.currentState = 'IDLE';
    this.nodeStatuses.clear();
    this.context.clear();
    this.currentTurn = 0;
  }

  public transition(newState: WorkflowState): boolean {
    const isValid = VALID_TRANSITIONS.some(
      t => t.from === this.currentState && t.to === newState
    );

    if (isValid) {
      log.info(`[WorkflowEngine] Transition: ${this.currentState} -> ${newState}`);
      this.currentState = newState;
      if (this.services?.win) {
        this.services.win.webContents.send('workflow:status-update', {
          status: newState,
          isGlobalState: true,
          timestamp: Date.now()
        });
      }
      return true;
    }

    log.warn(`[SECURITY] Invalid workflow transition attempted: ${this.currentState} -> ${newState}`);
    return false;
  }

  public async runGraph(graph: WorkflowGraph, callback?: StateCallback): Promise<void> {
    if (!this.transition('RUNNING')) {
      throw new Error('WorkflowEngine could not transition to RUNNING state.');
    }

    this.nodeStatuses.clear();
    this.context.clear();

    // Inject LSP state into context bag for agent awareness
    try {
      const allDiags = [...(this.services?.lspManager as any)?.diagnosticsCache?.values() ?? []]
      const errors = allDiags.flat().filter((d: any) => d.severity === 1) // LSP: 1=error
      const errorCount = errors.length
      if (errorCount > 0) {
        this.context.set('__lspErrors', JSON.stringify({ errorCount, summary: `${errorCount} TypeScript error(s) in workspace` }))
      }
    } catch { /* lspManager not yet available — safe to ignore */ }

    this.context.set('__workflowId', graph.id);
    this.currentTurn = 0;
    this.snapshotManager?.beginRun()
    graph.nodes.forEach(n => this.nodeStatuses.set(n.id, { status: 'idle' }));

    const triggerNode = graph.nodes.find(n => n.type === 'trigger');
    if (triggerNode?.data) {
      const td = triggerNode.data as TriggerNodeData;
      if (td.storyId) this.context.set('__storyId', String(td.storyId));
    }

    try {
      const sortedNodes = this.topologicalSort(graph);
      const skipped = new Set<string>();

      log.info('[WorkflowEngine] Execution Order:', sortedNodes.map(n => n.id).join(' -> '));

      for (const node of sortedNodes) {
        if (skipped.has(node.id)) {
          this.updateNodeStatus(node.id, 'skipped', undefined, callback);
          if (this.services?.win) {
            this.services.win.webContents.send('workflow:step-end', {
              workflowId: graph.id,
              nodeId: node.id,
              status: 'skipped',
              durationMs: 0,
              timestamp: Date.now()
            } as WorkflowStepEndEvent);
          }
          continue;
        }

        await this.executeNode(node, callback);

        if (node.type === 'decision') {
          const branch = this.context.get(node.id) ?? 'Yes';
          graph.edges
            .filter(e => e.source === node.id && e.label && e.label !== branch)
            .forEach(e => this.markSubtreeSkipped(e.target, graph, skipped));
        }
      }

      this.transition('COMPLETE');
    } catch (error: unknown) {
      log.error('[WorkflowEngine] Execution Failed:', error);
      this.transition('FAILED');
      // Optionally push a global error if needed, but per-node errors are more granular
    } finally {
      this.snapshotManager?.endRun()
      const { browserSession } = await import('../browser-session')
      if (browserSession.browser) {
        await browserSession.browser.close().catch(() => {})
        browserSession.browser = null
        browserSession.page = null
      }
    }
  }

  private markSubtreeSkipped(
    nodeId: string,
    graph: WorkflowGraph,
    skipped: Set<string>
  ): void {
    if (skipped.has(nodeId)) return;
    skipped.add(nodeId);
    graph.edges
      .filter(e => e.source === nodeId)
      .forEach(e => this.markSubtreeSkipped(e.target, graph, skipped));
  }

  private topologicalSort(graph: WorkflowGraph): WFNode[] {
    const { nodes, edges } = graph;
    const inDegree: Map<string, number> = new Map();
    const adj: Map<string, string[]> = new Map();

    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    });

    edges.forEach(edge => {
      if (adj.has(edge.source) && inDegree.has(edge.target)) {
        adj.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
    });

    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    const sorted: WFNode[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const node = nodes.find(n => n.id === u);
      if (node) sorted.push(node);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        inDegree.set(v, (inDegree.get(v)!) - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Workflow contains a cycle or invalid nodes.');
    }

    return sorted;
  }

  private async executeNode(node: WFNode, callback?: StateCallback): Promise<void> {
    this.currentTurn++;
    const workflowId = this.context.get('__workflowId') ?? 'unknown';
    const startTime = Date.now();

    if (this.services?.win) {
      this.services.win.webContents.send('workflow:step-start', {
        workflowId,
        nodeId: node.id,
        nodeType: node.type,
        turn: this.currentTurn,
        timestamp: startTime
      } as WorkflowStepStartEvent);
    }

    this.updateNodeStatus(node.id, 'running', undefined, callback);

    try {
      let output = '';

      switch (node.type) {
        case 'trigger':
          const triggerNodeData = node.data as TriggerNodeData;
          if (triggerNodeData?.variant === 'story-activated' && triggerNodeData.storyId) {
            this.context.set('__storyId', triggerNodeData.storyId);
          }
          output = `trigger:${triggerNodeData?.variant ?? 'manual'}`;
          break;
        case 'agent':
          output = await this.dispatchAgent(node);
          break;
        case 'tool':
          output = await this.dispatchTool(node);
          break;
        case 'decision':
          output = await this.dispatchDecision(node);
          break;
        case 'flow':
          output = await this.dispatchFlow(node);
          break;
        case 'verification':
          output = await this.dispatchVerification(node);
          break;
        case 'extension':
          output = await this.dispatchExtension(node);
          break;
        default:
          output = `unknown:${node.type}`;
      }

      this.context.set(node.id, output);
      if (node.type !== 'decision') this.context.set('__lastOutput', output);
      this.updateNodeStatus(node.id, 'completed', undefined, callback);

      const endTime = Date.now();
      if (this.services?.win) {
        this.services.win.webContents.send('workflow:step-end', {
          workflowId,
          nodeId: node.id,
          status: 'completed',
          durationMs: endTime - startTime,
          timestamp: endTime
        } as WorkflowStepEndEvent);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.context.set(node.id, `ERROR:${msg}`);
      this.updateNodeStatus(node.id, 'error', msg, callback);

      const endTime = Date.now();
      if (this.services?.win) {
        this.services.win.webContents.send('workflow:step-end', {
          workflowId,
          nodeId: node.id,
          status: 'error',
          durationMs: endTime - startTime,
          timestamp: endTime
        } as WorkflowStepEndEvent);
      }

      throw err;
    }
  }

  private async dispatchAgent(node: WFNode): Promise<string> {
    if (!this.services) throw new Error('ENGINE_SERVICES_NOT_INJECTED');

    const { authManager } = this.services;
    const d = node.data as import('./types').AgentNodeData;

    if (d.useWorktree && this.services?.worktreeManager) {
      const branch = `agent-${node.id}-${Date.now()}`
      const wt = this.services.worktreeManager.create(
        branch,
        this.context.get('__storyId') ?? null,
        node.id,
        d.mergeMode ?? 'gated'
      )
      this.context.set('__worktreePath', wt.worktreePath)
      this.context.set('__worktreeBranch', branch)
    }

    const apiKey = authManager.getApiKey(d.provider);
    if (!apiKey && d.provider !== 'ollama' && d.provider !== 'ollama-anthropic') {
      throw new Error(`AUTH_MISSING:${d.provider}`);
    }

    const task = this.interpolate(d.task ?? '');
    const systemPrompt = d.systemPrompt || `You are a ${d.persona ?? 'helpful assistant'}.`;

    let tools: any[] | undefined = undefined;
    if (node.role && ['executor', 'researcher', 'planner'].includes(node.role)) {
      const { RECALL_MEMORY_TOOL } = await import('../llm/tools');
      tools = [RECALL_MEMORY_TOOL];
    }

    if (d.provider === 'anthropic') {
      const body: any = {
        model: d.modelId,
        max_tokens: d.maxTokens ?? 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: task }],
      };
      if (tools && tools.length > 0) {
        body.tools = tools;
      }
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
      const json = await res.json() as any;
      
      let output = json.content?.[0]?.text ?? '';
      
      // Handle potential tool calls
      if (json.stop_reason === 'tool_use' && json.content) {
        const toolUse = json.content.find((c: any) => c.type === 'tool_use');
        if (toolUse && toolUse.name === 'recall_memory') {
          const { ToolExecutor } = await import('../llm/tools');
          const executor = new ToolExecutor();
          const rootPath = this.services.fsManager.getRootPath();
          const projectId = rootPath ? (this.services.stateLedger.getProjectByPath(rootPath)?.id ?? 'default') : 'default';
          const bankId = `workflow:node:${node.id}`;
          const toolResult = await executor.execute(toolUse.name, toolUse.input, { projectId, bankId });
          
          const followUpBody = {
            ...body,
            messages: [
              { role: 'user', content: task },
              { role: 'assistant', content: json.content },
              { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }] }
            ]
          };
          const followUpRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey ?? '',
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(followUpBody),
            signal: AbortSignal.timeout(120_000),
          });
          if (!followUpRes.ok) throw new Error(`Anthropic tool follow-up error ${followUpRes.status}`);
          const followUpJson = await followUpRes.json() as any;
          output = followUpJson.content?.[0]?.text ?? '';
        }
      }
      
      if (d.outputChannel === 'file' && d.outputFile) {
        this.services.fsManager.writeFile(d.outputFile, output);
      }
      return output;
    }

    if (d.provider === 'ollama-anthropic') {
      const { dispatchOllamaAnthropic } = await import('../llm/providers/ollama-anthropic');
      return await dispatchOllamaAnthropic({
        modelId: d.modelId,
        systemPrompt,
        task,
        maxTokens: d.maxTokens,
        baseUrl: process.env.OLLAMA_BASE_URL,
      });
    }

    // All other providers use OpenAI-compatible /chat/completions
    const baseUrl = this.resolveBaseUrl(d.provider);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const body: any = {
      model: d.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: task },
      ],
      temperature: d.temperature ?? 0.7,
      max_tokens: d.maxTokens ?? 2048,
    };
    
    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema || t.parameters
        }
      }));
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${d.provider} error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json() as any;
    let output: string = json.choices?.[0]?.message?.content ?? '';
    
    // Handle potential tool calls
    if (json.choices?.[0]?.finish_reason === 'tool_calls' || json.choices?.[0]?.message?.tool_calls) {
      const toolCall = json.choices[0].message.tool_calls[0];
      if (toolCall && toolCall.function.name === 'recall_memory') {
        const { ToolExecutor } = await import('../llm/tools');
        const executor = new ToolExecutor();
        const rootPath = this.services.fsManager.getRootPath();
        const projectId = rootPath ? (this.services.stateLedger.getProjectByPath(rootPath)?.id ?? 'default') : 'default';
        const bankId = `workflow:node:${node.id}`;
        let inputArgs = {};
        try { inputArgs = JSON.parse(toolCall.function.arguments); } catch (e) {}
        const toolResult = await executor.execute(toolCall.function.name, inputArgs, { projectId, bankId });
        
        const followUpBody = {
          ...body,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task },
            json.choices[0].message,
            { role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: toolResult }
          ]
        };
        const followUpRes = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(followUpBody),
          signal: AbortSignal.timeout(120_000),
        });
        if (!followUpRes.ok) throw new Error(`${d.provider} tool follow-up error ${followUpRes.status}`);
        const followUpJson = await followUpRes.json() as any;
        output = followUpJson.choices?.[0]?.message?.content ?? '';
      }
    }

    if (d.outputChannel === 'file' && d.outputFile) {
      this.services.fsManager.writeFile(d.outputFile, output);
    }

    return output;
  }

  private async dispatchTool(node: WFNode): Promise<string> {
    if (!this.services) throw new Error('ENGINE_SERVICES_NOT_INJECTED');
    const { stateLedger, fsManager, win } = this.services;
    const d = node.data as import('./types').ToolNodeData;

    switch (d.variant) {
      case 'shell-command': {
        if (!d.command) throw new Error('shell-command: command is required');
        return await this.runShell(d.command);
      }
      case 'makefile-run': {
        const target = d.command ?? 'test';
        return await this.runShell(`make ${target.trim()}`);
      }
      case 'file-read': {
        if (!d.filePath) throw new Error('file-read: filePath is required');
        return fsManager.readFile(d.filePath);
      }
      case 'file-write': {
        if (!d.filePath) throw new Error('file-write: filePath is required');
        const content = this.interpolate(d.content ?? '');
        await fsManager.writeFile(d.filePath, content);
        return `written:${d.filePath}`;
      }
      case 'story-update': {
        if (d.field === 'status' && d.storyId && d.value) {
          this.services.storiesManager.updateStoryStatus(d.storyId, d.value);
        }
        stateLedger.logEvent(
          'STORY_UPDATE',
          JSON.stringify({ field: d.field, value: d.value, storyId: d.storyId }),
          {},
          'workflow'
        );
        return `story-update:${d.field}=${d.value}`;
      }
      case 'log-event': {
        const msg = this.interpolate(d.message ?? '');
        stateLedger.logEvent('WORKFLOW_LOG', msg, {}, 'workflow');
        return `logged:${msg}`;
      }
      case 'send-chat': {
        const msg = this.interpolate(d.message ?? '');
        stateLedger.logEvent('CHAT_MESSAGE', msg, {}, 'workflow');
        return `chat:${msg}`;
      }
      case 'notify': {
        const { Notification } = await import('electron');
        new Notification({ title: 'COPERNICUS', body: d.message ?? '' }).show();
        return `notify:${d.message}`;
      }
      case 'screenshot': {
        const image = await win.webContents.capturePage();
        const base64 = image.toPNG().toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;
        win.webContents.send('canvas:render', { 
          content: `<img src="${dataUrl}" style="max-width:100%;display:block;margin:auto;" />` 
        });
        return 'screenshot:captured';
      }
      case 'browser-action': {
        const { browserSession } = await import('../browser-session')
        const action = d.action
        if (!action) throw new Error('browser-action: action is required')

        stateLedger.logEvent('BROWSER_ACTION', action, { url: d.url, selector: d.selector }, 'workflow')

        switch (action) {
          case 'launch': {
            const { chromium } = await import('playwright-core')
            if (browserSession.browser) await browserSession.browser.close()
            browserSession.browser = await chromium.launch({ headless: true })
            const context = await browserSession.browser.newContext()
            browserSession.page = await context.newPage()
            return 'browser:launched'
          }
          case 'navigate': {
            if (!browserSession.page) throw new Error('NO_BROWSER_SESSION')
            const url = this.interpolate(d.url ?? '')
            await browserSession.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
            return `browser:navigated:${browserSession.page.url()}`
          }
          case 'click': {
            if (!browserSession.page) throw new Error('NO_BROWSER_SESSION')
            await browserSession.page.click(d.selector!, { timeout: 10000 })
            return `browser:clicked:${d.selector}`
          }
          case 'fill': {
            if (!browserSession.page) throw new Error('NO_BROWSER_SESSION')
            const val = this.interpolate(d.value ?? '')
            await browserSession.page.fill(d.selector!, val)
            return `browser:filled:${d.selector}`
          }
          case 'screenshot': {
            if (!browserSession.page) throw new Error('NO_BROWSER_SESSION')
            const buffer = await browserSession.page.screenshot({ fullPage: false })
            const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
            win.webContents.send('canvas:render', { content: `<img src="${dataUrl}" style="max-width:100%;display:block;margin:auto;" />` })
            return 'browser:screenshot:captured'
          }
          case 'close': {
            if (browserSession.browser) {
              await browserSession.browser.close()
              browserSession.browser = null
              browserSession.page = null
            }
            return 'browser:closed'
          }
          default:
            throw new Error(`browser-action: unknown action: ${action}`)
        }
      }
      case 'jules-watch': {
        const sessionId = this.context.get('__julesSessionId')
        if (!sessionId) throw new Error('jules-watch: __julesSessionId not in context')
        const { julesManager } = this.services
        let jStatus = 'pending'
        while (jStatus === 'pending' || jStatus === 'running') {
          await sleep(30_000)
          const session = await julesManager.getSessionStatus(sessionId)
          if (!session) throw new Error(`jules-watch: session ${sessionId} not found`)
          jStatus = session.status
          if (session.pr_number != null) this.context.set('__prNumber', String(session.pr_number))
          if (session.pr_url)   this.context.set('__prUrl',  session.pr_url)
          if (session.repo)     this.context.set('__repo',   session.repo)
        }
        if (jStatus === 'failed') throw new Error('jules-watch: Jules session failed')
        return `jules-watch:completed:${sessionId}`
      }
      case 'github-fetch-diff': {
        const prNumberStr = this.context.get('__prNumber')
        const repo        = this.context.get('__repo')
        if (!prNumberStr || !repo) throw new Error('github-fetch-diff: __prNumber or __repo missing from context')
        const prNumber = parseInt(prNumberStr, 10)
        const diff = await this.services.githubManager.getPrDiff(repo, prNumber)
        this.context.set('__prDiff', diff)
        return `github-fetch-diff:${diff.length}chars`
      }
      case 'github-post-comment': {
        const prNumberStr = this.context.get('__prNumber')
        const repo        = this.context.get('__repo')
        const body        = this.context.get('__lastOutput') ?? ''
        if (!prNumberStr || !repo) throw new Error('github-post-comment: __prNumber or __repo missing from context')
        const prNumber = parseInt(prNumberStr, 10)
        await this.services.githubManager.postPrComment(repo, prNumber, body)
        return 'github-post-comment:posted'
      }
      case 'kanban-flag-card': {
        const storyId = this.context.get('__storyId')
        if (!storyId) throw new Error('kanban-flag-card: __storyId missing from context')
        this.services.storiesManager.setField(storyId, 'flagged', true)
        this.services.win.webContents.send('stories:updated', this.services.storiesManager.listStories())
        return `kanban-flag-card:flagged:${storyId}`
      }
      case 'db-query': {
        if (!d.query) throw new Error('db-query: query is required');
        const key = d.contextKey ?? 'db_result';
        const since = Date.now() - 14 * 24 * 60 * 60 * 1000; // 14-day window
        let result: any;
        if (d.query === 'model-calls-sprint') {
          result = stateLedger.queryModelCallsSprint(since);
        } else if (d.query === 'model-performance-sprint') {
          result = stateLedger.queryModelPerformanceSprint(since);
        } else {
          throw new Error(`db-query: unknown query "${d.query}"`);
        }
        const json = JSON.stringify(result, null, 2);
        this.context.set(key, json);
        return `db-query:${key}:${json.length} bytes`;
      }
      case 'memory-write': {
        const content = this.interpolate(d.content ?? '');
        stateLedger.addProjectMemory({
          content,
          importance: d.importance ?? 3,
          source: d.source ?? 'workflow'
        });
        return `memory-write:${content.substring(0, 30)}...`;
      }
      case 'agents-md-append': {
        const content = this.interpolate(d.content ?? '');
        if (!content.trim()) return 'agents-md-append:skipped:empty';
        const repoPath = this.services!.fsManager.getRootPath();
        const agentsMdPath = path.join(repoPath, 'AGENTS.md');
        const fsm = this.services!.fsManager;
        let existing = '';
        try {
          existing = fsm.readFile(agentsMdPath);
        } catch {
          // File might not exist, which is fine for append
        }
        await fsm.writeFile(agentsMdPath, existing + '\n' + content);
        return `agents-md-append:ok`;
      }
      default:
        throw new Error(`Unknown tool variant: ${(d as any).variant}`);
    }
  }

  private async dispatchDecision(node: WFNode): Promise<string> {
    const d = node.data as import('./types').DecisionNodeData;

    switch (d.variant) {
      case 'exit-code-gate': {
        const code = this.context.get('__lastExitCode') ?? '0';
        return code === '0' ? 'Yes' : 'No';
      }
      case 'output-match': {
        const last = this.context.get('__lastOutput') ?? '';
        if (!d.pattern) return 'No';
        try {
          return new RegExp(d.pattern).test(last) ? 'Yes' : 'No';
        } catch {
          return 'No'; // Invalid regex -> No
        }
      }
      case 'story-status-check': {
        this.services?.stateLedger.logEvent(
          'DECISION_SKIP',
          `story-status-check not implemented - auto-Yes`,
          {},
          'workflow'
        );
        return 'Yes';
      }
      case 'human-approval': {
        this.services?.stateLedger.logEvent(
          'HUMAN_GATE',
          `Node ${node.id} approval gate - auto-approved (MVP)`,
          {},
          'workflow'
        );
        await sleep(3000);
        return 'Yes';
      }
      default:
        return 'Yes';
    }
  }

  private async dispatchFlow(node: WFNode): Promise<string> {
    const d = node.data as import('./types').FlowNodeData;
    switch (d.variant) {
      case 'delay': {
        const ms = Math.min(d.durationMs ?? 1000, 300_000); // cap at 5 min
        await sleep(ms);
        return `delayed:${ms}ms`;
      }
      default:
        return 'pass';
    }
  }

  private async dispatchVerification(node: WFNode): Promise<string> {
    if (!this.services) throw new Error('ENGINE_SERVICES_NOT_INJECTED');
    const d = node.data as import('./types').VerificationNodeData;

    const failures: string[] = [];

    // TSC check
    try {
      await this.runShell('npx tsc --noEmit');
    } catch {
      failures.push('TSC failed');
    }

    // LSP check
    const lspManager = this.services.lspManager;
    if (!lspManager) {
      failures.push('LSPManager not available');
    } else {
      try {
        const status = await lspManager.workspaceCheck();
        if (status.errorCount > 0) {
          failures.push(`LSP check failed (${status.errorCount} errors)`);
        }
      } catch {
        failures.push('LSP check failed');
      }
    }

    // AC Checklist check
    if (d.checklist && d.checklist.length > 0) {
      const allChecked = d.checklist.every((_, i) => this.context.get(`__check_${node.id}_${i}`) === 'true');
      if (!allChecked) {
        failures.push('Checklist incomplete');
      }
    }

    if (failures.length > 0) {
      this.transition('PAUSED');
      const msg = failures.join('\n');
      this.updateNodeStatus(node.id, 'paused', msg);
      throw new Error(`Verification failed:\n${msg}`);
    }

    return 'verification:passed';
  }

  private async dispatchExtension(node: WFNode): Promise<string> {
    if (!this.services) throw new Error('ENGINE_SERVICES_NOT_INJECTED');
    const extensionData = (node.data as { type: 'extension'; data: import('./types').ExtensionNodeData }).data;
    const registry = this.services.extensionRegistry;
    const executor = registry.getNodeExecutor(extensionData.extensionType);
    if (!executor) throw new Error(`No executor registered for extension node type: ${extensionData.extensionType}`);
    const result = await executor(extensionData.config as Record<string, string> ?? {}, this.getContext());
    if (result) this.updateContext({ __lastOutput: result });
    return `extension:${extensionData.extensionType}:executed`;
  }

  private resolveBaseUrl(provider: string): string {
    switch (provider) {
      case 'anthropic':  return 'https://api.anthropic.com/v1';
      case 'openai':     return 'https://api.openai.com/v1';
      case 'google':     return 'https://generativelanguage.googleapis.com/v1beta/openai';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'deepinfra':  return 'https://api.deepinfra.com/v1/openai';
      case 'ollama':
      case 'ollama-anthropic': return 'http://localhost:11434/v1';
      default:
        return this.services?.authManager.getBaseUrl(provider)
               ?? 'https://api.openai.com/v1';
    }
  }

  private interpolate(template: string): string {
    let result = template;
    for (const [key, value] of this.context.entries()) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\{\\{${escapedKey}\\}\\}(\\}?)`, 'g');
      // If we matched {{key}}, replace it. If it was {{key}}}, we might have a conflict with triple braces if we used them, but here we just do simple {{key}}
      result = result.replace(re, value);
    }
    // Also keep the legacy ones for backward compatibility if they aren't in context
    return result
      .replace(/\{\{storyId\}\}/g,    this.context.get('__storyId') ?? '')
      .replace(/\{\{storyTitle\}\}/g, this.context.get('__storyTitle') ?? '')
      .replace(/\{\{prevOutput\}\}/g, this.context.get('__lastOutput') ?? '');
  }

  private runShell(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('node:child_process');
      const cwd = this.services!.fsManager.getRootPath();
      const argv = cmd.trim().split(/\s+/).filter(Boolean);
      if (argv.length === 0) {
        reject(new Error('runShell: empty command'));
        return;
      }
      const child = spawn(argv[0], argv.slice(1), { cwd, shell: false, timeout: 60_000 });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('error', (err: Error) => {
        this.context.set('__lastExitCode', '1');
        reject(err);
      });
      child.on('close', (code: number | null) => {
        const exitCode = code ?? 1;
        this.context.set('__lastExitCode', String(exitCode));
        if (exitCode !== 0) {
          reject(new Error(stderr.trim() || `exit code ${exitCode}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  private updateNodeStatus(
    nodeId: string,
    status: NodeStatus,
    error?: string,
    callback?: StateCallback
  ): void {
    this.nodeStatuses.set(nodeId, { status, error });
    if (callback) {
      callback({
        nodeId,
        status,
        timestamp: Date.now(),
        message: `Node ${nodeId} is now ${status}`,
        error
      });
    }

    if (status === 'completed') {
      const workflowId = this.context.get('__workflowId') ?? 'unknown';
      this.snapshotManager?.capture(workflowId, nodeId, Object.fromEntries(this.context));
    }

    // Also push to renderer if possible
    if (this.services?.win) {
      this.services.win.webContents.send('workflow:status-update', {
        nodeId,
        status,
        error
      });
    }
  }
}

export const workflowEngine = new WorkflowEngine();
