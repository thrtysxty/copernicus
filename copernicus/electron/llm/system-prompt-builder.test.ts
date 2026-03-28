import { systemPromptBuilder } from './system-prompt-builder';
import { stateLedger } from '../db/state-ledger';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    getStoryById: vi.fn(),
  },
}));

describe('SystemPromptBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds system prompt without context', () => {
    const result = systemPromptBuilder.build({});
    expect(result).toContain('You are the primary AI orchestrator');
    expect(result).toContain('## Core Protocols');
    expect(result).not.toContain('## Story Context');
  });

  it('builds system prompt with story context when bankId starts with story:', () => {
    (stateLedger.getStoryById as any).mockReturnValue({
      id: '570',
      title: 'Test Story',
      body_md: 'This is a test story.',
    });

    const result = systemPromptBuilder.build({ bankId: 'story:570' });
    expect(stateLedger.getStoryById).toHaveBeenCalledWith('570');
    expect(result).toContain('## Story Context');
    expect(result).toContain('Title: Test Story');
    expect(result).toContain('Content:\nThis is a test story.');
  });
});
