import { vi } from 'vitest';
vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    logModelCall: vi.fn(),
    getSessionStats: vi.fn().mockReturnValue({}),
  }
}));

import { systemPromptBuilder } from './system-prompt-builder';
import { llmService, ChatPayload } from './service';
import { modelRegistry } from '../models/model-registry';
import { authManager } from '../auth-manager';

describe('SystemPromptBuilder', () => {
  it('build({}) returns a string containing "COPERNICUS IDE" and all 5 protocol headings', () => {
    const result = systemPromptBuilder.build({});
    expect(result).toContain('COPERNICUS IDE');
    expect(result).toContain('1. REPO RAG:');
    expect(result).toContain('2. LOCAL DELEGATION:');
    expect(result).toContain('3. SURGICAL EDITS:');
    expect(result).toContain('4. CONTEXT AWARENESS:');
    expect(result).toContain('5. PM DISCIPLINE:');
  });

  it('build({ projectName: "HPH", persona: "Sentinel" }) output contains "HPH" and "Sentinel"', () => {
    const result = systemPromptBuilder.build({ projectName: 'HPH', persona: 'Sentinel' });
    expect(result).toContain('HPH');
    expect(result).toContain('Sentinel');
  });

  it('build({ conventions: ["Never use var"] }) output contains "## Conventions" and "Never use var"', () => {
    const result = systemPromptBuilder.build({ conventions: ['Never use var'] });
    expect(result).toContain('## Conventions');
    expect(result).toContain('- Never use var');
  });

  it('build({ taskDescription: "Implement story 490" }) output contains "## Current Task"', () => {
    const result = systemPromptBuilder.build({ taskDescription: 'Implement story 490' });
    expect(result).toContain('## Current Task');
    expect(result).toContain('Implement story 490');
  });

  it('build({ conventions: [] }) output does NOT contain "## Conventions"', () => {
    const result = systemPromptBuilder.build({ conventions: [] });
    expect(result).not.toContain('## Conventions');
  });
});

describe('LLMService System Prompt Integration', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ done: true })
        })
      }
    } as any);

    vi.spyOn(authManager, 'getApiKey').mockReturnValue('test-api-key');
    vi.spyOn(modelRegistry, 'getModels').mockReturnValue([
      { id: 'claude-3', provider: 'anthropic', name: 'Claude', contextWindow: 8192 },
      { id: 'gpt-4', provider: 'openai', name: 'GPT-4', contextWindow: 8192 }
    ] as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('Anthropic provider: streamChat sends system as an array with cache_control block', async () => {
    const payload: ChatPayload = {
      sessionId: 'test-session',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'claude-3'
    };
    
    await llmService.streamChat(payload);
    
    expect(global.fetch).toHaveBeenCalled();
    const fetchCall = (global.fetch as any).mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);
    
    expect(Array.isArray(requestBody.systemPrompt)).toBe(true);
    expect(requestBody.systemPrompt[0].type).toBe('text');
    expect(requestBody.systemPrompt[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('Non-Anthropic provider: streamChat sends system as a string', async () => {
    const payload: ChatPayload = {
      sessionId: 'test-session',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'gpt-4'
    };
    
    await llmService.streamChat(payload);
    
    expect(global.fetch).toHaveBeenCalled();
    const fetchCall = (global.fetch as any).mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);
    
    expect(typeof requestBody.systemPrompt).toBe('string');
  });

  it('When payload.systemPrompt is set, build() output is NOT used', async () => {
    const customPrompt = 'My custom override prompt';
    const payload: ChatPayload = {
      sessionId: 'test-session',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'gpt-4',
      systemPrompt: customPrompt
    };
    
    await llmService.streamChat(payload);
    
    expect(global.fetch).toHaveBeenCalled();
    const fetchCall = (global.fetch as any).mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);
    
    expect(requestBody.systemPrompt).toBe(customPrompt);
  });
});
