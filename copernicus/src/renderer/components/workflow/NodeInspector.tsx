import { useState, useEffect } from 'react';
import { WFNode } from '../../../../electron/workflow/types';
import log from '../../utils/logger'
import { unwrapIpc } from '../../types/ipc';
import { ScheduleInput } from './ScheduleInput';

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

  const resumeNode = async () => {
    try {
      const res = await invoke<any>('workflow:resume-node', node.id);
      if (!res.ok) log.error('Failed to resume node:', res.error);
    } catch (err) {
      log.error('Failed to resume node:', err);
    }
  };

  return (
    <div className="w-72 bg-zinc-950 border-l border-copernicus-steel overflow-y-auto shrink-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-copernicus-steel">
        <span className="text-[9px] uppercase tracking-widest text-zinc-500">
          {node.type.toUpperCase()} CONFIG
        </span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
      </div>

      {node.status === 'paused' && (
        <div className="p-3 bg-red-900/20 border-b border-red-900/40">
          <p className="text-xs text-red-500 mb-2 font-bold uppercase tracking-wider">Verification Failed</p>
          <p className="text-[10px] text-red-400 mb-3 font-mono break-words whitespace-pre-wrap">{(node as any).error}</p>
          <button
            onClick={resumeNode}
            className="w-full py-1.5 rounded text-[10px] font-mono uppercase tracking-wider
                       bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/30
                       hover:bg-copernicus-phosphor/40 transition-colors"
          >
            Re-check & Resume
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 p-3">
        {/* Label — all types */}
        <Field label="Label">
          <DebouncedInput
            autoFocus
            className="inspector-input"
            initialValue={node.label}
            onCommit={(val: string) => onChange({ ...node, label: val })}
          />
        </Field>

        {node.type === 'agent' && <AgentFields node={node} modelsForProvider={modelsForProvider} authStatus={authStatus} onUpdate={updateData} onProviderChange={handleProviderChange} />}
        {node.type === 'tool' && <ToolFields node={node} onUpdate={updateData} />}
        {node.type === 'trigger' && <TriggerFields node={node} stories={stories} onUpdate={updateData} onStoryChange={handleStoryChange} />}
        {node.type === 'decision' && <DecisionFields node={node} onUpdate={updateData} />}
        {node.type === 'flow' && <FlowFields node={node} onUpdate={updateData} />}
        {node.type === 'verification' && <VerificationFields node={node} onUpdate={updateData} />}
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

// ── Components ─────────────────────────────────────────────────────────────

function ChecklistCheckbox({ nodeId, index, onUpdate, invoke }: { nodeId: string, index: number, onUpdate: () => void, invoke: any }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    invoke('workflow:get-context', `__check_${nodeId}_${index}`).then((res: any) => {
      if (res.ok) {
        const val = unwrapIpc<string>(res);
        setChecked(val === 'true');
      }
    }).catch(log.error);
  }, [invoke, nodeId, index]);

  return (
    <input
      type="checkbox"
      className="rounded border-zinc-700 bg-zinc-900 text-copernicus-phosphor focus:ring-0"
      checked={checked}
      onChange={async (e) => {
        const isChecked = e.target.checked;
        setChecked(isChecked);
        await invoke('workflow:set-context', `__check_${nodeId}_${index}`, isChecked ? 'true' : 'false');
        onUpdate();
      }}
    />
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

function DebouncedInput({ initialValue, onCommit, className, placeholder, type = 'text', min, max, step }: any) {
  const [val, setVal] = useState(initialValue);
  
  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <input
      type={type}
      min={min}
      max={max}
      step={step}
      className={className}
      placeholder={placeholder}
      value={val ?? ''}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== initialValue) onCommit(type === 'number' ? parseFloat(val) : val); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

function DebouncedTextarea({ initialValue, onCommit, className, placeholder, rows = 3 }: any) {
  const [val, setVal] = useState(initialValue);
  
  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <textarea
      rows={rows}
      className={className}
      placeholder={placeholder}
      value={val ?? ''}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== initialValue) onCommit(val); }}
    />
  );
}

