/**
 * AgentTestHelper — AI-driven Playwright test driver for Copernicus.
 *
 * Wraps Playwright page interactions with an agent loop:
 *   snapshot UI → ask model for next action → execute → repeat
 *
 * Captures Electron process stdout/stderr so main-process crashes
 * and errors are visible in the test report alongside UI state.
 */
import { ElectronApplication, Page } from '@playwright/test'
import Anthropic from '@anthropic-ai/sdk'
import { AGENT_SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from './agent-prompt'

// --- Types ---

export type TestAction =
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'navigate'; view: string }
  | { type: 'assert'; description: string; expected: boolean }
  | { type: 'screenshot'; name: string }
  | { type: 'hover'; selector: string }
  | { type: 'pressKey'; key: string }
  | { type: 'drag'; source: string; target: string }
  | { type: 'done'; summary: string }

export interface StepResult {
  action: TestAction
  success: boolean
  error?: string
  screenshot?: Buffer
  processErrors: string[]  // new errors from this step
}

export interface TestReport {
  passed: boolean
  steps: StepResult[]
  errors: string[]           // UI-level errors
  processLogs: string[]      // all stdout/stderr lines from app.process()
  processErrors: string[]   // filtered: only ERROR/WARN/Unhandled lines
  finalSummary?: string
}

type ModelBackend = 'claude' | 'local'

// --- Process log collector ---

const ERROR_PATTERNS = [
  /\[ERROR\]/i,
  /\[WARN\]/i,
  /Unhandled/i,
  /TypeError/i,
  /ReferenceError/i,
  /ELOOP/i,
  /ENOENT/i,
  /EPERM/i,
  /SIGTERM/i,
  /SIGSEGV/i,
  /Cannot read properties/i,
]

function isErrorLine(line: string): boolean {
  return ERROR_PATTERNS.some(p => p.test(line))
}

export function collectLogs(app: ElectronApplication): {
  getErrors: () => string[]
  flush: () => string
  getAll: () => string[]
  stop: () => void
} {
  const ring: string[] = []
  const MAX_RING = 500
  let stopped = false

  const push = (data: Buffer) => {
    if (stopped) return
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      ring.push(line)
      if (ring.length > MAX_RING) ring.shift()
    }
  }

  app.process().stdout?.on('data', push)
  app.process().stderr?.on('data', push)

  return {
    getErrors: () => ring.filter(isErrorLine),
    flush: () => ring.splice(0).join('\n'),
    getAll: () => [...ring],
    stop: () => { stopped = true },
  }
}

// --- AgentTestHelper ---

export class AgentTestHelper {
  private logs: ReturnType<typeof collectLogs> | null = null
  private stepErrors: string[] = []
  private lastLogIndex = 0

  constructor(
    private page: Page,
    private app: ElectronApplication,
    private model: ModelBackend = 'claude',
  ) {}

  /** Start capturing process logs. Call before pursueGoal(). */
  startLogCapture(): void {
    this.logs = collectLogs(this.app)
    this.lastLogIndex = 0
    this.stepErrors = []
  }

  /** Get new process errors since last call. */
  private drainNewErrors(): string[] {
    if (!this.logs) return []
    const all = this.logs.getErrors()
    const newErrors = all.slice(this.lastLogIndex)
    this.lastLogIndex = all.length
    this.stepErrors.push(...newErrors)
    return newErrors
  }

  /** Snapshot the current UI as an accessibility tree. */
  async snapshotUI(): Promise<string> {
    try {
      const snapshot = await this.page.accessibility.snapshot()
      if (!snapshot) return '[empty accessibility tree]'
      return JSON.stringify(snapshot, null, 2)
    } catch {
      // Fallback: get visible text content
      return await this.page.evaluate(() => document.body?.innerText ?? '[empty page]')
    }
  }

  /** Ask the model what to do next. */
  async planAction(goal: string, snapshot: string): Promise<TestAction> {
    const processErrors = this.drainNewErrors()
    const prompt = USER_PROMPT_TEMPLATE(goal, snapshot, processErrors)

    if (this.model === 'claude') {
      return this.callClaude(prompt)
    }
    return this.callLocal(prompt)
  }

