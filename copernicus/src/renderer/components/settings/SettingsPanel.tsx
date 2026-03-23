import React, { useState } from 'react'
import { 
  X, Shield, Key, Layout, Cpu, 
  Settings, GitBranch, Workflow, FileText, 
  Terminal, Database, User, Layers, Search, Zap, Puzzle
} from 'lucide-react'

// Import Sections
import { ProvidersSection } from './sections/ProvidersSection'
import { ModelsSection } from './sections/ModelsSection'
import { ContextSection } from './sections/ContextSection'
import { PersonasSection } from './sections/PersonasSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { GitSection } from './sections/GitSection'
import { WorkflowSection } from './sections/WorkflowSection'
import { MCPSection } from './sections/MCPSection'
import { SecuritySection } from './sections/SecuritySection'
import { RagSection } from './sections/RagSection'
import { TemplatesSection } from './sections/TemplatesSection'
import { EnvironmentSection } from './sections/EnvironmentSection'
import { DataSection } from './sections/DataSection'
import { HardwareSection } from './sections/HardwareSection'
import { LocalModelSection } from './sections/LocalModelSection'
import { ExtensionsSection } from './sections/ExtensionsSection'
import { SkillsSection } from './sections/SkillsSection'

type TabId =
  | 'providers'
  | 'models'
  | 'context'
  | 'local-ai'
  | 'personas'
 
  | 'appearance' 
  | 'git' 
  | 'workflow' 
  | 'mcp'
  | 'rag'
  | 'security' 
  | 'templates'
  | 'environment' 
  | 'data'
  | 'hardware'
  | 'extensions'
  | 'skills'

interface SettingsPanelProps {
  onClose: () => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('providers')

  const renderContent = () => {
    switch (activeTab) {
      case 'providers':   return <ProvidersSection />
      case 'models':      return <ModelsSection />
      case 'context':     return <ContextSection />
      case 'local-ai':    return <LocalModelSection />
      case 'personas':    return <PersonasSection />
      case 'appearance':  return <AppearanceSection />
      case 'git':         return <GitSection />
      case 'workflow':    return <WorkflowSection />
      case 'mcp':         return <MCPSection />
      case 'rag':         return <RagSection />
      case 'security':    return <SecuritySection />
      case 'templates':   return <TemplatesSection />
      case 'environment': return <EnvironmentSection />
      case 'data':        return <DataSection />
      case 'hardware':    return <HardwareSection />
      case 'extensions':  return <ExtensionsSection />
      case 'skills':      return <SkillsSection />
      default:            return <ProvidersSection />
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 backdrop-blur-md overflow-y-auto py-4 px-12">
      <div className="bg-[#0A0A0A] border border-zinc-800 w-full max-w-5xl h-[700px] max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/20">
          <div className="flex items-center gap-3 text-copernicus-phosphor">
            <Settings size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">IDE Configuration</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div role="tablist" aria-label="Settings categories" className="w-56 border-r border-zinc-800 bg-black/40 py-6 flex flex-col overflow-y-auto scrollbar-none">
            <div className="px-4 mb-4 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Intelligence</div>
            <TabButton id="providers" label="Providers" icon={<Key size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="models" label="Model Defaults" icon={<Cpu size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="context" label="Context" icon={<Zap size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="local-ai" label="Local AI" icon={<Zap size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="personas" label="Personas" icon={<User size={14} />} active={activeTab} onClick={setActiveTab} />

            <div className="px-4 mt-6 mb-4 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Workspace</div>
            <TabButton id="appearance" label="Appearance" icon={<Layout size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="git" label="Git & GitHub" icon={<GitBranch size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="workflow" label="Workflow" icon={<Workflow size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="mcp" label="MCP" icon={<Layers size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="rag" label="RAG Tuning" icon={<Search size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="templates" label="Templates" icon={<FileText size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="skills" label="Skills" icon={<Zap size={14} />} active={activeTab} onClick={setActiveTab} />

            <div className="px-4 mt-6 mb-4 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">System</div>
            <TabButton id="security" label="Security" icon={<Shield size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="extensions" label="Extensions" icon={<Puzzle size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="environment" label="Environment" icon={<Terminal size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="hardware" label="Hardware" icon={<Cpu size={14} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="data" label="State & Data" icon={<Database size={14} />} active={activeTab} onClick={setActiveTab} />
          </div>

          {/* Content Area */}
          <div
            role="tabpanel"
            id={`settings-panel-${activeTab}`}
            aria-labelledby={`settings-tab-${activeTab}`}
            className="flex-1 overflow-y-auto bg-[#080808]"
          >
            <div className="max-w-3xl mx-auto p-10">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 px-6 border-t border-zinc-800 bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[9px] text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
              SYSTEM_READY
            </div>
            <div className="text-[9px] text-zinc-700 font-mono">v0.1.0-STABLE</div>
          </div>
          <div className="text-[9px] text-zinc-600 italic font-mono">
            Configuration persistent in ~/.copernicus/preferences.json
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({ id, label, icon, active, onClick }: { id: TabId, label: string, icon: any, active: TabId, onClick: any }) {
  const isActive = active === id
  return (
    <button
      role="tab"
      id={`settings-tab-${id}`}
      aria-selected={isActive}
      aria-controls={`settings-panel-${id}`}
      onClick={() => onClick(id)}
      className={`flex items-center gap-3 px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest transition-all rounded-none
        ${isActive
          ? 'text-[#050505] bg-copernicus-phosphor font-bold'
          : 'text-zinc-600 hover:text-zinc-300'}`}
    >
      <span className={isActive ? 'text-[#050505]' : 'text-zinc-600'}>{icon}</span>
      {label}
    </button>
  )
}