function AgentFields({ node, modelsForProvider, authStatus, onUpdate, onProviderChange }: any) {
  const data = node.data;
  return (
    <>
      <Field label="Persona Label">
        <DebouncedInput className="inspector-input" initialValue={data.persona} onCommit={(v: string) => onUpdate({ persona: v })} />
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
        <DebouncedInput
          className="inspector-input mt-1"
          placeholder="Custom model ID"
          initialValue={data.modelId}
          onCommit={(v: string) => onUpdate({ modelId: v })}
        />
      </Field>
      <Field label="System Prompt">
        <DebouncedTextarea className="inspector-input h-20 resize-none" initialValue={data.systemPrompt} onCommit={(v: string) => onUpdate({ systemPrompt: v })} />
      </Field>
      <Field label="Task">
        <DebouncedTextarea className="inspector-input h-20 resize-none" initialValue={data.task} onCommit={(v: string) => onUpdate({ task: v })} />
        <p className="text-[8px] text-zinc-600 mt-0.5">Use {'{{storyId}}'}, {'{{storyTitle}}'}, {'{{prevOutput}}'}</p>
      </Field>
      <Field label="Output Channel">
        <select className="inspector-input" value={data.outputChannel ?? 'terminal'} onChange={e => onUpdate({ outputChannel: e.target.value })}>
          {['terminal','chat','file','context'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      {data.outputChannel === 'file' && (
        <Field label="Output File">
          <DebouncedInput className="inspector-input" initialValue={data.outputFile} onCommit={(v: string) => onUpdate({ outputFile: v })} />
        </Field>
      )}
      <Field label="Temperature">
        <DebouncedInput type="number" className="inspector-input" min={0} max={1} step={0.1} initialValue={data.temperature ?? 0.7} onCommit={(v: number) => onUpdate({ temperature: v })} />
      </Field>
      <Field label="Max Tokens">
        <DebouncedInput type="number" className="inspector-input" initialValue={data.maxTokens ?? 2048} onCommit={(v: number) => onUpdate({ maxTokens: v })} />
      </Field>
      <div className="space-y-2 pt-3 border-t border-zinc-800/50 mt-3">
        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Worktree</p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={data.useWorktree ?? false}
            onChange={e => onUpdate({ useWorktree: e.target.checked })}
            className="accent-copernicus-phosphor w-3 h-3"
          />
          <span className="text-[10px] font-mono text-zinc-400">Isolated git worktree</span>
        </label>
        {data.useWorktree && (
          <select
            className="inspector-input"
            value={data.mergeMode ?? 'gated'}
            onChange={e => onUpdate({ mergeMode: e.target.value as 'gated' | 'yolo' })}
          >
            <option value="gated">Gated — human review</option>
            <option value="yolo">Yolo — auto-merge</option>
          </select>
        )}
      </div>
    </>
  );
}

function VerificationFields({ node, onUpdate, invoke }: any) {
  const data = node.data;
  const checklist: string[] = data.checklist ?? [];

  return (
    <>
      <Field label="Variant">
        <select className="inspector-input" value={data.variant} onChange={e => onUpdate({ variant: e.target.value })}>
          <option value="verification">verification</option>
        </select>
      </Field>
      <Field label="Checklist Items">
        <div className="flex flex-col gap-2">
          {checklist.map((item, i) => (
            <div key={i} className="flex flex-col gap-1 border border-zinc-800 p-2 rounded">
              <div className="flex items-center gap-2">
                <DebouncedInput
                  className="inspector-input flex-1"
                  initialValue={item}
                  onCommit={(v: string) => {
                    const copy = [...checklist];
                    copy[i] = v;
                    onUpdate({ checklist: copy });
                  }}
                />
                <button
                  onClick={() => {
                    const copy = [...checklist];
                    copy.splice(i, 1);
                    onUpdate({ checklist: copy });
                  }}
                  className="text-zinc-500 hover:text-red-400 font-mono text-xs px-1"
                >
                  ✕
                </button>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1 cursor-pointer">
                <ChecklistCheckbox nodeId={node.id} index={i} onUpdate={() => onUpdate({ checklist: [...checklist] })} invoke={invoke} />
                Completed
              </label>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ checklist: [...checklist, ''] })}
            className="text-left text-[10px] text-zinc-500 hover:text-copernicus-phosphor mt-1"
          >
            + Add item
          </button>
        </div>
      </Field>
    </>
  );
}

function ToolFields({ node, onUpdate }: any) {
  const data = node.data;
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
          <DebouncedInput className="inspector-input" initialValue={data.command} onCommit={(v: string) => onUpdate({ command: v })} />
        </Field>
      )}
      {(data.variant === 'file-read' || data.variant === 'file-write') && (
        <Field label="File Path">
          <DebouncedInput className="inspector-input" initialValue={data.filePath} onCommit={(v: string) => onUpdate({ filePath: v })} />
        </Field>
      )}
      {data.variant === 'file-write' && (
        <Field label="Content">
          <DebouncedTextarea className="inspector-input h-20 resize-none" initialValue={data.content} onCommit={(v: string) => onUpdate({ content: v })} />
        </Field>
      )}
      {data.variant === 'story-update' && (
        <>
          <Field label="Story ID">
            <DebouncedInput className="inspector-input" initialValue={data.storyId} placeholder="{{storyId}}" onCommit={(v: string) => onUpdate({ storyId: v })} />
          </Field>
          <Field label="Field">
            <DebouncedInput className="inspector-input" initialValue={data.field} onCommit={(v: string) => onUpdate({ field: v })} />
          </Field>
          <Field label="Value">
            <DebouncedInput className="inspector-input" initialValue={data.value} onCommit={(v: string) => onUpdate({ value: v })} />
          </Field>
        </>
      )}
      {(data.variant === 'log-event' || data.variant === 'send-chat' || data.variant === 'notify') && (
        <Field label="Message">
          <DebouncedTextarea className="inspector-input h-20 resize-none" initialValue={data.message} onCommit={(v: string) => onUpdate({ message: v })} />
        </Field>
      )}
    </>
  );
}

