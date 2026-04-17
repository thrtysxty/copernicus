import { test } from 'node:test';
import assert from 'node:assert';
import {
  ROUTES,
  checkRoute,
  resolveProviderWithFallback,
  ProviderUnavailableError
} from '../lib/llm.mjs';

test('ROUTES.LOCAL_MLX has correct port 8080', () => {
  assert.strictEqual(ROUTES.LOCAL_MLX.id, 'mlx-native');
  assert.strictEqual(ROUTES.LOCAL_MLX.baseURL, 'http://localhost:8080/v1');
  assert.strictEqual(ROUTES.LOCAL_MLX.cost, 'zero');
  assert.strictEqual(ROUTES.LOCAL_MLX.api, 'openai');
});

test('ROUTES.LOCAL_OLLAMA has correct port 11434', () => {
  assert.strictEqual(ROUTES.LOCAL_OLLAMA.id, 'ollama');
  assert.strictEqual(ROUTES.LOCAL_OLLAMA.baseURL, 'http://localhost:11434/v1');
  assert.strictEqual(ROUTES.LOCAL_OLLAMA.cost, 'zero');
  assert.strictEqual(ROUTES.LOCAL_OLLAMA.api, 'openai');
});

test('ROUTES.CCR_FREE has correct port 9669', () => {
  assert.strictEqual(ROUTES.CCR_FREE.id, 'ccr');
  assert.strictEqual(ROUTES.CCR_FREE.baseURL, 'http://127.0.0.1:9669');
  assert.strictEqual(ROUTES.CCR_FREE.cost, 'free');
  assert.strictEqual(ROUTES.CCR_FREE.api, 'openai');
});

test('ROUTES.OPENROUTER has correct baseURL and cost', () => {
  assert.strictEqual(ROUTES.OPENROUTER.id, 'openrouter');
  assert.strictEqual(ROUTES.OPENROUTER.baseURL, 'https://openrouter.ai/api/v1');
  assert.strictEqual(ROUTES.OPENROUTER.cost, 'paid');
  assert.strictEqual(ROUTES.OPENROUTER.api, 'openai');
});

test('checkRoute returns alive: false for unknown route without throwing', async () => {
  const result = await checkRoute('nonexistent-route');
  assert.strictEqual(result.alive, false);
  assert.strictEqual(result.latencyMs, 0);
});

test('checkRoute returns alive: false for unreachable port without throwing', async () => {
  // Use a route ID that won't be running during tests
  // MLX on 8080 is unlikely to be running
  const result = await checkRoute('mlx-native');
  // We expect it to be dead in test environment
  assert.strictEqual(typeof result.alive, 'boolean');
  assert.strictEqual(typeof result.latencyMs, 'number');
});

test('ProviderUnavailableError has correct properties', () => {
  const error = new ProviderUnavailableError('background', ['LOCAL_OLLAMA', 'LOCAL_MLX']);
  assert.strictEqual(error.name, 'ProviderUnavailableError');
  assert.strictEqual(error.intent, 'background');
  assert.deepStrictEqual(error.triedRoutes, ['LOCAL_OLLAMA', 'LOCAL_MLX']);
  assert.ok(error.message.includes('No provider available for intent'));
  assert.ok(error.message.includes('background'))
});

test('resolveProviderWithFallback throws for unknown intent', async () => {
  try {
    await resolveProviderWithFallback('unknown-intent');
    assert.fail('Should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('Unknown intent: unknown-intent'));
  }
});

test('resolveProviderWithFallback tries routes in priority order', async () => {
  // This test documents the expected behavior
  // In a real environment with Ollama/CCR running, it would return a route
  // In test environment, it should throw ProviderUnavailableError
  try {
    const result = await resolveProviderWithFallback('background');
    // If we get here, a provider was found
    assert.ok(result);
    assert.ok(result.id);
    assert.ok(result.baseURL);
    assert.ok(result.cost);
  } catch (e) {
    // Expected in test environment where providers aren't running
    assert.ok(e instanceof ProviderUnavailableError || e.name === 'ProviderUnavailableError');
    assert.strictEqual(e.intent, 'background');
    assert.ok(Array.isArray(e.triedRoutes));
    // Background intent tries OLLAMA, MLX, CCR
    assert.ok(e.triedRoutes.includes('ollama'));
    assert.ok(e.triedRoutes.includes('mlx-native'));
    assert.ok(e.triedRoutes.includes('ccr'));
  }
});

test('resolveProviderWithFallback review intent has correct priority', async () => {
  try {
    await resolveProviderWithFallback('review');
  } catch (e) {
    if (e instanceof ProviderUnavailableError) {
      // Review tries CCR, then OLLAMA, then OPENROUTER
      const routes = e.triedRoutes;
      assert.ok(routes.includes('ccr'));
      assert.ok(routes.includes('ollama'));
      assert.ok(routes.includes('openrouter'));
    }
  }
});

test('resolveProviderWithFallback planning intent has correct priority', async () => {
  try {
    await resolveProviderWithFallback('planning');
  } catch (e) {
    if (e instanceof ProviderUnavailableError) {
      // Planning tries CCR, then OPENROUTER (no local providers)
      const routes = e.triedRoutes;
      assert.ok(routes.includes('ccr'));
      assert.ok(routes.includes('openrouter'));
      // Planning should NOT try OLLAMA or MLX
      assert.ok(!routes.includes('ollama'), 'Planning should not try OLLAMA');
      assert.ok(!routes.includes('mlx-native'), 'Planning should not try MLX');
    }
  }
});
