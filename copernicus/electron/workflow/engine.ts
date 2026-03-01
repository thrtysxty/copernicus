import { WorkflowState, VALID_TRANSITIONS } from './states';
import { WorkflowGraph, WFNode, NodeStatus, WorkflowExecutionEvent } from './types';
import type { AuthManager } from '../auth-manager';
import type { ModelRegistry } from '../models/model-registry';
import type { PTYManager } from '../pty-manager';
import type { StateLedger } from '../db/state-ledger';
import type { FSManager } from '../fs-manager';
import type { TriggerNodeData } from './types';
import type { BrowserWindow } from 'electron';
import log from '../utils/logger';

export type StateCallback = (event: WorkflowExecutionEvent) => void;

export interface EngineServices {
  authManager: AuthManager;
  modelRegistry: ModelRegistry;
  ptyManager: PTYManager;
  stateLedger: StateLedger;
  fsManager: FSManager;
  win: BrowserWindow;
}

export class WorkflowEngine {
  private currentState: WorkflowState = 'IDLE';
  private nodeStatuses: Map<string, { status: NodeStatus; error?: string }> = new Map();
  private context: Map<string, string> = new Map();
  private services: EngineServices | null = null;

  constructor() {
    log.info('[SYSTEM] WorkflowEngine Initialized in IDLE state.');
  }

  public setServices(services: EngineServices): void {
    this.services = services;
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
    } catch (error: any) {
      log.error('[WorkflowEngine] Execution Failed:', error);
      this.transition('FAILED');
      // Optionally push a global error if needed, but per-node errors are more granular
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
    this.updateNodeStatus(node.id, 'running', undefined, callback);

    try {
      let output = '';

      switch (node.type) {
        case 'trigger':
          if (node.data?.variant === 'story-activated' && (node.data as any).storyId) {
            this.context.set('__storyId', (node.data as any).storyId);
          }
          output = `trigger:${node.data?.variant ?? 'manual'}`;
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
        default:
          output = `unknown:${node.type}`;
      }

      this.context.set(node.id, output);
      if (node.type !== 'decision') this.context.set('__lastOutput', output);
      this.updateNodeStatus(node.id, 'completed', undefined, callback);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      this.context.set(node.id, `ERROR:${msg}`);
      this.updateNodeStatus(node.id, 'error', msg, callback);
      throw err;
    }
  }

  private async dispatchAgent(node: WFNode): Promise<string> {
    if (!this.services) throw new Error('ENGINE_SERVICES_NOT_INJECTED');

    const { authManager } = this.services;
    const d = node.data as import('./types').AgentNodeData;

    const apiKey = authManager.getApiKey(d.provider);
    if (!apiKey && d.provider !== 'ollama') {
      throw new Error(`AUTH_MISSING:${d.provider}`);
    }

    const task = this.interpolate(d.task ?? '');
    const systemPrompt = d.systemPrompt || `You are a ${d.persona ?? 'helpful assistant'}.`;

    if (d.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: d.modelId,
          max_tokens: d.maxTokens ?? 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: task }],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
      const json = await res.json() as any;
      return json.content?.[0]?.text ?? '';
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
    const output: string = json.choices?.[0]?.message?.content ?? '';

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
        return await this.runShell(`make ${target}`);
      }
      case 'file-read': {
        if (!d.filePath) throw new Error('file-read: filePath is required');
        const result = fsManager.readFile(d.filePath);
        if (!result.ok) throw new Error(result.error ?? 'file-read failed');
        return result.data ?? '';
      }
      case 'file-write': {
        if (!d.filePath) throw new Error('file-write: filePath is required');
        const content = this.interpolate(d.content ?? '');
        const result = fsManager.writeFile(d.filePath, content);
        if (!result.ok) throw new Error(result.error ?? 'file-write failed');
        return `written:${d.filePath}`;
      }
      case 'story-update': {
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
        await new Promise(resolve => setTimeout(resolve, 3000));
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
        await new Promise(resolve => setTimeout(resolve, ms));
        return `delayed:${ms}ms`;
      }
      default:
        return 'pass';
    }
  }

  private resolveBaseUrl(provider: string): string {
    switch (provider) {
      case 'anthropic':  return 'https://api.anthropic.com/v1';
      case 'openai':     return 'https://api.openai.com/v1';
      case 'google':     return 'https://generativelanguage.googleapis.com/v1beta/openai';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'deepinfra':  return 'https://api.deepinfra.com/v1/openai';
      case 'ollama':     return 'http://localhost:11434/v1';
      default:
        return this.services?.authManager.getBaseUrl(provider)
               ?? 'https://api.openai.com/v1';
    }
  }

  private interpolate(template: string): string {
    return template
      .replace(/\{\{storyId\}\}/g,    this.context.get('__storyId') ?? '')
      .replace(/\{\{storyTitle\}\}/g, this.context.get('__storyTitle') ?? '')
      .replace(/\{\{prevOutput\}\}/g, this.context.get('__lastOutput') ?? '');
  }

  private runShell(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('node:child_process');
      const cwd = this.services!.fsManager.getRootPath();
      exec(
        cmd,
        { cwd, timeout: 60_000, maxBuffer: 1024 * 1024 },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            this.context.set('__lastExitCode', String(error.code ?? 1));
            reject(new Error(stderr.trim() || error.message));
          } else {
            this.context.set('__lastExitCode', '0');
            resolve(stdout.trim());
          }
        }
      );
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