function TriggerFields({ node, stories, onUpdate, onStoryChange }: any) {
  const data = node.data;
  return (
    <>
      <Field label="Variant">
        <select className="inspector-input" value={data.variant} onChange={e => onUpdate({ variant: e.target.value })}>
          {['manual', 'story-activated', 'story-status-change', 'terminal-exit', 'cron'].map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
      {data.variant === 'cron' && (
        <ScheduleInput
          value={data.scheduleNl ?? ''}
          onChange={(nl, cron) => onUpdate({ scheduleNl: nl, scheduleCron: cron })}
        />
      )}
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
            <DebouncedInput className="inspector-input" initialValue={data.expectedStatus} onCommit={(v: string) => onUpdate({ expectedStatus: v })} />
          </Field>
        </>
      )}
      {data.variant === 'terminal-exit' && (
        <Field label="Terminal ID">
          <DebouncedInput className="inspector-input" initialValue={data.terminalId} onCommit={(v: string) => onUpdate({ terminalId: v })} />
        </Field>
      )}
    </>
  );
}

function DecisionFields({ node, onUpdate }: any) {
  const data = node.data;
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
          <DebouncedInput className="inspector-input" initialValue={data.pattern} onCommit={(v: string) => onUpdate({ pattern: v })} />
        </Field>
      )}
      {data.variant === 'story-status-check' && (
        <>
          <Field label="Story ID">
            <DebouncedInput className="inspector-input" initialValue={data.storyId} placeholder="{{storyId}}" onCommit={(v: string) => onUpdate({ storyId: v })} />
          </Field>
          <Field label="Expected Status">
            <DebouncedInput className="inspector-input" initialValue={data.expectedStatus} onCommit={(v: string) => onUpdate({ expectedStatus: v })} />
          </Field>
        </>
      )}
    </>
  );
}

function FlowFields({ node, onUpdate }: any) {
  const data = node.data;
  return (
    <>
      <Field label="Delay (ms)">
        <DebouncedInput type="number" className="inspector-input" initialValue={data.durationMs ?? 2000} onCommit={(v: number) => onUpdate({ durationMs: v })} />
      </Field>
    </>
  );
}
