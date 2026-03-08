I'll analyze the provided code files to understand the current implementation and provide recommendations for Story 229 implementation.

## 1. Current Architecture Analysis

### `codebase-indexer.ts` Structure
The current codebase indexer uses:
- File system walking and AST parsing via TypeScript compiler
- Documents are stored with content embeddings
- Uses `IndexedDocument` interface with `uid`, `filePath`, `content`, `embeddings`

### `state-ledger.ts` Structure
Manages:
- `CodebaseVector` type with `documents: IndexedDocument[]`
- UID generation using SHA-256 hashing
- Document lifecycle tracking

### `agents.py` Structure
Current agent system:
- Uses `codebase_context` parameter
- Supports RAG retrieval via `retrieve_relevant_docs`
- Agent orchestration with context passing

## 2. Integration Recommendations

### 2.1 Integrate 'workspace/symbol' into `codebase-indexer.ts`

**Current Symbol Interface Extension:**
```typescript
// Add to existing interfaces
interface IndexedSymbol extends SymbolInformation {
  uid: string;
  filePath: string;
  embeddings?: number[];
  symbolType: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

// Extend the indexer class
class CodebaseIndexer {
  private async indexSymbols(filePath: string, content: string): Promise<IndexedSymbol[]> {
    const symbols = await this.getSymbols(filePath, content);
    return symbols.map(symbol => ({
      ...symbol,
      uid: this.generateSymbolUID(filePath, symbol.name, symbol.kind),
      filePath,
      embeddings: await this.generateEmbeddings(this.getSymbolContext(symbol, content))
    }));
  }

  private generateSymbolUID(filePath: string, name: string, kind: SymbolKind): string {
    const content = `${filePath}:${name}:${kind}`;
    return createHash('sha256').update(content).digest('hex');
  }

  private getSymbolContext(symbol: SymbolInformation, fileContent: string): string {
    // Extract relevant context around the symbol
    const lines = fileContent.split('\n');
    const startLine = symbol.location.range.start.line;
    const contextLines = lines.slice(Math.max(0, startLine - 5), startLine + 10);
    return contextLines.join('\n');
  }
}
```

### 2.2 Store SymbolInformation UID in `codebase_vec`

**Extend `state-ledger.ts`:**
```typescript
// Update CodebaseVector type
interface CodebaseVector {
  documents: IndexedDocument[];
  symbols: IndexedSymbol[]; // Add symbols collection
}

// Update StateLedger methods
class StateLedger {
  async addSymbols(symbols: IndexedSymbol[]): Promise<void> {
    for (const symbol of symbols) {
      this.codebaseVec.symbols.push(symbol);
    }
    await this.persist();
  }

  async findSymbols(query: string, limit: number = 10): Promise<IndexedSymbol[]> {
    // Implement symbol search with embeddings similarity
    const queryEmbeddings = await generateEmbeddings(query);
    return this.codebaseVec.symbols
      .filter(s => s.embeddings)
      .sort((a, b) => this.cosineSimilarity(queryEmbeddings, a.embeddings!) - 
                      this.cosineSimilarity(queryEmbeddings, b.embeddings!))
      .slice(0, limit);
  }
}
```

### 2.3 Context Handoff in `backend/api/agents.py`

