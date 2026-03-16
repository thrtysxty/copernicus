import { useEffect } from 'react'
import { useDebugStore } from '../../store/debug'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

export function VariableWatch() {
  const isPaused = useDebugStore(s => s.isPaused)
  const scopes = useDebugStore(s => s.scopes)
  const variables = useDebugStore(s => s.variables)
  const setVariables = useDebugStore(s => s.setVariables)
  const invoke = useIpcError()

  useEffect(() => {
    // Auto-fetch top-level scopes when they change
    if (scopes.length > 0) {
      scopes.forEach(async (scope) => {
        if (!variables[scope.variablesReference]) {
          const res = await invoke<any>('debug:get-variables', scope.variablesReference)
          if (res.ok) {
            const data = unwrapIpc<any>(res)
            setVariables(scope.variablesReference, data.variables || [])
          }
        }
      })
    }
  }, [scopes])

  if (!isPaused) {
    return null
  }

  return (
    <div className="flex flex-col text-sm text-zinc-300">
      <div className="font-semibold px-2 py-1 bg-zinc-800">Variables</div>
      <div className="overflow-y-auto max-h-48 p-2">
        {scopes.length === 0 ? (
          <div className="text-zinc-500 italic">No variables</div>
        ) : (
          scopes.map((scope) => (
            <div key={scope.variablesReference} className="mb-2">
              <div className="font-medium text-zinc-400">{scope.name}</div>
              <div className="pl-4 border-l border-zinc-700 ml-1">
                {variables[scope.variablesReference]?.map((variable) => (
                  <div key={variable.name} className="flex">
                    <span className="text-copernicus-blue mr-2">{variable.name}:</span>
                    <span className="text-zinc-200 truncate">{variable.value}</span>
                  </div>
                ))}
                {!variables[scope.variablesReference] && (
                  <div className="text-zinc-500 italic">Loading...</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
