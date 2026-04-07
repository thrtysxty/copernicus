// Story 631: GenAI Toolbox — Database MCP for Agent Intelligence
// Implementation provided by Jules
import { useState } from 'react'
import { Play, Database, Table as TableIcon } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

export default function DatabasePanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const invoke = useIpcError()

  const handleQuery = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResults(null)

    try {
      const response = await invoke<any>('db:query', query)
      const data = unwrapIpc<any>(response)

      // Attempt to parse text result or just display it
      if (data && data.content && data.content.length > 0) {
        try {
          const parsed = JSON.parse(data.content[0].text)
          if (Array.isArray(parsed)) {
            setResults(parsed)
          } else {
            setResults([{ result: data.content[0].text }])
          }
        } catch (e) {
          setResults([{ result: data.content[0].text }])
        }
      } else {
        setResults([])
      }
    } catch (err) {
      setResults([{ error: err instanceof Error ? err.message : String(err) }])
    } finally {
      setLoading(false)
    }
  }

  const handleListTables = async () => {
    setLoading(true)
    setResults(null)
    setQuery("SELECT name FROM sqlite_master WHERE type='table';")
    try {
      const response = await invoke<any>('db:list-tables')
      const data = unwrapIpc<any>(response)

      if (data && data.content && data.content.length > 0) {
         try {
           const parsed = JSON.parse(data.content[0].text)
           if (Array.isArray(parsed)) {
             setResults(parsed)
           } else {
             setResults([{ result: data.content[0].text }])
           }
         } catch(e) {
           setResults([{ result: data.content[0].text }])
         }
      } else {
        setResults([])
      }
    } catch (err) {
      setResults([{ error: err instanceof Error ? err.message : String(err) }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-300 p-6 overflow-hidden">
      <div className="flex items-center space-x-2 mb-6">
        <Database className="text-copernicus-phosphor w-5 h-5" />
        <h2 className="text-lg font-mono tracking-wider text-zinc-100">DATABASE QUERY MCP</h2>
      </div>

      <div className="flex flex-col flex-1 space-y-4">
        <div className="flex space-x-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-[#080808] border border-copernicus-steel rounded p-3 font-mono text-sm text-zinc-300 resize-none h-32 focus:outline-none focus:border-copernicus-phosphor transition-colors"
            placeholder="SELECT * FROM episodes LIMIT 10;"
          />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleQuery}
            disabled={loading || !query.trim()}
            className="flex items-center space-x-2 bg-[#080808] hover:bg-zinc-900 border border-copernicus-steel rounded px-4 py-2 font-mono text-sm disabled:opacity-50"
          >
            <Play className="w-4 h-4 text-copernicus-phosphor" />
            <span>RUN QUERY</span>
          </button>

          <button
            onClick={handleListTables}
            disabled={loading}
            className="flex items-center space-x-2 bg-[#080808] hover:bg-zinc-900 border border-copernicus-steel rounded px-4 py-2 font-mono text-sm disabled:opacity-50"
          >
            <TableIcon className="w-4 h-4 text-zinc-400" />
            <span>LIST TABLES</span>
          </button>
        </div>

        <div className="flex-1 border border-copernicus-steel rounded bg-[#080808] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-zinc-500 font-mono">EXECUTING QUERY...</div>
          ) : results ? (
            results.length > 0 ? (
              <table className="w-full text-left text-sm font-mono border-collapse">
                <thead className="bg-zinc-900 sticky top-0 border-b border-copernicus-steel z-10">
                  <tr>
                    {Object.keys(results[0]).map((key) => (
                      <th key={key} className="p-3 text-zinc-400 font-medium tracking-wider text-xs">
                        {key.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50">
                  {results.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-900/50 transition-colors">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="p-3 text-zinc-300 max-w-xs truncate" title={String(val)}>
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 font-mono">NO RESULTS</div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600 font-mono">ENTER QUERY AND RUN</div>
          )}
        </div>
      </div>
    </div>
  )
}
