import React, { useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'
import { useIpcError } from '../../../hooks/useIpcError'
import { unwrapIpc } from '../../../types/ipc'

export const DeviceSection: React.FC = () => {
  const invoke = useIpcError()
  const [device, setDevice] = useState<'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC'>('AGNOSTIC')

  useEffect(() => {
    invoke<any>('project:get-config').then((res: any) => {
      if (res.ok) {
        const data = unwrapIpc<any>(res)
        if (data && data.target_device) {
          setDevice(data.target_device)
        }
      }
    })
  }, [invoke])

  const handleDeviceChange = async (newDevice: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC') => {
    setDevice(newDevice)
    await invoke('project:save-config', { target_device: newDevice })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
          <Monitor size={20} className="text-copernicus-phosphor" /> Target Device
        </h2>
        <p className="text-[11px] text-zinc-500 uppercase tracking-[0.2em]">
          Set the target device for layout and code generation
        </p>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">Device Type</span>
            <span className="text-[11px] text-zinc-500">Determines the default device target when generating UI code</span>
          </div>
          <div className="flex gap-2 bg-black/40 p-1 rounded-lg border border-zinc-800/50">
            {(['MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC'] as const).map(d => (
              <button
                key={d}
                onClick={() => handleDeviceChange(d)}
                className={`px-4 py-1.5 rounded text-[11px] font-bold uppercase tracking-widest transition-all ${
                  device === d
                    ? 'bg-copernicus-phosphor text-[#050505] rounded-none'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
