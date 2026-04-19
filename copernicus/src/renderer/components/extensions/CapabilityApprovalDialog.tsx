import { useEffect, useState } from 'react'
import { useIpcError } from '../../hooks/useIpcError'

export interface CapabilityRequest {
  id: string
  extensionName: string
  displayName: string
  capabilities: {
    filesystem?: 'read' | 'read-write'
    network?: boolean
    subprocess?: boolean
  }
}

export function CapabilityApprovalDialog() {
  const [request, setRequest] = useState<CapabilityRequest | null>(null)
  const invoke = useIpcError()

  useEffect(() => {
    const removeListener = window.ipcRenderer.on('extension:request-approval', (_event, payload: CapabilityRequest) => {
      setRequest(payload)
    })
    return () => removeListener()
  }, [])

  const handleDecision = async (approved: boolean) => {
    if (!request) return
    const id = request.id
    setRequest(null)
    await invoke('extension:request-approval', { id, approved })
  }

  if (!request) return null

  const caps = request.capabilities
  const labels: string[] = []
  if (caps.filesystem === 'read') labels.push("Read files in your workspace")
  if (caps.filesystem === 'read-write') labels.push("Read and write files in your workspace")
  if (caps.network) labels.push("Make network requests")
  if (caps.subprocess) labels.push("Run child processes")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded shadow-xl max-w-md w-full">
        <h2 className="text-xl text-zinc-100 font-medium mb-4">
          Extension Requires Approval
        </h2>
        <p className="text-zinc-400 mb-4">
          The extension <strong className="text-zinc-200">{request.displayName || request.extensionName}</strong> is requesting the following capabilities:
        </p>
        <ul className="list-disc list-inside text-zinc-300 mb-6 space-y-1">
          {labels.map((lbl, idx) => (
            <li key={idx}>{lbl}</li>
          ))}
        </ul>
        <p className="text-zinc-500 text-sm mb-6">
          Do you want to allow this extension to run with these capabilities?
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            onClick={() => handleDecision(false)}
          >
            Deny
          </button>
          <button
            className="px-4 py-2 bg-copernicus-phosphor text-[#050505] font-medium rounded-none hover:opacity-90 transition-opacity"
            onClick={() => handleDecision(true)}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
