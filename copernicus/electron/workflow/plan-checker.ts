import { llmService } from '../llm/service';
import { modelRegistry } from '../models/model-registry';
import { systemPromptBuilder } from '../llm/system-prompt-builder';
import log from 'electron-log';
import { SettingsStore } from '../settings-store';

export interface PlanCheckInput {
  storyId: string;
  acceptanceCriteria: string[];
  frozenSurfaces: string[];
  definitionOfDone: string[];
  assembledContext: string;  // output from ContextAssembler
}

export interface PlanCheckResult {
  verdict: 'approved' | 'revision_required' | 'blocked';
  issues: Array<{ severity: 'error' | 'warning'; description: string }>;
  revision_request?: string;
}

export class PlanChecker {
  private settingsStore: SettingsStore;

  constructor(settingsStore: SettingsStore) {
    this.settingsStore = settingsStore;
  }

  async check(plan: PlanCheckInput): Promise<PlanCheckResult> {
    const enabled = this.settingsStore.get('workflow.planCheck.enabled', true);
    if (!enabled) {
      return { verdict: 'approved', issues: [] };
    }

    const systemPromptText = `You are a plan-checker. Read-only. You verify that the execution plan covers all AC items and respects all frozen surfaces. Output JSON matching PlanCheckResult.`;
    
    let finalSystemPrompt = systemPromptText;
    if (systemPromptBuilder) {
      finalSystemPrompt = systemPromptBuilder.build({
        persona: 'checker',
        taskDescription: systemPromptText
      });
    }

    const userMessage = `
Story ID: ${plan.storyId}

${finalSystemPrompt}

## Acceptance Criteria
${plan.acceptanceCriteria.map(ac => `- ${ac}`).join('\n')}

## Frozen Surfaces
${plan.frozenSurfaces.map(fs => `- ${fs}`).join('\n')}

## Definition of Done
${plan.definitionOfDone.map(dod => `- ${dod}`).join('\n')}

## Assembled Context (Execution Plan)
${plan.assembledContext}

Evaluate the plan against the ACs and Frozen Surfaces. Output valid JSON only, using this schema:
{
  "verdict": "approved" | "revision_required" | "blocked",
  "issues": [ { "severity": "error" | "warning", "description": "string" } ],
  "revision_request": "string" // optional
}
`;

    const fastModel = modelRegistry.getFastModel();
    const modelId = fastModel?.id || 'claude-3-5-haiku-20241022';

    try {
      const responseJsonStr = await llmService.generateText(userMessage, modelId);
      
      // Attempt to parse json. It might be wrapped in markdown code blocks.
      let jsonStr = responseJsonStr.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(jsonStr) as PlanCheckResult;
      
      // basic validation
      if (!['approved', 'revision_required', 'blocked'].includes(parsed.verdict)) {
         throw new Error('Invalid verdict returned from LLM');
      }

      return {
        verdict: parsed.verdict,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        revision_request: parsed.revision_request
      };
    } catch (err) {
      log.error('[PlanChecker] Failed to parse LLM response', err);
      return {
        verdict: 'blocked',
        issues: [{ severity: 'error', description: 'Plan checker could not parse a valid response' }]
      };
    }
  }
}
