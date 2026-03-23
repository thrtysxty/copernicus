import log from '../utils/logger';
import { llmService } from '../llm/service';
import { modelRegistry } from '../models/model-registry';
import { memoryService } from './memoryService';

export class AutoExtractor {
  private count = 0;

  async extract(responseText: string, bankId: string, projectId: string): Promise<void> {
    this.count++;
    if (this.count % 3 !== 0) {
      return;
    }

    try {
      const prompt = `Extract 0–3 memory-worthy facts from this AI response. Facts should be durable conventions, decisions, or project-specific knowledge (not summaries of what was asked). Return JSON: { "facts": string[] }. If nothing is worth saving, return { "facts": [] }.\n\nResponse:\n${responseText.slice(0, 2000)}`;
      const fastModel = modelRegistry.getFastModel().id;
      const resultJson = await llmService.generateText(prompt, fastModel);

      let parsed: { facts: string[] };
      try {
        const jsonMatch = resultJson.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : resultJson;
        parsed = JSON.parse(jsonStr);
      } catch (err) {
        log.warn('[AutoExtractor] Failed to parse JSON:', err);
        return;
      }

      if (!parsed || !Array.isArray(parsed.facts) || parsed.facts.length === 0) {
        return;
      }

      for (const fact of parsed.facts) {
        if (typeof fact === 'string' && fact.trim()) {
          await memoryService.addMemory({
            projectId,
            bankId,
            eventType: 'memory_fact',
            content: fact.trim(),
            importance: 3,
            meta: { source: 'auto' }
          });
        }
      }
    } catch (err) {
      log.error('[AutoExtractor] Error extracting facts:', err);
    }
  }
}

export const autoExtractor = new AutoExtractor();
