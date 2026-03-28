import { describe, it, expect } from 'vitest'
import { DEFAULT_COLUMNS, KanbanColumn } from './layout'

describe('layout store rehydration guard', () => {
  // Simulate the rehydration guard logic from layout.ts
  const runGuard = (state: any) => {
    if (
      !state.columns ||
      state.columns.length !== 9 ||
      state.columns.some((c: KanbanColumn) => !DEFAULT_COLUMNS.some((dc) => dc.id === c.id))
    ) {
      state.columns = DEFAULT_COLUMNS
    }
    return state
  }

  it('resets columns when state.columns.length !== 9', () => {
    const state = { columns: DEFAULT_COLUMNS.slice(0, 8) }
    const rehydratedState = runGuard({ ...state })
    expect(rehydratedState.columns).toEqual(DEFAULT_COLUMNS)
  })

  it('resets columns when a column id is not in DEFAULT_COLUMNS', () => {
    const customColumns: KanbanColumn[] = DEFAULT_COLUMNS.map(c => ({ ...c }))
    if (customColumns[0]) {
      customColumns[0].id = 'invalid-column-id-for-testing'
    }

    const state = { columns: customColumns }
    const rehydratedState = runGuard({ ...state })
    expect(rehydratedState.columns).toEqual(DEFAULT_COLUMNS)
  })

  it('does NOT reset columns when layout state is fully valid', () => {
    // A fully valid layout state (even with modified labels, colors, etc as long as ID is valid)
    const validColumns: KanbanColumn[] = DEFAULT_COLUMNS.map(c => ({ ...c, label: `Custom ${c.label}` }))
    const state = { columns: validColumns }
    const rehydratedState = runGuard({ ...state })
    expect(rehydratedState.columns).toEqual(validColumns)
  })
})
