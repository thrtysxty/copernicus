import { normalizeEmbedding } from './alignment';

// LSP SymbolKind mapping (Language Server Protocol)
// 5 = Class, 11 = Interface, 6 = Method, 12 = Function, 13 = Variable
const WEIGHTS: Record<number, number> = {
  5: 1.5,   // Class
  11: 1.5,  // Interface
  6: 1.3,   // Method
  12: 1.3,  // Function
  13: 0.8,  // Variable
  // others default to 1.0
};

export class EmbeddingGenerator {
  public static applyWeights(embedding: number[], lspMetadataStr: string | null): number[] {
    let maxWeight = -Infinity;

    if (lspMetadataStr) {
      try {
        const metadata = JSON.parse(lspMetadataStr);
        if (Array.isArray(metadata)) {
          // Find the maximum weight among the symbols overlapping this chunk
          for (const meta of metadata) {
            const kindWeight = WEIGHTS[meta.kind] || 1.0;
            if (kindWeight > maxWeight) {
              maxWeight = kindWeight;
            }
          }
        }
      } catch (e) {
        // invalid JSON or other error, ignore
      }
    }

    const weight = maxWeight === -Infinity ? 1.0 : maxWeight;

    // First normalize the embedding to unit length (L2 normalization)
    const normalized = normalizeEmbedding(embedding);
    return normalized.map(val => val * weight);
  }
}
