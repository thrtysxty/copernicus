import { promisify } from 'node:util'
import { exec, execFile } from 'node:child_process'

export const execAsync = promisify(exec)
export const execFileAsync = promisify(execFile)
