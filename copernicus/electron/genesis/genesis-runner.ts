import { GenesisPayload, SynthesisResult } from './types';
import { ModelRegistry } from '../models/model-registry';
import { AuthManager } from '../auth-manager';
import { StoriesManager } from '../stories';
import { SettingsStore } from '../settings-store';
import { ScaffoldRunner } from './scaffold';
import log from '../utils/logger';

export class GenesisRunner {
  private modelRegistry: ModelRegistry;
  private authManager: AuthManager;
  private storiesManager: StoriesManager;
  private settingsStore: SettingsStore;
  public scaffoldRunner: ScaffoldRunner;

  constructor(deps: {
    modelRegistry: ModelRegistry;
    authManager: AuthManager;
    storiesManager: StoriesManager;
    settingsStore: SettingsStore;
    scaffoldRunner: ScaffoldRunner;
  }) {
    this.modelRegistry = deps.modelRegistry;
    this.authManager = deps.authManager;
    this.storiesManager = deps.storiesManager;
    this.settingsStore = deps.settingsStore;
    this.scaffoldRunner = deps.scaffoldRunner;
  }

  public async run(payload: GenesisPayload): Promise<{ ok: boolean; error?: string; epicId?: string; storyIds?: string[] }> {
    const activeModel = this.modelRegistry.getActiveModel();
    if (!activeModel) {
      return { ok: false, error: 'NO_MODEL_CONFIGURED' };
    }

    const provider = activeModel.provider;
    const apiKey = this.authManager.getApiKey(provider);
    if (!apiKey && provider !== 'ollama') {
      return { ok: false, error: 'NO_MODEL_CONFIGURED' };
    }

    const isIncapable =
      activeModel.id === 'bitnet-b158-2b' ||
      (activeModel.contextWindow > 0 && activeModel.contextWindow < 8000);
    if (isIncapable) {
      return { ok: false, error: 'MODEL_TOO_SMALL' };
    }

    const systemPrompt = "You are a senior product manager and software architect. Given a project idea, generate a structured project plan in JSON. Be specific and actionable. Output only valid JSON, no markdown.";
    const userPrompt = `Project: ${payload.projectName}
Building: ${payload.idea}
For: ${payload.audience}
Core value: ${payload.coreValue}
Stack: ${payload.stack}

Generate:
{
  "epic": { "title": string, "description": string (2-3 sentences) },
  "stories": [
    { "title": string, "priority": "P1"|"P2"|"P3", "ac": string (one sentence) }
  ]
}
Produce 3-5 stories. Stories should be the minimum viable first sprint.`;

    let synthesisResult: SynthesisResult | null = null;
    try {
      synthesisResult = await this.callLLM(activeModel, systemPrompt, userPrompt);
    } catch (err: any) {
      log.error(`[GenesisRunner] LLM call failed: ${err.message}`);
      // Retry once if parse fails (handled in callLLM)
      if (err.message.includes('PARSE_FAILED')) {
         // Fallback as per AC4
         synthesisResult = {
           epic: { title: 'Project Foundation', description: 'Initial setup and core structure for the project.' },
           stories: [{ title: 'Set up project foundation', priority: 'P1', ac: 'Project repo is scaffolded and basic configuration is in place.' }]
         };
      } else {
        return { ok: false, error: 'LLM_SYNTHESIS_FAILED' };
      }
    }

    if (!synthesisResult) {
      return { ok: false, error: 'LLM_SYNTHESIS_FAILED' };
    }

    // AC3: Parse and write to Kanban
    try {
      const epicId = this.storiesManager.createStory({
        title: synthesisResult.epic.title,
        type: 'Epic',
        priority: 'P1',
        description: synthesisResult.epic.description
      });

      const storyIds: string[] = [];
      for (const s of synthesisResult.stories) {
        const storyId = this.storiesManager.createStory({
          title: s.title,
          type: 'Feature',
          priority: s.priority,
          epic: synthesisResult.epic.title,
          ac: s.ac
        });
        if (storyId) storyIds.push(storyId);
      }

      // Save workspace and projectName
      this.settingsStore.set('workspace', payload.repoPath);
      this.settingsStore.set('projectName', payload.projectName);

      // Story 288: Call ScaffoldRunner
      await this.scaffoldRunner.run(payload, synthesisResult);

      return { ok: true, epicId, storyIds };
    } catch (err: any) {
      log.error(`[GenesisRunner] Failed to populate Kanban or scaffold: ${err.message}`);
      return { ok: false, error: 'INTERNAL_ERROR' };
    }
  }

  private async callLLM(model: any, system: string, user: string, isRetry = false): Promise<SynthesisResult> {
    const provider = model.provider;
    const apiKey = this.authManager.getApiKey(provider);
    const baseUrl = this.authManager.getBaseUrl(provider);

    let response: any;
    if (provider === 'anthropic') {
      response = await fetch(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model.id,
          system: system,
          messages: [{ role: 'user', content: user }],
          max_tokens: 1000
        })
      });
    } else {
      // OpenAI compatible
      response = await fetch(`${baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          response_format: { type: 'json_object' }
        })
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM_CALL_FAILED: ${response.status} ${errText}`);
    }

    const data = await response.json();
    let content = '';
    if (provider === 'anthropic') {
      content = data.content[0].text;
    } else {
      content = data.choices[0].message.content;
    }

    try {
      // Strip markdown fences if present
      const jsonStr = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
      return JSON.parse(jsonStr);
    } catch (err) {
      if (!isRetry) {
        log.warn('[GenesisRunner] JSON parse failed, retrying with reminder...');
        return this.callLLM(model, system, user + "\n\nIMPORTANT: Output ONLY valid JSON. No markdown fences, no preamble.", true);
      }
      throw new Error('PARSE_FAILED');
    }
  }
}
