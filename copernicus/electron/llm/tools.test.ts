import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor, TOOLS, RECALL_MEMORY_TOOL } from './tools';
import { stateLedger } from '../db/state-ledger';

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    recallAgentMemory: vi.fn(),
  }
}));

describe('ToolExecutor - recall_memory', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    executor = new ToolExecutor();
    vi.clearAllMocks();
  });

  it('is defined in RECALL_MEMORY_TOOL with input_schema', () => {
    const tool = RECALL_MEMORY_TOOL;
    expect(tool).toBeDefined();
    expect(tool.input_schema).toBeDefined();
    expect(tool.input_schema?.properties.query).toBeDefined();
    expect(TOOLS.find(t => t.name === 'recall_memory')).toBeUndefined();
  });

  it('returns formatted memory results', async () => {
    vi.mocked(stateLedger.recallAgentMemory).mockReturnValue([
      { event_type: 'memory_fact', content: 'handleIpc is used for wrappers', importance: 5 }
    ]);

    const result = await executor.execute('recall_memory', { query: 'handleIpc' }, { projectId: 'test_project', bankId: 'test_bank' });
    
    expect(stateLedger.recallAgentMemory).toHaveBeenCalledWith('test_project', 'test_bank', 'handleIpc', 5);
    expect(result).toContain('Memory results for "handleIpc":');
    expect(result).toContain('1. [memory_fact] handleIpc is used for wrappers (importance: 5)');
  });

  it('handles empty results', async () => {
    vi.mocked(stateLedger.recallAgentMemory).mockReturnValue([]);

    const result = await executor.execute('recall_memory', { query: 'xyz_nonexistent' }, { projectId: 'test_project', bankId: 'test_bank' });
    
    expect(result).toBe('Memory results for "xyz_nonexistent":\n(no results)');
  });

  it('clamps limit to 10', async () => {
    vi.mocked(stateLedger.recallAgentMemory).mockReturnValue([]);

    await executor.execute('recall_memory', { query: 'test', limit: 15 });
    
    expect(stateLedger.recallAgentMemory).toHaveBeenCalledWith('default', 'chat', 'test', 10);
  });
  
  it('returns an error if query is missing', async () => {
    const result = await executor.execute('recall_memory', {});
    expect(result).toBe('Error: query is required');
  });
});
