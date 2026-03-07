export function normalizeEmbedding(embedding: number[]): number[] {
  let sum = 0;
  for (const val of embedding) {
    sum += val * val;
  }
  const magnitude = Math.sqrt(sum);
  if (magnitude === 0) return embedding;

  return embedding.map(val => val / magnitude);
}
