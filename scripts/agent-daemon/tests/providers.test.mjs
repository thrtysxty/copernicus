import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { loadRegistry, getProvider, getModel, getProvidersForTier, getModelsForProvider, _resetRegistryCache } from '../lib/providers.mjs';

test('loadRegistry() returns both providers and models sections', () => {
    _resetRegistryCache();
    const registry = loadRegistry();
    assert.ok(registry.providers, 'registry should have providers');
    assert.ok(registry.models, 'registry should have models');
    assert.ok(Object.keys(registry.providers).length >= 6);
    assert.ok(Object.keys(registry.models).length >= 7);
});

test('getProvider(\'local-ollama\') returns correct baseURL', () => {
    _resetRegistryCache();
    const provider = getProvider('local-ollama');
    assert.strictEqual(provider.baseURL, 'http://localhost:11434/v1');
});

test('getProvider(\'cloud-ollama\') returns a different baseURL from local-ollama', () => {
    _resetRegistryCache();
    const cloudOllama = getProvider('cloud-ollama');
    const localOllama = getProvider('local-ollama');
    assert.notStrictEqual(cloudOllama.baseURL, localOllama.baseURL);
    assert.strictEqual(cloudOllama.baseURL, 'https://ollama.com/api');
});

test('getModel(\'kimi-k2.5:cloud\') returns provider: \'cloud-ollama\'', () => {
    _resetRegistryCache();
    const model = getModel('kimi-k2.5:cloud');
    assert.strictEqual(model.provider, 'cloud-ollama');
});

test('getProvidersForTier(\'free\') returns mlx-native, local-ollama, ccr but NOT openrouter', () => {
    _resetRegistryCache();
    const freeProviders = getProvidersForTier('free');
    const ids = freeProviders.map(p => p.id);
    assert.ok(ids.includes('mlx-native'));
    assert.ok(ids.includes('local-ollama'));
    assert.ok(ids.includes('ccr'));
    assert.ok(!ids.includes('openrouter'));
});

test('getProvider(\'nonexistent\') throws', () => {
    _resetRegistryCache();
    assert.throws(() => {
        getProvider('nonexistent');
    }, /Provider not found: nonexistent/);
});

test('User override at ~/.copernicus/providers.yaml: custom baseURL override is applied', () => {
    _resetRegistryCache();

    // Create override
    const overrideDir = path.join(os.homedir(), '.copernicus');
    if (!fs.existsSync(overrideDir)) {
        fs.mkdirSync(overrideDir, { recursive: true });
    }
    const overridePath = path.join(overrideDir, 'providers.yaml');

    // We will backup if exists (just in case)
    let backupContent = null;
    if (fs.existsSync(overridePath)) {
        backupContent = fs.readFileSync(overridePath, 'utf8');
    }

    try {
        const overrideData = {
            providers: {
                'local-ollama': {
                    baseURL: 'http://custom-host:11434/v1'
                }
            }
        };
        fs.writeFileSync(overridePath, yaml.dump(overrideData));

        const provider = getProvider('local-ollama');
        assert.strictEqual(provider.baseURL, 'http://custom-host:11434/v1');
    } finally {
        if (backupContent !== null) {
            fs.writeFileSync(overridePath, backupContent);
        } else {
            fs.unlinkSync(overridePath);
        }
        _resetRegistryCache();
    }
});
