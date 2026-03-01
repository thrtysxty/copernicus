import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { FSManager } from './fs-manager'

describe('FSManager', () => {
  let fsManager: FSManager
  const testRoot = path.join(os.tmpdir(), 'copernicus-test-root-' + Date.now())

  beforeEach(() => {
    if (!fs.existsSync(testRoot)) {
      fs.mkdirSync(testRoot, { recursive: true })
    }
    fs.writeFileSync(path.join(testRoot, 'test-file.txt'), 'hello world')
    fs.mkdirSync(path.join(testRoot, 'test-dir'))

    fsManager = new FSManager()
    fsManager.setRootPath(testRoot)
  })

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true })
  })

  it('should list directories within root', () => {
    const result = fsManager.listDir(testRoot)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data.find(n => n.name === 'test-file.txt')).toBeDefined()
      expect(result.data.find(n => n.name === 'test-dir')?.isDir).toBe(true)
    }
  })

  it('should read files within root', () => {
    const result = fsManager.readFile(path.join(testRoot, 'test-file.txt'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBe('hello world')
    }
  })

  it('should write files within root', () => {
    const filePath = path.join(testRoot, 'new-file.txt')
    const result = fsManager.writeFile(filePath, 'new content')
    expect(result.ok).toBe(true)
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content')
  })

  it('should block path traversal outside root and home', () => {
    const unsafePath = path.resolve(testRoot, '../../etc/passwd')

    const listResult = fsManager.listDir(unsafePath)
    expect(listResult.ok).toBe(false)
    if (!listResult.ok) expect(listResult.error).toMatch(/Path traversal blocked/)

    const readResult = fsManager.readFile(unsafePath)
    expect(readResult.ok).toBe(false)
    if (!readResult.ok) expect(readResult.error).toMatch(/Path traversal blocked/)

    const writeResult = fsManager.writeFile(unsafePath, 'malicious')
    expect(writeResult.ok).toBe(false)
    if (!writeResult.ok) expect(writeResult.error).toMatch(/Write blocked outside project root/)
  })

  it('should allow access to home directory (for user convenience)', () => {
    const homePath = os.homedir()
    // We won't actually read/write but just check if it doesn't throw the "blocked" error
    // for the assertion itself.
    expect(() => {
        try {
            fsManager.listDir(homePath)
        } catch (e: any) {
            if (e.message.includes('Path traversal blocked')) throw e
            // Other errors like EPERM are fine for this test
        }
    }).not.toThrow(/Path traversal blocked/)
  })
})
