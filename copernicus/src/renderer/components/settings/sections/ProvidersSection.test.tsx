import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProvidersSection } from './ProvidersSection'
import { useIpcError } from '../../../hooks/useIpcError'

vi.mock('../../../hooks/useIpcError')
vi.mock('../../../store/toastStore', () => ({
  useToastStore: () => ({ addToast: vi.fn() })
}))
vi.mock('../../../store/layout', () => ({
  useWorkspaceStore: () => ({ setNotebooklmEnabled: vi.fn() })
}))
vi.mock('../../../utils/logger', () => ({
  default: { error: vi.fn() }
}))
vi.mock('../../wizard/AuthCliWidget', () => ({
  default: () => <div data-testid="auth-cli-widget">AuthCliWidgetMock</div>
}))

const mockInvoke = vi.fn()

describe('ProvidersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useIpcError).mockReturnValue(mockInvoke)

    // Default mocks for standard flow
    mockInvoke.mockImplementation(async (channel: string) => {
      switch (channel) {
        case 'auth:status':
          return { ok: true, data: [
            { provider: 'anthropic', hasKey: false, source: 'none' },
            { provider: 'github', hasKey: false, source: 'none' }
          ] }
        case 'check-cli-tools':
          return { ok: true, data: { claude: true } }
        case 'providers:list':
          // Missing deliberately to test fallback to canonical array
          return { ok: false, error: 'not found' }
        case 'providers:reload':
          return { ok: true, data: { ok: true, count: 0 } }
        case 'settings:load':
          return { ok: true, data: {} }
        case 'notebooklm:status':
          return { ok: true, data: { credentialsCached: false } }
        default:
          return { ok: true, data: {} }
      }
    })

    // Mock window.ipcRenderer
    window.ipcRenderer = {
      on: vi.fn(() => vi.fn()),
      invoke: vi.fn(),
      send: vi.fn()
    } as any
  })

  it('renders the canonical list of providers', async () => {
    render(<ProvidersSection />)

    // Need to wait for initial load state to pass
    await screen.findByText('AI Provider Registry')

    // Check for some canonical providers
    expect(screen.getByText('anthropic')).toBeInTheDocument()
    expect(screen.getByText('openai')).toBeInTheDocument()
    expect(screen.getByText('google')).toBeInTheDocument()
    expect(screen.getByText('github')).toBeInTheDocument()
    expect(screen.getByText('jules')).toBeInTheDocument()
    expect(screen.getByText('stitch')).toBeInTheDocument()
    expect(screen.getByText('tavily')).toBeInTheDocument()
  })
})
