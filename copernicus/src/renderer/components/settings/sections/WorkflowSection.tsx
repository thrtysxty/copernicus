import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { Workflow, Shield, Clock, Save, Link } from 'lucide-react'
import { SettingsLoadResponse } from '../../../types/ipc'
import log from '../../../utils/logger'

interface WorkflowSettings {
  reviewEnabled: boolean
  defaultWorkflowTemplate: string
  autoSaveWorkflow: boolean
  maxExecutionTime: number
  storyAutoLink: boolean
}

export const WorkflowSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  
  const [templates, setTemplates] = useState<any[]>([])
  const [settings, setWorkflowSettings] = useState<WorkflowSettings>({
    reviewEnabled: false,
    defaultWorkflowTemplate: 'standard',
    autoSaveWorkflow: true,
    maxExecutionTime: 30,
    storyAutoLink: true
  })

  useEffect(() => {
    const init = async () => {
      try {
        const [tpls, s] = await Promise.all([
          invoke<any[]>('workflow:list-templates'),
          invoke<SettingsLoadResponse>('settings:load')
        ])

        if (Array.isArray(tpls)) setTemplates(tpls)
        if (s) {
          setWorkflowSettings({
            reviewEnabled: (s.reviewEnabled as boolean) ?? false,
            defaultWorkflowTemplate: (s.defaultWorkflowTemplate as string) ?? 'standard',
            autoSaveWorkflow: (s.autoSaveWorkflow as boolean) ?? true,
            maxExecutionTime: (s.maxExecutionTime as number) ?? 30,
            storyAutoLink: (s.storyAutoLink as boolean) ?? true
          })
        }
      } catch (e) {
        log.error('Failed to load workflow data', e)
      }
    }
    init()
  }, [invoke])

  const handleSave = async (patch: Partial<WorkflowSettings>) => {
    const newSettings = { ...settings, ...patch }
    setWorkflowSettings(newSettings)
    try {
      await invoke('settings:save', newSettings)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">Workflow Engine</h2>
        <p className="text-[11px] text-zinc-500 font-mono mt-1">Customise agentic execution behaviour and safety gates.</p>
      </div>

      <div className="space-y-6">
        <WorkflowToggle 
          label="Parallel Agent Review Gate"
          description="Require consensus from multiple models before applying code changes."
          icon={Shield}
          enabled={settings.reviewEnabled}
          onToggle={(v: boolean) => handleSave({ reviewEnabled: v })}
        />

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Workflow size={14} />
            <h3 className="text-[11px] uppercase font-bold tracking-wider">Execution Defaults</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-300 font-bold uppercase">Default Template</span>
              <select 
                value={settings.defaultWorkflowTemplate}
                onChange={e => handleSave({ defaultWorkflowTemplate: e.target.value })}
                className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded px-3 py-1.5 focus:outline-none focus:border-copernicus-phosphor min-w-[200px]"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-zinc-500" />
                <span className="text-[11px] text-zinc-300 font-bold uppercase">Max Execution Time</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={settings.maxExecutionTime}
                  onChange={e => handleSave({ maxExecutionTime: parseInt(e.target.value) })}
                  className="w-16 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-center font-mono text-copernicus-phosphor focus:outline-none"
                />
                <span className="text-[11px] text-zinc-500 uppercase font-bold">Minutes</span>
              </div>
            </div>
          </div>
        </section>

        <WorkflowToggle 
          label="Auto-Save Workflow State"
          description="Periodically persist graph execution state to the state ledger."
          icon={Save}
          enabled={settings.autoSaveWorkflow}
          onToggle={(v: boolean) => handleSave({ autoSaveWorkflow: v })}
        />

        <WorkflowToggle 
          label="Contextual Story Linking"
          description="Automatically associate new workflow runs with the active Kanban story."
          icon={Link}
          enabled={settings.storyAutoLink}
          onToggle={(v: boolean) => handleSave({ storyAutoLink: v })}
        />
      </div>
    </div>
  )
}

const WorkflowToggle = ({ label, description, icon: Icon, enabled, onToggle }: {
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-6 p-4 bg-[#0F0F0F] border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-all">
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded bg-zinc-900 ${enabled ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}>
        <Icon size={16} />
      </div>
      <div>
        <div className="text-[11px] text-zinc-200 uppercase font-bold tracking-tight">{label}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{description}</div>
      </div>
    </div>
    <button
      onClick={() => onToggle(!enabled)}
      className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${
        enabled ? 'bg-copernicus-phosphor' : 'bg-zinc-700'
      }`}
    >
      <div
        className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${
          enabled ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  </div>
)
