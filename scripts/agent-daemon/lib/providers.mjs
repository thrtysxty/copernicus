import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

let registryCache = null;

const COST_TIER_ORDER = {
    'zero': 0,
    'free': 1,
    'paid_low': 2,
    'paid': 3,
    'paid_high': 4
};

function deepMerge(target, source) {
    if (!source) return target;
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], deepMerge(target[key], source[key]));
        }
    }
    Object.assign(target || {}, source);
    return target;
}

export function loadRegistry() {
    if (registryCache) {
        return registryCache;
    }

    // Determine defaultPath relative to this file
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const defaultPath = path.join(__dirname, '..', 'defaults', 'providers.yaml');
    const defaults = fs.existsSync(defaultPath) ? yaml.load(fs.readFileSync(defaultPath, 'utf8'), { schema: yaml.JSON_SCHEMA }) : { providers: {}, models: {} };

    const overridePath = path.join(os.homedir(), '.copernicus', 'providers.yaml');
    const overrides = fs.existsSync(overridePath) ? yaml.load(fs.readFileSync(overridePath, 'utf8'), { schema: yaml.JSON_SCHEMA }) : {};

    const merged = deepMerge(defaults, overrides);

    registryCache = {
        providers: merged.providers || {},
        models: merged.models || {}
    };

    return registryCache;
}

export function getProvider(id) {
    const registry = loadRegistry();
    if (!registry.providers[id] || registry.providers[id].enabled === false) {
        throw new Error(`Provider not found: ${id}`);
    }
    const config = registry.providers[id];

    let apiKey = '';
    if (config.auth && config.auth.startsWith('env:')) {
        const envVar = config.auth.split(':')[1];
        apiKey = process.env[envVar] || '';
    } else if (config.auth && config.auth !== 'none') {
        apiKey = config.auth;
    } else if (id === 'mlx-native') {
        apiKey = 'mlx';
    } else if (id === 'local-ollama') {
        apiKey = 'ollama';
    }

    let api = 'openai';
    if (id === 'anthropic') {
        api = 'anthropic-messages';
    } else if (config.type === 'cloud' && id === 'google') { // Just in case
        api = 'google-generative-ai';
    }

    const provider = {
        id,
        ...config,
        apiKey,
        api,
        cost: config.cost_tier // Backwards compatibility for llm.mjs ROUTES
    };
    return provider;
}

export function getModel(id) {
    const registry = loadRegistry();
    if (!registry.models[id]) {
        throw new Error(`Model not found: ${id}`);
    }
    return { id, ...registry.models[id] };
}

export function getProvidersForTier(maxCostTier) {
    const maxOrder = COST_TIER_ORDER[maxCostTier];
    if (maxOrder === undefined) {
        throw new Error(`Unknown cost tier: ${maxCostTier}`);
    }

    const registry = loadRegistry();
    const providers = [];

    for (const [id, config] of Object.entries(registry.providers)) {
        if (config.enabled !== false) {
            const order = COST_TIER_ORDER[config.cost_tier] || 0;
            if (order <= maxOrder) {
                providers.push({ id, ...config });
            }
        }
    }

    providers.sort((a, b) => {
        const orderA = COST_TIER_ORDER[a.cost_tier] || 0;
        const orderB = COST_TIER_ORDER[b.cost_tier] || 0;
        return orderA - orderB;
    });

    return providers;
}

export function getModelsForProvider(providerId) {
    const registry = loadRegistry();
    const models = [];

    for (const [id, config] of Object.entries(registry.models)) {
        if (config.provider === providerId) {
            models.push({ id, ...config });
        }
    }

    return models;
}

// For testing purposes
export function _resetRegistryCache() {
    registryCache = null;
}
