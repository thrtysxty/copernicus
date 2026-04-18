/**
 * Intelligent routing logic for Claude Code Router (CCR)
 * Makes routing decisions based on token health, complexity metrics, and role contracts
 */

import { getOrgChart, loadContract, attribute } from './hub.mjs';

// Configurable thresholds for complexity-based routing
const CONFIG = {
  // Thresholds for selecting Opus tier
  AC_COUNT_THRESHOLD: 5,
  SCOPE_FILE_THRESHOLD: 3,

  // Token health threshold for preferring Opus
  TOKEN_HEALTH_THRESHOLD: 30,

  // Default model for simple tasks
  DEFAULT_MODEL: 'moonshotai/kimi-k2.5:cloud',

  // Premium model for complex tasks or low token health
  PREMIUM_MODEL: 'anthropic/claude-opus-4-6'
};

/**
 * Analyzes token health and returns health percentage
 * @param {string} tokenId - The token ID to check
 * @param {object} orgChart - The current organization chart
 * @returns {number} Health percentage (0-100)
 */
function getTokenHealth(tokenId, orgChart) {
  try {
    // Get role configuration for the token
    const role = tokenId.split('_')[1]; // Extract role from token from token ID
    const roleConfig = orgChart.roles[role];

    if (!roleConfig) {
      console.warn(`[routing] Role ${role} not found in org chart`);
      return 100; // Default to healthy if role not found
    }

    // Health proxy: revision utilization from the token's health record.
    // current_cost_usd is not tracked in hub.mjs; revision exhaustion is the live signal.
    const health = roleConfig.health || {};
    const revisionCount = health.revision_count || 0;
    const maxRevisions = health.max_revisions || 3;
    const healthPercentage = Math.max(0, 100 - (revisionCount / maxRevisions * 100));
    return healthPercentage;
  } catch (e) {
    console.error(`[routing] Failed to get token health: ${e.message}`);
    return 100; // Default to healthy on error
  }
}

/**
 * Determines if a story is complex based on acceptance criteria count and scope
 * @param {object} story - Story object with ACs and scope
 * @returns {object} { isComplex: boolean, metrics: object }
 */
function isStoryComplex(story) {
  try {
    // Count acceptance criteria
    const acCount = Array.isArray(story.acceptanceCriteria) ?
      story.acceptanceCriteria.length : 0;

    // Count scope files
    const scopeFileCount = Array.isArray(story.scope) ?
      story.scope.filter(item => typeof item === 'string' &&
        (item.endsWith('.ts') || item.endsWith('.tsx') ||
         item.endsWith('.py') || item.endsWith('.js'))).length : 0;

    const isComplex = acCount > CONFIG.AC_COUNT_THRESHOLD ||
                      scopeFileCount > CONFIG.SCOPE_FILE_THRESHOLD;

    return {
      isComplex,
      metrics: {
        acCount,
        scopeFileCount,
        acCountThreshold: CONFIG.AC_COUNT_THRESHOLD,
        scopeFileThreshold: CONFIG.SCOPE_FILE_THRESHOLD
      }
    };
  } catch (e) {
    console.error(`[routing] Failed to analyze story complexity: ${e.message}`);
    return { isComplex: false, metrics: {} };
  }
}

/**
 * Selects the appropriate model based on token health and story complexity
 * @param {string} tokenId - The token ID making the request
 * @param {object} story - Story object with ACs and scope
 * @param {object} roleContract - Role contract for the requesting role
 * @returns {object} { model: string, reason: string, config: object }
 */
