import { codebaseIndexer } from '../codebase-indexer'
import { lspManager } from '../lsp/lsp-manager'

export class HybridRetriever {
  private readonly K = 60

  public async search(query: string, topN = 10) {
    const [semanticResults, symbolResults] = await Promise.all([
      codebaseIndexer.search(query, 50),
      this.getLspSymbols(query, 50)
    ])

    const rrfScores = new Map<string, { item: any; score: number }>()

    semanticResults.forEach((item, index) => {
      const key = `${item.path}#${item.chunkId || item.lineStart}`
      const rank = index + 1
      const score = 1 / (this.K + rank)

      if (rrfScores.has(key)) {
        rrfScores.get(key)!.score += score
      } else {
        rrfScores.set(key, { item, score })
      }
    })

    symbolResults.forEach((item, index) => {
      const key = `${item.path}#${item.lineStart}`
      const rank = index + 1
      const score = 1 / (this.K + rank)

      if (rrfScores.has(key)) {
        rrfScores.get(key)!.score += score
      } else {
        // Adapt LSP symbol result to match semantic result format if possible
        rrfScores.set(key, {
          item: {
            path: item.path,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd,
            symbols: item.name,
            content: `// Symbol: ${item.name} (${item.kind})`,
            similarity: 0
          },
          score
        })
      }
    })

    const merged = Array.from(rrfScores.values())
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, topN)

    return merged
  }

  private async getLspSymbols(query: string, limit = 50) {
    try {
      const symbols = await lspManager.sendRequest('workspace/symbol', { query })
      if (!Array.isArray(symbols)) return []

      return symbols.slice(0, limit).map((sym: any) => {
        let uri = sym.location?.uri || sym.uri || ''
        const filePath = uri.replace('file://', '')
        const lineStart = sym.location?.range?.start?.line ?? sym.range?.start?.line ?? 0
        const lineEnd = sym.location?.range?.end?.line ?? sym.range?.end?.line ?? 0

        return {
          path: filePath,
          lineStart,
          lineEnd,
          name: sym.name,
          kind: sym.kind
        }
      })
    } catch {
      return []
    }
  }
}

export const hybridRetriever = new HybridRetriever()