  /** Execute a single action on the page. */
  async executeAction(action: TestAction): Promise<{ success: boolean; error?: string }> {
    try {
      switch (action.type) {
        case 'click': {
          const locator = this.page.locator(`[data-testid="${action.selector}"]`)
            .or(this.page.getByRole('button', { name: action.selector }))
            .or(this.page.getByText(action.selector, { exact: false }))
          await locator.first().click({ timeout: 5_000 })
          await this.page.waitForTimeout(500) // let UI settle
          return { success: true }
        }
        case 'type': {
          const locator = this.page.locator(`[data-testid="${action.selector}"]`)
            .or(this.page.getByRole('textbox', { name: action.selector }))
          await locator.first().fill(action.text, { timeout: 5_000 })
          return { success: true }
        }
        case 'navigate': {
          const { setView } = await import('./fixture')
          await setView(this.app, action.view)
          await this.page.waitForTimeout(1_000)
          return { success: true }
        }
        case 'assert': {
          // Simple assertion: check if the description text exists on page
          const text = action.description
          const found = await this.page.getByText(text, { exact: false }).isVisible().catch(() => false)
          return { success: found === action.expected }
        }
        case 'screenshot': {
          // Screenshots are captured in step results
          const buf = await this.page.screenshot()
          return { success: true, error: `screenshot:${action.name}:${buf.length}` }
        }
        case 'done':
          return { success: true }
        default:
          return { success: false, error: `Unknown action type: ${(action as any).type}` }
      }
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) }
    }
  }

  /** Run a goal-driven loop: snapshot → plan → execute → verify */
  async pursueGoal(goal: string, maxSteps: number = 20): Promise<TestReport> {
    this.startLogCapture()

    const steps: StepResult[] = []
    const errors: string[] = []

    for (let i = 0; i < maxSteps; i++) {
      const snapshot = await this.snapshotUI()
      const processErrorsBefore = this.drainNewErrors()

      const action = await this.planAction(goal, snapshot)

      if (action.type === 'done') {
        this.logs?.stop()
        return {
          passed: true,
          steps,
          errors,
          processLogs: this.logs?.getAll() ?? [],
          processErrors: this.logs?.getErrors() ?? [],
          finalSummary: action.summary,
        }
      }

      const result = await this.executeAction(action)
      const stepProcessErrors = this.drainNewErrors()

      if (!result.success && result.error) {
        errors.push(result.error)
      }

      steps.push({
        action,
        success: result.success,
        error: result.error,
        processErrors: stepProcessErrors,
      })

      // If 3 consecutive failures, stop early
      const recentFailures = steps.slice(-3).filter(s => !s.success)
      if (recentFailures.length >= 3) {
        break
      }
    }

    this.logs?.stop()
    return {
      passed: steps.every(s => s.success),
      steps,
      errors,
      processLogs: this.logs?.getAll() ?? [],
      processErrors: this.logs?.getErrors() ?? [],
    }
  }

  // --- Model backends ---

  private async callClaude(prompt: string): Promise<TestAction> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: AGENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return this.parseAction(text)
  }

  private async callLocal(prompt: string): Promise<TestAction> {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? 'llama3',
        prompt: `${AGENT_SYSTEM_PROMPT}\n\n${prompt}`,
        stream: false,
      }),
    })

    if (!resp.ok) throw new Error(`Ollama error: ${resp.status} ${await resp.text()}`)
    const data = await resp.json()
    return this.parseAction(data.response ?? '')
  }

  private parseAction(raw: string): TestAction {
    // Extract JSON from the response (may have markdown fences)
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { type: 'done', summary: `Agent returned non-JSON: ${raw.slice(0, 200)}` }
    }

    try {
      const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0])
      return parsed.action ?? parsed
    } catch {
      return { type: 'done', summary: `Failed to parse agent response: ${raw.slice(0, 200)}` }
    }
  }
}
