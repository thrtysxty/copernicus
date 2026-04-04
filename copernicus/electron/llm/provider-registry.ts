// Story 626 — Provider Registry Abstraction
// STUB: Full implementation delivered by Jules

export interface ProviderDefinition {
  id: string;
  displayName: string;
  baseUrl: string;
  resolveKey(): string | null;
  listModels?(): Promise<ProviderModel[]>;
  supportsToolCalling: boolean;
  oauthChannel?: string;
}

export interface ProviderModel {
  id: string;
  name: string;
  contextLength: number;
  supportsToolCalling: boolean;
  pricing?: { promptPer1M: number; completionPer1M: number };
}

export class ProviderRegistry {
  private providers: Map<string, ProviderDefinition> = new Map();

  register(def: ProviderDefinition): void {
    this.providers.set(def.id, def);
  }

  get(id: string): ProviderDefinition | undefined {
    return this.providers.get(id);
  }

  list(): ProviderDefinition[] {
    return Array.from(this.providers.values());
  }

  listAuthenticated(): ProviderDefinition[] {
    return this.list().filter(p => p.resolveKey() !== null);
  }
}

export const providerRegistry = new ProviderRegistry();
