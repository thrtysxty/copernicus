import { test } from 'node:test';
import assert from 'node:assert';
import { loadOrgChart } from '../lib/hub.mjs';

test('loadOrgChart substitutes mlx-native on Apple Silicon with no cloud keys', (t) => {
  // Store originals
  const origArch = process.arch;
  const origPlatform = process.platform;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  const origOpenrouter = process.env.OPENROUTER_API_KEY;
  const origOpenai = process.env.OPENAI_API_KEY;

  // Mock Apple Silicon and no keys
  Object.defineProperty(process, 'arch', { value: 'arm64' });
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const chart = loadOrgChart();

  assert.strictEqual(chart.roles.coder.assigned_to.provider, 'mlx-native');
  assert.strictEqual(chart.roles.coder.assigned_to.model, 'mlx-community/Qwen2.5-Coder-7B-Instruct-4bit');

  assert.strictEqual(chart.roles.reviewer.assigned_to.provider, 'mlx-native');
  assert.strictEqual(chart.roles.reviewer.assigned_to.model, 'mlx-community/DeepSeek-R1-Distill-Qwen-7B-4bit');

  assert.strictEqual(chart.roles.planner.assigned_to.provider, 'mlx-native');
  assert.strictEqual(chart.roles.planner.assigned_to.model, 'mlx-community/Mistral-7B-Instruct-v0.3-4bit');

  assert.strictEqual(chart.roles.sentinel.assigned_to.provider, 'mlx-native');
  assert.strictEqual(chart.roles.sentinel.assigned_to.model, 'mlx-community/DeepSeek-R1-Distill-Qwen-7B-4bit');

  // Restore originals
  Object.defineProperty(process, 'arch', { value: origArch });
  Object.defineProperty(process, 'platform', { value: origPlatform });
  if (origAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = origAnthropic;
  if (origOpenrouter !== undefined) process.env.OPENROUTER_API_KEY = origOpenrouter;
  if (origOpenai !== undefined) process.env.OPENAI_API_KEY = origOpenai;
});

test('loadOrgChart does NOT substitute on non-Apple-Silicon', (t) => {
  // Store originals
  const origArch = process.arch;
  const origPlatform = process.platform;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  const origOpenrouter = process.env.OPENROUTER_API_KEY;
  const origOpenai = process.env.OPENAI_API_KEY;

  // Mock non-Apple Silicon
  Object.defineProperty(process, 'arch', { value: 'x64' });
  Object.defineProperty(process, 'platform', { value: 'linux' });
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const chart = loadOrgChart();

  assert.notStrictEqual(chart.roles.coder.assigned_to.provider, 'mlx-native');

  // Restore originals
  Object.defineProperty(process, 'arch', { value: origArch });
  Object.defineProperty(process, 'platform', { value: origPlatform });
  if (origAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = origAnthropic;
  if (origOpenrouter !== undefined) process.env.OPENROUTER_API_KEY = origOpenrouter;
  if (origOpenai !== undefined) process.env.OPENAI_API_KEY = origOpenai;
});

test('loadOrgChart does NOT substitute if cloud keys present', (t) => {
  // Store originals
  const origArch = process.arch;
  const origPlatform = process.platform;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;

  // Mock Apple Silicon but with cloud keys
  Object.defineProperty(process, 'arch', { value: 'arm64' });
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  process.env.ANTHROPIC_API_KEY = 'sk-ant-testkey';

  const chart = loadOrgChart();

  assert.notStrictEqual(chart.roles.coder.assigned_to.provider, 'mlx-native');

  // Restore originals
  Object.defineProperty(process, 'arch', { value: origArch });
  Object.defineProperty(process, 'platform', { value: origPlatform });
  if (origAnthropic !== undefined) {
    process.env.ANTHROPIC_API_KEY = origAnthropic;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }
});
