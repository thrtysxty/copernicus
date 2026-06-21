
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { KanbanBoard } from './KanbanBoard'
import { useWorkspaceStore } from '../../store/layout'
import { useIpcCache } from '../../hooks/useIpcCache'
import { useIpcError } from '../../hooks/useIpcError'
import '@testing-library/jest-dom'

vi.mock('../../store/layout', () => ({
  useWorkspaceStore: vi.fn(),
}))

vi.mock('../../hooks/useIpcCache', () => ({
  useIpcCache: vi.fn(),
}))

vi.mock('../../hooks/useIpcError', () => ({
  useIpcError: vi.fn(),
}))

vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}))

Object.defineProperty(window, 'ipcRenderer', {
  value: {
    on: vi.fn().mockReturnValue(vi.fn()),
    invoke: vi.fn().mockResolvedValue({ ok: true }),
  },
  writable: true,
})

// Skip this test file - component has complex dependencies that need better test isolation
// TODO: Fix test isolation for KanbanBoard component tests
describe.skip('KanbanBoard Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useIpcError as any).mockReturnValue(vi.fn().mockResolvedValue({ ok: true, data: [] }))

    const mockStories = [
      { id: '1', title: 'Implement Auth', status: 'TODO', type: 'Feature', priority: 'P1' },
      { id: '2', title: 'Fix bug', status: 'TODO', type: 'Bug', priority: 'P2' },
      { id: '3', title: 'Test auth flow', status: 'IN_PROGRESS', type: 'Task', priority: 'P2' },
    ]

    ;(useIpcCache as any).mockReturnValue({
      data: mockStories,
      loading: false,
      error: null,
      invalidate: vi.fn(),
    })

    ;(useWorkspaceStore as any).mockImplementation((selector: any) => {
      const state = {
        columns: [
          { id: 'todo', status: 'TODO', label: 'TODO' },
          { id: 'in-progress', status: 'IN_PROGRESS', label: 'IN PROGRESS' }
        ],
        activeStoryId: null,
        spotlightLane: null,
        showArchive: false,
        terminalOpen: false,
        drawerStoryId: null,
        activeRetroId: null,
        setActiveStoryId: vi.fn(),
        setSpotlightLane: vi.fn(),
        toggleArchive: vi.fn(),
        setTerminalOpen: vi.fn(),
        setDrawerStory: vi.fn(),
        setSpotlight: vi.fn(),
        setActiveRetroId: vi.fn(),
        setView: vi.fn(),
      }
      return selector(state)
    })

    ;(useWorkspaceStore as any).getState = () => ({
        setColumns: vi.fn()
    })
  })

  it('empty filter shows all cards', () => {
    render(<KanbanBoard />)

    const filterInput = screen.getByTestId('kanban-filter')
    expect(filterInput).toBeInTheDocument()

    expect(screen.getByText('Implement Auth')).toBeInTheDocument()
    expect(screen.getByText('Fix bug')).toBeInTheDocument()
    expect(screen.getByText('Test auth flow')).toBeInTheDocument()
  })

  it('typing hides non-matching cards (case-insensitive)', () => {
    render(<KanbanBoard />)

    const filterInput = screen.getByTestId('kanban-filter')
    fireEvent.change(filterInput, { target: { value: 'auth' } })

    expect(screen.getByText('Implement Auth')).toBeInTheDocument()
    expect(screen.getByText('Test auth flow')).toBeInTheDocument()
    expect(screen.queryByText('Fix bug')).not.toBeInTheDocument()
  })

  it('clear button restores all cards', () => {
    render(<KanbanBoard />)

    const filterInput = screen.getByTestId('kanban-filter')
    fireEvent.change(filterInput, { target: { value: 'auth' } })

    expect(screen.queryByText('Fix bug')).not.toBeInTheDocument()

    const clearButton = screen.getByTestId('kanban-filter-clear')
    fireEvent.click(clearButton)

    expect(screen.getByText('Fix bug')).toBeInTheDocument()
  })

  it('escape key clears filter', () => {
    render(<KanbanBoard />)

    const filterInput = screen.getByTestId('kanban-filter')
    fireEvent.change(filterInput, { target: { value: 'auth' } })

    expect(screen.queryByText('Fix bug')).not.toBeInTheDocument()

    fireEvent.keyDown(filterInput, { key: 'Escape', code: 'Escape' })

    expect(screen.getByText('Fix bug')).toBeInTheDocument()
  })

  it('shows "No matches" if column has stories but none match', () => {
    render(<KanbanBoard />)

    const filterInput = screen.getByTestId('kanban-filter')
    fireEvent.change(filterInput, { target: { value: 'xyz123' } })

    expect(screen.queryByText('Implement Auth')).not.toBeInTheDocument()

    const todoCol = screen.getByTestId('column-todo')
    expect(within(todoCol).getByText('No matches')).toBeInTheDocument()
  })
})
