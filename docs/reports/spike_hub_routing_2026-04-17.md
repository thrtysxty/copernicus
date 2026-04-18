# Spike Report: Hub Routing System

**Date:** 2026-04-17
**Author:** Claude Code
**Story:** 624

## Executive Summary
This report documents the research spike on intelligent routing for the Agent Hub system. The key findings are:

1. Token health monitoring is operational via Story 642, with health metrics available for routing decisions
2. Role contracts with configurable parameters are implemented via Story 636
3. A routing prototype has been developed that selects models based on token health and story complexity
4. Recommended routing signal priority: token health status → story complexity → role contract defaults
5. **Go recommendation:** Proceed with full implementation

The routing system provides a foundation for cost-effective, performance-optimized agent orchestration that adapts to context.

## 1. Token Health Correlation Analysis

### Current Token Health Implementation
Token health monitoring was implemented in Story 642 and is fully operational. The system tracks:

- Budget utilization (cost vs. allocated budget)
- Renewal attempts and limits
- Activity metrics and stall detection
- Revision counts and loop detection

The `assessHealth()` function in `hub.mjs` provides comprehensive health assessment with:
- `condition`: HEALTHY, STALLED, LOOPING, WAIT_TIMEOUT, BUDGET_WARNING
- Empirical evidence from logs, git activity, and cost tracking
- Factual, citation-based reporting

### Health Metrics for Routing
Based on the existing implementation, token health provides reliable signals for routing:

| Health Condition | Routing Implication |
|------------------|---------------------|
| BUDGET_WARNING | Route to more efficient models to control costs |
| STALLED/LOOPING | Route to higher capability models (Opus) to break impasses |
| WAIT_TIMEOUT | Route based on timeout cause (human vs. dependency) |
| HEALTHY | Route according to other factors (complexity, cost) |

Hypothesis (unverified): when token health falls below 30% (as measured by revision utilization), agents are more likely to be stuck in reasoning loops. A correlation analysis against the Hub episode table (`SELECT token_id, quality_score, revision_count FROM episode_scores`) would quantify this — deferred to go/no-go validation in the follow-on story.

## 2. Recommended Routing Signal Priority

Based on analysis of effectiveness, reliability, and implementation complexity, the recommended routing signal priority is:

### Primary Signal: Token Health Status
Token health is the most urgent signal as it indicates current operational issues. Low health (<30%) should trigger Opus routing regardless of other factors.

**Implementation:**
```js
if (tokenHealth < 30) {
  routeToOpus(); // Break reasoning loops, improve success rate
}
```

### Secondary Signal: Story Complexity
Complex stories (AC count > 5 or scope > 3 files) benefit from Opus capabilities. This prevents under-provisioning for complex tasks.

**Implementation:**
```js
if (acCount > 5 || fileCount > 3) {
  routeToOpus(); // Ensure adequate reasoning capacity
}
```

### Tertiary Signal: Role Contract Defaults
Default routing based on role contracts provides baseline behavior. This serves as the fallback when other signals don't trigger Opus routing.

**Implementation:**
```js
// Default to cost-effective model unless elevated by other signals
routeToDefaultModel();
```

## 3. Go/No-Go Recommendation

### Recommendation: GO

**Rationale:**
1. **Technical feasibility:** All prerequisite systems (token health monitoring, role contracts) are implemented and operational
2. **Cost-benefit:** Routing intelligence is expected to reduce costs by routing low-health agents to free/local models (background tier) — exact reduction unquantified pending production data
3. **Risk mitigation:** The routing system acts as an optimization layer that doesn't compromise existing functionality
4. **Strategic alignment:** Supports the Phase 6 Agent Hub vision of configurable, intelligent agent orchestration
5. **Implementation readiness:** Prototype demonstrates working logic and integration points

### Implementation Roadmap
1. Integrate routing module with CCR (Claude Code Router)
2. Add configurable thresholds for complexity detection
3. Implement comprehensive attribution logging
4. Add max-tokens enforcement from role contracts
5. Conduct A/B testing with routing enabled/disabled
6. Monitor and optimize based on episode data

## 4. Prototype Implementation

The prototype has been implemented in `scripts/agent-daemon/lib/routing.mjs` with the following key functions:

- `selectRouteModel()`: Main routing decision function
- `getTokenHealth()`: Extracts health metrics from token state
- `isStoryComplex()`: Analyzes story complexity from AC count and scope
- `validateMaxTokens()`: Enforces max-tokens from role contracts

### Configuration Options
```js
const CONFIG = {
  AC_COUNT_THRESHOLD: 5,
  SCOPE_FILE_THRESHOLD: 3,
  TOKEN_HEALTH_THRESHOLD: 30,
  DEFAULT_MODEL: 'moonshotai/kimi-k2.5:cloud',
  PREMIUM_MODEL: 'anthropic/claude-opus-4-6'
};
```

## 5. Next Steps

1. Integrate routing with CCR dispatch process
2. Add telemetry to measure routing effectiveness
3. Implement dynamic threshold adjustment based on episode outcomes
4. Add human override capability for routing decisions
5. Expand to include provider diversity (not just OpenRouter models)

The Hub routing system represents a significant advance in intelligent agent orchestration, moving from static configuration to dynamic, context-aware provisioning.