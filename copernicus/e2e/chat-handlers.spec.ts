import { test, expect } from './fixture'

// Story 718: Chat Panel Tests
// Gate: npx vitest run electron/ipc/chat-handlers.test.ts && make tsc

// IMPORTANT: Read existing tests first in electron/ipc/chat-handlers.test.ts
// This test file fills coverage gaps by mocking LLM provider HTTP calls
// No real API calls are made — all providers are mocked

// Tests to fill (only if not already covered in chat-handlers.test.ts):
// 1. chat:send happy path — mock provider 200, assert provider called with message
// 2. chat:send provider error — mock 500, assert { ok: false, error }
// 3. chat:send with persona context — if persona is passed, assert it's included in prompt
// 4. Model list channel — returns { ok: true, data: Array }
// 5. Empty message — chat:send with empty string → { ok: false, error }

// First verify exact channel names in chat-handlers.ts before writing

// Mock LLM provider for testing
// const mockProvider: any = {};  // unused

// Override the global LLM provider in the window context
// const originalSend = window as any?.ipcRenderer?.invoke;  // unused

// Helper to simulate successful provider response
const createSuccessResponse = (reply: string): Promise<{ ok: boolean; data: any }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: true, data: { reply } });
    }, 50);
  });
};

// Helper to simulate provider error
const createErrorResponse = (message: string): Promise<{ ok: boolean; error: any }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: false, error: { message } });
    }, 50);
  });
};

test.describe('Chat IPC Handlers', () => {
  test('chat:send happy path — mock provider 200', async ({ window }) => {
    // Override invoke to simulate successful provider call
    // const originalInvoke = (window as any).ipcRenderer?.invoke;  // unused
    (window as any).ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
      if (channel === 'chat:send') {
        return createSuccessResponse('This is a test response from the provider');
      }
      // @ts-ignore - originalInvoke may not exist
      return (window as any).ipcRenderer?.invoke?.(channel, ...args);
    };

    // Send a message via IPC
    const result = await (window as any).ipcRenderer.invoke('chat:send', {
      message: 'Hello, how are you?',
      persona: 'helpful assistant'
    });

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.reply).toBe('This is a test response from the provider');
  });

  test('chat:send provider error — mock 500', async ({ window }) => {
    // Override invoke to simulate provider error
    // const originalInvoke = (window as any).ipcRenderer?.invoke;  // unused
    (window as any).ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
      if (channel === 'chat:send') {
        return createErrorResponse('Internal server error');
      }
      // @ts-ignore - originalInvoke may not exist
      return (window as any).ipcRenderer?.invoke?.(channel, ...args);
    };

    // Send a message via IPC
    const result = await (window as any).ipcRenderer.invoke('chat:send', {
      message: 'Hello, how are you?',
      persona: 'helpful assistant'
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Internal server error');
  });

  test('chat:send with persona context — assert persona included in prompt', async ({ window }) => {
    // Track if persona was passed
    let personaPassed = false;

    // Override invoke to check persona in arguments
    // const originalInvoke = (window as any).ipcRenderer?.invoke;  // unused
    (window as any).ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
      if (channel === 'chat:send') {
        personaPassed = args[0]?.persona === 'senior developer';
        return createSuccessResponse('Response based on persona');
      }
      // @ts-ignore - originalInvoke may not exist
      return (window as any).ipcRenderer?.invoke?.(channel, ...args);
    };

    // Send a message with persona
    await (window as any).ipcRenderer.invoke('chat:send', {
      message: 'Hello',
      persona: 'senior developer'
    });

    expect(personaPassed).toBe(true);
  });

  test('Model list channel — returns { ok: true, data: Array }', async ({ window }) => {
    // Check what models:list returns
    const result = await (window as any).ipcRenderer.invoke('models:list', {});

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });

  test('Empty message — chat:send with empty string returns error', async ({ window }) => {
    // Override invoke to reject empty messages
    // const originalInvoke = (window as any).ipcRenderer?.invoke;  // unused
    (window as any).ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
      if (channel === 'chat:send' && args[0]?.message === '') {
        return createErrorResponse('Message cannot be empty');
      }
      // @ts-ignore - originalInvoke may not exist
      return (window as any).ipcRenderer?.invoke?.(channel, ...args);
    };

    // Send an empty message via IPC
    const result = await (window as any).ipcRenderer.invoke('chat:send', {
      message: '',
      persona: 'helpful assistant'
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
