import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHandle = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: mockHandle },
  app: { getAppPath: vi.fn(() => '/mock/app') },
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (channelOrFn: any, _args?: any, fnOrNothing?: any) => {
    const fn = typeof channelOrFn === 'function' ? channelOrFn : fnOrNothing
    try {
      const result = await fn()
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }),
}))

vi.mock('../security', () => ({
  securityManager: null,
}))

vi.mock('../security/SecurityScorer', () => ({
  SecurityScorer: vi.fn().mockImplementation(() => ({
    computeScore: vi.fn().mockResolvedValue({
      grade: 'A',
      lspErrors: 0,
      sentinelHits: 0,
      npmAuditIssues: 0,
    }),
  })),
}))

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// js-yaml mock: source uses `import * as yaml from 'js-yaml'` so exports
// must be available at top level (not just inside `default`)
const mockYamlLoad = vi.fn()
const mockYamlDump = vi.fn(() => 'yaml')
vi.mock('js-yaml', () => ({
  default: { load: mockYamlLoad, dump: mockYamlDump, JSON_SCHEMA: {} },
  load: mockYamlLoad,
  dump: mockYamlDump,
  JSON_SCHEMA: {},
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

describe('security-handlers', () => {
  let handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockHandle.mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })
  })

  it('registers all required handlers', async () => {
    const { register } = await import('./security-handlers')
    register()

    expect(mockHandle).toHaveBeenCalledWith('security:get-config', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('security:update-package-gate', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('security:add-to-allowlist', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('security:score', expect.any(Function))
  })

  it('security:get-config returns config', async () => {
    const fs = await import('fs')
    const { register } = await import('./security-handlers')

    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockYamlLoad.mockReturnValue({ version: 1, package_gate: { enabled: true } })

    register()
    const handler = handlers['security:get-config']
    const result = await handler({} as any)

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ version: 1, package_gate: { enabled: true } })
  })

  it('security:get-config returns default config when file missing', async () => {
    const fs = await import('fs')
    const { register } = await import('./security-handlers')

    vi.mocked(fs.existsSync).mockReturnValue(false)

    register()
    const handler = handlers['security:get-config']
    const result = await handler({} as any)

    expect(result.ok).toBe(true)
    expect(result.data.version).toBe(1)
    expect(result.data.package_gate.enabled).toBe(true)
    expect(result.data.package_allowlist).toBeDefined()
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('security:update-package-gate throws without confirmation when disabling', async () => {
    const fs = await import('fs')
    const { register } = await import('./security-handlers')

    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockYamlLoad.mockReturnValue({ version: 1, package_gate: { enabled: true }, package_allowlist: [], package_blocklist: [] })

    register()
    const handler = handlers['security:update-package-gate']
    const result = await handler({} as any, {
      updates: { enabled: false },
      confirmed: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('confirmation')
  })

  it('security:update-package-gate updates config when confirmed', async () => {
    const fs = await import('fs')
    const { register } = await import('./security-handlers')

    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockYamlLoad.mockReturnValue({
      version: 1,
      package_gate: { enabled: true, min_age_days: 30 },
      package_allowlist: [],
      package_blocklist: [],
    })

    register()
    const handler = handlers['security:update-package-gate']
    const result = await handler({} as any, {
      updates: { min_age_days: 60 },
      confirmed: true,
    })

    expect(result.ok).toBe(true)
    expect(mockYamlDump).toHaveBeenCalled()
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('security:add-to-allowlist adds new package', async () => {
    const fs = await import('fs')
    const { register } = await import('./security-handlers')

    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockYamlLoad.mockReturnValue({
      version: 1,
      package_gate: { enabled: true },
      package_allowlist: ['existing-package'],
      package_blocklist: [],
    })

    register()
    const handler = handlers['security:add-to-allowlist']
    const result = await handler({} as any, 'new-package')

    expect(result.ok).toBe(true)
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('security:add-to-allowlist does not duplicate existing package', async () => {
    const fs = await import('fs')
    const { register } = await import('./security-handlers')

    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockYamlLoad.mockReturnValue({
      version: 1,
      package_gate: { enabled: true },
      package_allowlist: ['existing-package'],
      package_blocklist: [],
    })

    register()
    const handler = handlers['security:add-to-allowlist']
    await handler({} as any, 'existing-package')

    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('security:score returns error when SecurityManager not initialized', async () => {
    const { register } = await import('./security-handlers')
    register()
    const handler = handlers['security:score']
    const result = await handler({} as any)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('not initialized')
  })
})
