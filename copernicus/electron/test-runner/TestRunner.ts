import { spawn, ChildProcess } from 'node:child_process'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import log from 'electron-log'
import fs from 'node:fs'

export interface TestSuite {
  id: string
  name: string
  type: 'vitest' | 'playwright'
  tests: TestCase[]
}

export interface TestCase {
  id: string
  name: string
  suiteId: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  error?: string
  file?: string
  line?: number
}

export interface TestRunResult {
  suiteId?: string
  testId?: string
  status: 'passed' | 'failed' | 'skipped'
  error?: string
}

export interface TestCoverage {
  [filePath: string]: {
    lines: { [line: number]: 'covered' | 'uncovered' | 'partial' }
  }
}

export class TestRunner {
  private win: BrowserWindow | null = null
  private rootPath: string = ''
  private currentProcess: ChildProcess | null = null

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  setRootPath(rootPath: string) {
    this.rootPath = rootPath
  }

  async discover(): Promise<TestSuite[]> {
    if (!this.rootPath) throw new Error('Root path not set')

    const suites: TestSuite[] = []

    const vitestConfigPath = path.join(this.rootPath, 'vitest.config.ts')
    const hasVitest = fs.existsSync(vitestConfigPath) || fs.existsSync(path.join(this.rootPath, 'vitest.config.js'))

    if (hasVitest || fs.existsSync(path.join(this.rootPath, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'package.json'), 'utf-8'))
        if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest || hasVitest) {
          const tests = this.findTestFiles(this.rootPath, /\.test\.(ts|tsx|js|jsx)$/)
          suites.push({
            id: 'vitest-suite',
            name: 'Vitest Unit Tests',
            type: 'vitest',
            tests: tests.map((t, i) => ({
              id: `v-test-${i}`,
              name: path.basename(t),
              suiteId: 'vitest-suite',
              status: 'pending',
              file: t
            }))
          })
        }
      } catch (e) {
        log.error('Failed to discover vitest tests', e)
      }
    }

    const pwConfigPath = path.join(this.rootPath, 'playwright.config.ts')
    const hasPw = fs.existsSync(pwConfigPath) || fs.existsSync(path.join(this.rootPath, 'playwright.config.js'))

    if (hasPw) {
      const tests = this.findTestFiles(this.rootPath, /\.spec\.(ts|tsx|js|jsx)$/)
      suites.push({
        id: 'playwright-suite',
        name: 'Playwright E2E Tests',
        type: 'playwright',
        tests: tests.map((t, i) => ({
          id: `p-test-${i}`,
          name: path.basename(t),
          suiteId: 'playwright-suite',
          status: 'pending',
          file: t
        }))
      })
    }

    return suites
  }

  private findTestFiles(dir: string, pattern: RegExp, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList
    const files = fs.readdirSync(dir)
    for (const file of files) {
      if (file === 'node_modules' || file === 'dist' || file === '.git') continue
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        this.findTestFiles(filePath, pattern, fileList)
      } else if (pattern.test(file)) {
        fileList.push(filePath)
      }
    }
    return fileList
  }

  async run(testId?: string, suiteId?: string): Promise<void> {
    if (!this.rootPath) throw new Error('Root path not set')
    if (this.currentProcess) {
      this.stop()
    }

    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? 'npx.cmd' : 'npx'

    let args: string[] = []

    if (suiteId === 'playwright-suite' || testId?.startsWith('p-test')) {
      args = ['playwright', 'test']
    } else {
      args = ['vitest', 'run']
    }

    this.currentProcess = spawn(cmd, args, { cwd: this.rootPath })

    this.currentProcess.stdout?.on('data', (data) => {
      if (this.win) {
        this.win.webContents.send('test:results', { type: 'log', data: data.toString() })
      }
    })

    this.currentProcess.stderr?.on('data', (data) => {
      if (this.win) {
        this.win.webContents.send('test:results', { type: 'log', data: data.toString(), isError: true })
      }
    })

    this.currentProcess.on('close', (code) => {
      if (this.win) {
        this.win.webContents.send('test:results', { type: 'done', code })
      }
      this.currentProcess = null
    })
  }

  stop() {
    if (this.currentProcess) {
      this.currentProcess.kill()
      this.currentProcess = null
      if (this.win) {
        this.win.webContents.send('test:results', { type: 'log', data: 'Test run stopped by user.\n' })
      }
    }
  }

  async runCoverage(): Promise<TestCoverage> {
    if (!this.rootPath) throw new Error('Root path not set')
    if (this.currentProcess) {
      this.stop()
    }

    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? 'npx.cmd' : 'npx'
    const args = ['vitest', 'run', '--coverage']

    return new Promise((resolve) => {
      this.currentProcess = spawn(cmd, args, { cwd: this.rootPath })

      this.currentProcess.stdout?.on('data', (data) => {
        const text = data.toString()
        if (this.win) {
          this.win.webContents.send('test:results', { type: 'log', data: text })
        }
      })

      this.currentProcess.stderr?.on('data', (data) => {
        if (this.win) {
          this.win.webContents.send('test:results', { type: 'log', data: data.toString(), isError: true })
        }
      })

      this.currentProcess.on('close', async (code) => {
        this.currentProcess = null
        if (this.win) {
          this.win.webContents.send('test:results', { type: 'done', code })
        }

        try {
          const coveragePath = path.join(this.rootPath, 'coverage', 'coverage-final.json')
          if (fs.existsSync(coveragePath)) {
            const raw = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'))
            const result: TestCoverage = {}
            for (const file in raw) {
              const fileData = raw[file]
              const lines: Record<number, 'covered' | 'uncovered' | 'partial'> = {}
              const statementMap = fileData.statementMap
              const s = fileData.s

              for (const st in statementMap) {
                const line = statementMap[st].start.line
                lines[line] = s[st] > 0 ? 'covered' : 'uncovered'
              }
              result[file] = { lines }
            }
            resolve(result)
          } else {
            resolve({})
          }
        } catch (e) {
          log.error('Failed to parse coverage', e)
          resolve({})
        }
      })
    })
  }
}

export const testRunner = new TestRunner()