**Implement Symbol Context Handoff:**
```python
# Extend existing agent system
class SymbolContextAgent:
    def __init__(self):
        self.symbol_client = SymbolClient()  # Client to Electron symbol index
    
    async def get_symbol_context(self, symbol_query: str, file_path: Optional[str] = None):
        """Retrieve symbol context from the indexed codebase"""
        symbols = await self.symbol_client.find_symbols(symbol_query, file_path)
        
        if not symbols:
            return None
            
        context = []
        for symbol in symbols:
            symbol_context = {
                'uid': symbol['uid'],
                'name': symbol['name'],
                'file_path': symbol['filePath'],
                'symbol_type': symbol['symbolType'],
                'context': symbol.get('context', ''),
                'line_range': symbol.get('range', {})
            }
            context.append(symbol_context)
        
        return context

# Update main agent orchestration
class OrchestratorAgent:
    async def handle_request_with_symbols(self, user_query: str, symbol_context: Optional[dict] = None):
        # Enhance the context with symbol information
        enhanced_context = await self.enhance_with_symbols(user_query, symbol_context)
        
        # Pass to existing agent system
        return await self.process_request(user_query, enhanced_context)
    
    async def enhance_with_symbols(self, query: str, symbol_context: dict):
        if not symbol_context:
            symbol_agent = SymbolContextAgent()
            symbol_context = await symbol_agent.get_symbol_context(query)
        
        # Format symbol context for the LLM
        context_parts = []
        for symbol in symbol_context:
            context_parts.append(
                f"Symbol: {symbol['name']} ({symbol['symbol_type']})\n"
                f"File: {symbol['file_path']}\n"
                f"Context: {symbol['context']}\n"
            )
        
        return {
            'codebase_context': self.existing_context,
            'symbol_context': '\n'.join(context_parts),
            'symbol_uids': [s['uid'] for s in symbol_context]
        }
```

### 2.4 Trigger JIT Indexing for Symbol's File

**JIT Indexing Implementation:**
```typescript
// In codebase-indexer.ts
class CodebaseIndexer {
  private jitIndexingQueue = new Map<string, Promise<IndexedSymbol[]>>();
  
  async indexSymbolsJIT(filePath: string): Promise<IndexedSymbol[]> {
    // Check if already indexing this file
    if (this.jitIndexingQueue.has(filePath)) {
      return this.jitIndexingQueue.get(filePath)!;
    }
    
    const indexingPromise = this.performJITIndexing(filePath);
    this.jitIndexingQueue.set(filePath, indexingPromise);
    
    try {
      const symbols = await indexingPromise;
      await this.stateLedger.addSymbols(symbols);
      return symbols;
    } finally {
      this.jitIndexingQueue.delete(filePath);
    }
  }
  
  private async performJITIndexing(filePath: string): Promise<IndexedSymbol[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.indexSymbols(filePath, content);
  }
}

// API endpoint to trigger JIT indexing
app.post('/api/index/symbols/jit', async (req, res) => {
  const { filePath, symbolQuery } = req.body;
  
  try {
    const indexer = getCodebaseIndexer();
    const symbols = await indexer.indexSymbolsJIT(filePath);
    
    // Filter symbols if query provided
    const filteredSymbols = symbolQuery 
      ? symbols.filter(s => s.name.toLowerCase().includes(symbolQuery.toLowerCase()))
      : symbols;
    
    res.json({ symbols: filteredSymbols });
  } catch (error) {
    res.status(500).json({ error: 'JIT indexing failed' });
  }
});
```

**Python-side JIT Trigger:**
```python
# In agents.py
class JITSymbolIndexer:
    async def ensure_symbol_indexed(self, file_path: str, symbol_name: str = None):
        """Trigger JIT indexing if symbols aren't already indexed"""
        # Check if symbols exist for this file
        existing_symbols = await self.symbol_client.get_symbols_by_file(file_path)
        
        if not existing_symbols:
            # Trigger JIT indexing
            await self.trigger_jit_indexing(file_path)
            
        # Return symbols (now freshly indexed if needed)
        return await self.symbol_client.get_symbols_by_file(file_path)
    
    async def trigger_jit_indexing(self, file_path: str):
        """Call Electron to index symbols in file"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'http://localhost:3000/api/index/symbols/jit',
                json={'filePath': file_path}
            ) as response:
                if response.status != 200:
                    raise Exception(f"JIT indexing failed: {await response.text()}")
```

## 3. Integration Points Summary

1. **Symbol Indexing**: Extend `CodebaseIndexer` to parse and index LSP symbols
2. **Storage**: Add `symbols` collection to `CodebaseVector` in state ledger
3. **Retrieval**: Implement symbol search with embedding similarity
4. **Context Handoff**: Enhance agent context with symbol information
5. **JIT Indexing**: On-demand indexing for files when symbols are requested but not indexed

This architecture maintains backward compatibility while adding powerful symbol-aware code navigation capabilities.