export function selectRouteModel(tokenId, story, roleContract) {
  try {
    const orgChart = getOrgChart();

    // Get token health
    const tokenHealth = getTokenHealth(tokenId, orgChart);
    const isLowHealth = tokenHealth < CONFIG.TOKEN_HEALTH_THRESHOLD;

    // Analyze story complexity
    const { isComplex, metrics } = isStoryComplex(story);

    // Check if role contract specifies max_tokens
    let maxTokens = 4096; // Default
    if (roleContract && roleContract.token_defaults) {
      maxTokens = roleContract.token_defaults.max_tokens || 4096;
    }

    // Check allowed_providers from role contract (AC-2)
    const allowedProviders = roleContract && Array.isArray(roleContract.allowed_providers) && roleContract.allowed_providers.length > 0
      ? roleContract.allowed_providers
      : null;

    // Determine routing decision
    let model = CONFIG.DEFAULT_MODEL;
    let route = 'default';
    let reason = 'Default model selected';

    if (isLowHealth) {
      // AC-1: low health → background (cheap/local), not premium
      route = 'background';
      model = 'ollama/gemma4:e4b';
      reason = `Token health below ${CONFIG.TOKEN_HEALTH_THRESHOLD}% (${tokenHealth.toFixed(1)}%) — routing to background to reduce cost`;
    } else if (isComplex) {
      route = 'think';
      model = CONFIG.PREMIUM_MODEL;
      reason = `Story complexity exceeds threshold (ACs: ${metrics.acCount}, files: ${metrics.scopeFileCount}) — selecting think tier`;
    }

    // AC-2: enforce allowed_providers if specified in role contract
    if (allowedProviders) {
      const routeProvider = route === 'background' ? 'ollama' : 'openrouter';
      if (!allowedProviders.includes(routeProvider)) {
        const fallbackProvider = allowedProviders[0];
        route = 'default';
        model = CONFIG.DEFAULT_MODEL;
        reason = `Provider '${routeProvider}' not in allowed_providers [${allowedProviders.join(', ')}] — falling back to ${fallbackProvider}`;
      }
    }

    // Log routing decision to Hub attribution ledger
    const attributionRecord = {
      surface: 'routing_decision',
      executing_actor: tokenId,
      authority_level: 3, // Medium authority for routing decisions
      action_type: 'model_selection',
      target: model,
      summary: reason,
      token_id: tokenId
    };

    // AC-3: write to Hub attribution ledger — fire-and-forget, don't block routing
    try { attribute(attributionRecord); } catch (_) {}

    return {
      model,
      reason,
      config: { ...CONFIG },
      tokenHealth,
      complexityMetrics: metrics,
      maxTokens,
      routingTimestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error(`[routing] Failed to select model: ${e.message}`);
    // On error, fall back to default model
    return {
      model: CONFIG.DEFAULT_MODEL,
      reason: `Routing error: ${e.message}. Using default model as fallback.`,
      config: { ...CONFIG }
    };
  }
}

/**
 * Gets the max_tokens limit from a role contract
 * @param {string} role - The role name
 * @returns {number} Max tokens limit, or null if not specified
 */
export function getMaxTokensFromContract(role) {
  try {
    const contract = loadContract(role);
    if (contract && contract.token_defaults && contract.token_defaults.max_tokens) {
      return contract.token_defaults.max_tokens;
    }
    return null;
  } catch (e) {
    console.warn(`[routing] Could not get max_tokens from contract ${role}: ${e.message}`);
    return null;
  }
}

/**
 * Validates that max_tokens is enforced at dispatch time
 * @param {number} requestedTokens - Tokens requested for the operation
 * @param {number} maxTokens - Max tokens allowed by role contract
 * @returns {object} { allowed: boolean, message: string }
 */
export function validateMaxTokens(requestedTokens, maxTokens) {
  if (maxTokens === null) {
    return { allowed: true, message: 'No max_tokens limit specified in contract' };
  }

  if (requestedTokens <= maxTokens) {
    return { allowed: true, message: `Requested tokens (${requestedTokens}) within limit (${maxTokens})` };
  }

  return {
    allowed: false,
    message: `Requested tokens (${requestedTokens}) exceeds contract limit (${maxTokens})`
  };
}

// Export CONFIG for testing and inspection
export function getConfig() {
  return { ...CONFIG };
}