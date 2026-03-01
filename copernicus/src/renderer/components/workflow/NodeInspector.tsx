import { useState, useEffect } from 'react';
import { WFNode } from '../../../../electron/workflow/types';
import log from '../../utils/logger'

const PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter', 'deepinfra', 'ollama'] as const;

interface NodeInspectorProps {
  node: WFNode;
  authStatus: Record<string, boolean>;
  availableModels: { id: string; name: string; provider: string }[];
  onChange: (node: WFNode) => void;
  onClose: () => void;
  onDelete: () => void;
  invoke: <T>(channel: string, ...args: any[]) => Promise<T>;
}

export function NodeInspector({ node, authStatus, availableModels, onChange, onClose, onDelete, invoke }: NodeInspectorProps) {
  const [localModels, setLocalModels] = useState<{id:string;name:string}[]>([]);
  const [stories, setStories] = useState<any[]>([]);

  useEffect(() => {
    invoke<any[]>('stories:list').then(res => {
      const data = (res as any).data || res;
      if (Array.isArray(data)) setStories(data);
    }).catch(log.error);
  }, [invoke]);

  const updateData = (patch: Record<string, any>) =>
    onChange({ ...node, data: { ...node.data, ...patch } } as WFNode);

  const handleProviderChange = async (provider: string) => {
    updateData({ provider, modelId: '' });
    if (provider === 'ollama') {
      const result = await invoke<{ ok: boolean; models: any[] }>('models:list-ollama');
      if (result.ok) setLocalModels(result.models);
    }
  };

  const handleStoryChange = async (storyId: string) => {
    updateData({ storyId });
    await invoke('workflow:update-node-data', { nodeId: node.id, field: 'boundToStoryId', value: storyId });
  };

  const modelsForProvider = node.data.variant === 'agent' && node.data.provider === 'ollama'
    ? localModels
    : availableModels.filter(m => node.data.variant === 'agent' && m.provider === node.data.provider);

  return (
    <div className="w-72 bg-zinc-950 border-l border-copernicus-steel overflow-y-auto shrink-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-copernicus-steel">
        <span className="text-[9px] uppercase tracking-widest text-zinc-500">
          {node.type.toUpperCase()} CONFIG
        </span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* Label — all types */}
        <Field label="Label">
          <input
            className="inspector-input"
            value={node.label}
            onChange={e => onChange({ ...node, label: e.target.value })}
          />
        </Field>

        {node.type === 'agent' && <AgentFields data={node.data} modelsForProvider={modelsForProvider} authStatus={authStatus} onUpdate={updateData} onProviderChange={handleProviderChange} />}
        {node.type === 'tool' && <ToolFields data={node.data} onUpdate={updateData} />}
        {node.type === 'trigger' && <TriggerFields data={node.data} stories={stories} onUpdate={updateData} onStoryChange={handleStoryChange} />}
        {node.type === 'decision' && <DecisionFields data={node.data} onUpdate={updateData} />}
        {node.type === 'flow' && <FlowFields data={node.data} onUpdate={updateData} />}
      </div>

      {/* Delete */}
      <div className="mt-auto p-3 border-t border-copernicus-steel">
        <button
          onClick={onDelete}
          className="w-full py-1.5 rounded text-[10px] font-mono uppercase tracking-wider
                     bg-red-950/40 text-red-500 border border-red-900/40
                     hover:bg-red-900/40 transition-colors"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[8px] uppercase tracking-widest text-zinc-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function AgentFields({ data, modelsForProvider, authStatus, onUpdate, onProviderChange }: any) {
  return (
    <>
      <Field label="Persona Label">
        <input className="inspector-input" value={data.persona ?? ''} onChange={e => onUpdate({ persona: e.target.value })} />
      </Field>
      <Field label="Provider">
        <select className="inspector-input" value={data.provider ?? ''} onChange={e => onProviderChange(e.target.value)}>
          <option value="">— select —</option>
          {PROVIDERS.map(p => (
            <option key={p} value={p} disabled={p !== 'ollama' && !authStatus[p]}>
              {p !== 'ollama' && !authStatus[p] ? `🔒 ${p}` : p}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Model">
        {modelsForProvider.length > 0 ? (
          <select className="inspector-input" value={data.modelId ?? ''} onChange={e => onUpdate({ modelId: e.target.value })}>
            <option value="">— select —</option>
            {modelsForProvider.map((m: any) => (
              <option key={m.id} value={m.id}>{m.name ?? m.id}</option>
            ))}
          </select>
        ) : data.provider === 'ollama' ? (
          <p className="text-[9px] text-red-400">Ollama not running — start with: ollama serve</p>
        ) : null}
        <input
          className="inspector-input mt-1"
          placeholder="Custom model ID"
          value={data.modelId ?? ''}
          onChange={e => onUpdate({ modelId: e.target.value })}
        />
      </Field>
      <Field label="System Prompt">
        <textarea className="inspector-input h-20 resize-none" value={data.systemPrompt ?? ''} onChange={e => onUpdate({ systemPrompt: e.target.value })} />
      </Field>
      <Field label="Task">
        <textarea className="inspector-input h-20 resize-none" value={data.task ?? ''} onChange={e => onUpdate({ task: e.target.value })} />
        <p className="text-[8px] text-zinc-600 mt-0.5">Use {'{{storyId}}'}, {'{{storyTitle}}'}, {'{{prevOutput}}'}</p>
      </Field>
      <Field label="Output Channel">
        <select className="inspector-input" value={data.outputChannel ?? 'terminal'} onChange={e => onUpdate({ outputChannel: e.target.value })}>
          {['terminal','chat','file','context'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      {data.outputChannel === 'file' && (
        <Field label="Output File">
          <input className="inspector-input" value={data.outputFile ?? ''} onChange={e => onUpdate({ outputFile: e.target.value })} />
        </Field>
      )}
      <Field label="Temperature">
        <input type="number" className="inspector-input" min={0} max={1} step={0.1} value={data.temperature ?? 0.7} onChange={e => onUpdate({ temperature: parseFloat(e.target.value) })} />
      </Field>
      <Field label="Max Tokens">
        <input type="number" className="inspector-input" value={data.maxTokens ?? 2048} onChange={e => onUpdate({ maxTokens: parseInt(e.target.value) })} />
      </Field>
    </>
  );
}

function ToolFields({ data, onUpdate }: any) {
  return (
    <>
      <Field label="Variant">
        <select className="inspector-input" value={data.variant} onChange={e => onUpdate({ variant: e.target.value })}>
          {['shell-command', 'makefile-run', 'file-read', 'file-write', 'story-update', 'log-event', 'send-chat', 'notify'].map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
      {(data.variant === 'shell-command' || data.variant === 'makefile-run') && (
        <Field label="Command">
          <input className="inspector-input" value={data.command ?? ''} onChange={e => onUpdate({ command: e.target.value })} />
        </Field>
      )}
      {(data.variant === 'file-read' || data.variant === 'file-write') && (
        <Field label="File Path">
          <input className="inspector-input" value={data.filePath ?? ''} onChange={e => onUpdate({ filePath: e.target.value })} />
        </Field>
      )}
      {data.variant === 'file-write' && (
        <Field label="Content">
          <textarea className="inspector-input h-20 resize-none" value={data.content ?? ''} onChange={e => onUpdate({ content: e.target.value })} />
        </Field>
      )}
      {data.variant === 'story-update' && (
        <>
          <Field label="Story ID">
            <input className="inspector-input" value={data.storyId ?? ''} placeholder="{{storyId}}" onChange={e => onUpdate({ storyId: e.target.value })} />
          </Field>
          <Field label="Field">
            <input className="inspector-input" value={data.field ?? ''} onChange={e => onUpdate({ field: e.target.value })} />
          </Field>
          <Field label="Value">
            <input className="inspector-input" value={data.value ?? ''} onChange={e => onUpdate({ value: e.target.value })} />
          </Field>
        </>
      )}
      {(data.variant === 'log-event' || data.variant === 'send-chat' || data.variant === 'notify') && (
        <Field label="Message">
          <textarea className="inspector-input h-20 resize-none" value={data.message ?? ''} onChange={e => onUpdate({ message: e.target.value })} />
        </Field>
      )}
    </>
  );
}

function TriggerFields({ data, stories, onUpdate, onStoryChange }: any) {
  return (
    <>
      <Field label="Variant">
        <select className="inspector-input" value={data.variant} onChange={e => onUpdate({ variant: e.target.value })}>
          {['manual', 'story-activated', 'story-status-change', 'terminal-exit'].map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
      {data.variant === 'story-activated' && (
        <Field label="Bound to Story">
          <select 
            className="inspector-input" 
            value={data.storyId ?? ''} 
            onChange={e => onStoryChange(e.target.value)}
          >
            <option value="">— select story —</option>
            {stories.map((s: any) => (
              <option key={s.id} value={s.id}>{s.id}: {s.title}</option>
            ))}
          </select>
        </Field>
      )}
      {data.variant === 'story-status-change' && (
        <>
          <Field label="Story ID">
            <select 
              className="inspector-input" 
              value={data.storyId ?? ''} 
              onChange={e => onStoryChange(e.target.value)}
            >
              <option value="">— select story —</option>
              {stories.map((s: any) => (
                <option key={s.id} value={s.id}>{s.id}: {s.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Expected Status">
            <input className="inspector-input" value={data.expectedStatus ?? ''} onChange={e => onUpdate({ expectedStatus: e.target.value })} />
          </Field>
        </>
      )}
      {data.variant === 'terminal-exit' && (
        <Field label="Terminal ID">
          <input className="inspector-input" value={data.terminalId ?? ''} onChange={e => onUpdate({ terminalId: e.target.value })} />
        </Field>
      )}
    </>
  );
}

function DecisionFields({ data, onUpdate }: any) {
  return (
    <>
      <Field label="Variant">
        <select className="inspector-input" value={data.variant} onChange={e => onUpdate({ variant: e.target.value })}>
          {['exit-code-gate', 'output-match', 'human-approval', 'story-status-check'].map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
      {data.variant === 'output-match' && (
        <Field label="Regex Pattern">
          <input className="inspector-input" value={data.pattern ?? ''} onChange={e => onUpdate({ pattern: e.target.value })} />
        </Field>
      )}
      {data.variant === 'story-status-check' && (
        <>
          <Field label="Story ID">
            <input className="inspector-input" value={data.storyId ?? ''} placeholder="{{storyId}}" onChange={e => onUpdate({ storyId: e.target.value })} />
          </Field>
          <Field label="Expected Status">
            <input className="inspector-input" value={data.expectedStatus ?? ''} onChange={e => onUpdate({ expectedStatus: e.target.value })} />
          </Field>
        </>
      )}
    </>
  );
}

function FlowFields({ data, onUpdate }: any) {
  return (
    <>
      <Field label="Delay (ms)">
        <input type="number" className="inspector-input" value={data.durationMs ?? 2000} onChange={e => onUpdate({ durationMs: parseInt(e.target.value) })} />
      </Field>
    </>
  );
}
