import { spawn } from 'child_process'
import log from 'electron-log'

export interface DiagnosticsIssue {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
  source: 'ESLint' | 'Ruff' | 'Audit' | 'LSP'
}

export class DiagnosticsRunner {
  private cwd: string

  constructor(cwd: string) {
    this.cwd = cwd
  }

  async run(file: string): Promise<DiagnosticsIssue[]> {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      return this.runEslint(file)
    } else if (file.endsWith('.py')) {
      return this.runRuff(file)
    }
    return []
  }

  async runEslint(targetPath?: string): Promise<DiagnosticsIssue[]> {
    return new Promise((resolve) => {
      const args = ['eslint', '--format', 'json']
      if (targetPath) {
        args.push(targetPath)
      } else {
        args.push('.') 
      }

      const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
      const proc = spawn(npxCmd, args, { cwd: this.cwd, shell: false })
      let output = ''

      proc.stdout.on('data', (d) => { output += d.toString() })
      proc.stderr.on('data', (d) => { output += d.toString() })

      proc.on('close', () => {
        try {
          const results: DiagnosticsIssue[] = []
          const startIdx = output.indexOf('[')
          if (startIdx === -1) {
            log.info('[DiagnosticsRunner] ESLint returned no JSON array.')
            return resolve([])
          }
          const jsonStr = output.substring(startIdx)
          const parsed = JSON.parse(jsonStr)

          for (const fileResult of parsed) {
            for (const msg of fileResult.messages) {
              results.push({
                file: fileResult.filePath,
                line: msg.line || 1,
                col: msg.column || 1,
                severity: msg.severity === 2 ? 'error' : 'warning',
                code: msg.ruleId || 'eslint',
                message: msg.message,
                source: 'ESLint'
              })
            }
          }
          resolve(results)
        } catch (e) {
          log.error('[DiagnosticsRunner] Failed to parse ESLint output', e)
          resolve([])
        }
      })
    })
  }

  async runRuff(targetPath?: string): Promise<DiagnosticsIssue[]> {
    return new Promise((resolve) => {
      const args = ['check', '--output-format', 'json']
      if (targetPath) {
        args.push(targetPath)
      } else {
        args.push('.')
      }

      const ruffCmd = process.platform === 'win32' ? 'ruff.exe' : 'ruff'
      const proc = spawn(ruffCmd, args, { cwd: this.cwd, shell: false })
      let output = ''

      proc.stdout.on('data', (d) => { output += d.toString() })
      proc.stderr.on('data', (d) => { output += d.toString() })

      proc.on('close', () => {
        try {
          const results: DiagnosticsIssue[] = []
          const startIdx = output.indexOf('[')
          if (startIdx === -1) {
            log.info('[DiagnosticsRunner] Ruff returned no JSON array.')
            return resolve([])
          }
          const jsonStr = output.substring(startIdx)
          const parsed = JSON.parse(jsonStr)

          for (const msg of parsed) {
            results.push({
              file: msg.filename,
              line: msg.location.row || 1,
              col: msg.location.column || 1,
              severity: 'error', 
              code: msg.code || 'ruff',
              message: msg.message,
              source: 'Ruff'
            })
          }
          resolve(results)
        } catch (e) {
          log.error('[DiagnosticsRunner] Failed to parse Ruff output', e)
          resolve([])
        }
      })
    })
  }

  async runAudit(type: 'npm' | 'pip' = 'npm'): Promise<DiagnosticsIssue[]> {
    return new Promise((resolve) => {
      let proc
      if (type === 'npm') {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
        proc = spawn(npmCmd, ['audit', '--json'], { cwd: this.cwd, shell: false })
      } else {
        const pipCmd = process.platform === 'win32' ? 'pip-audit.exe' : 'pip-audit'
        proc = spawn(pipCmd, ['-f', 'json'], { cwd: this.cwd, shell: false })
      }

      let output = ''
      proc.stdout.on('data', (d) => { output += d.toString() })
      proc.stderr.on('data', (d) => { output += d.toString() })

      proc.on('close', () => {
        try {
          const results: DiagnosticsIssue[] = []
          
          if (type === 'npm') {
            const startIdx = output.indexOf('{')
            if (startIdx === -1) return resolve([])
            const jsonStr = output.substring(startIdx)
            const parsed = JSON.parse(jsonStr)

            if (parsed.vulnerabilities) {
              for (const [pkgName, vuln] of Object.entries(parsed.vulnerabilities) as [string, any][]) {
                if (vuln.via && Array.isArray(vuln.via)) {
                  for (const v of vuln.via) {
                    if (typeof v === 'object') {
                      results.push({
                        file: 'package.json',
                        line: 1,
                        col: 1,
                        severity: vuln.severity === 'critical' || vuln.severity === 'high' ? 'error' : 'warning',
                        code: `npm-audit:${pkgName}`,
                        message: v.title || `Vulnerability in ${pkgName}`,
                        source: 'Audit'
                      })
                    }
                  }
                }
              }
            }
          } else {
            const startIdx = output.indexOf('[')
            if (startIdx === -1) return resolve([])
            const jsonStr = output.substring(startIdx)
            const parsed = JSON.parse(jsonStr)

            for (const item of parsed) {
              if (item.vulns && item.vulns.length > 0) {
                for (const vuln of item.vulns) {
                  results.push({
                    file: item.filename || 'requirements.txt',
                    line: 1,
                    col: 1,
                    severity: 'error',
                    code: vuln.id || `pip-audit:${item.name}`,
                    message: `${item.name}: ${vuln.fix_versions ? 'Fixed in ' + vuln.fix_versions.join(', ') : 'No fix'}`,
                    source: 'Audit'
                  })
                }
              }
            }
          }
          resolve(results)
        } catch (e) {
          log.error(`[DiagnosticsRunner] Failed to parse ${type} audit output`, e)
          resolve([])
        }
      })
    })
  }
}
