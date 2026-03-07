import { codebaseIndexer } from '../codebase-indexer'
import { hybridRetriever } from '../llm/hybrid-retrieval'

interface BenchmarkQuery {
  query: string
  expectedFilePathPattern: RegExp
}

const GOLD_STANDARD_QUERIES: BenchmarkQuery[] = [
  {
    query: 'Where is the IPC handler for stories?',
    expectedFilePathPattern: /stories\.ts|main\.ts/i,
  },
  {
    query: 'Where is the hybrid retrieval system?',
    expectedFilePathPattern: /hybrid-retrieval\.ts/i,
  },
  {
    query: 'What handles file transactions?',
    expectedFilePathPattern: /transaction-manager\.ts/i,
  },
  {
    query: 'What manages the electron touch bar?',
    expectedFilePathPattern: /touch-bar\.ts|touch-bar-types\.ts/i,
  },
  {
    query: 'Which file contains the HybridRetriever class?',
    expectedFilePathPattern: /hybrid-retrieval\.ts/i,
  }
]

export async function runRAGBenchmark() {
  let fastMRRSum = 0
  let deepMRRSum = 0
  const topN = 10

  for (const item of GOLD_STANDARD_QUERIES) {
    // Run Fast Mode (Semantic)
    // The underlying method is `search(query: string, topK?: number)`
    const fastResults = await codebaseIndexer.search(item.query, topN)
    let fastRank = 0
    for (let i = 0; i < fastResults.length; i++) {
      if (item.expectedFilePathPattern.test(fastResults[i].path)) {
        fastRank = i + 1
        break
      }
    }
    fastMRRSum += fastRank > 0 ? 1 / fastRank : 0

    // Run Deep Mode (Hybrid)
    const deepResults = await hybridRetriever.search(item.query, topN)
    let deepRank = 0
    for (let i = 0; i < deepResults.length; i++) {
      if (item.expectedFilePathPattern.test(deepResults[i].path)) {
        deepRank = i + 1
        break
      }
    }
    deepMRRSum += deepRank > 0 ? 1 / deepRank : 0
  }

  const fastMRR = fastMRRSum / GOLD_STANDARD_QUERIES.length
  const deepMRR = deepMRRSum / GOLD_STANDARD_QUERIES.length
  const delta = deepMRR - fastMRR

  return {
    fastMRR,
    deepMRR,
    delta
  }
}
