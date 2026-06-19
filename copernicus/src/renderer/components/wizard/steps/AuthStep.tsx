import React, { useState } from 'react';
import { Check, Key, Zap, ArrowRight } from 'lucide-react';
import AuthCliWidget from '../AuthCliWidget';
import { AUTH_CLI_CONFIGS, PROVIDER_METADATA, getProviderIcon } from '../providerRegistry';
import { WizardState } from '../../hooks/useWizardFlow';
import { unwrapIpc, IpcResult } from '../../types/ipc';

interface AuthStepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  invoke: any;
}

export const AuthStep: React.FC<AuthStepProps> = ({ state, updateState, invoke }) => {
  const [editAnthropic, setEditAnthropic] = useState(false);
  const [editGoogle, setEditGoogle] = useState(false);
  const [editGithub, setEditGithub] = useState(false);
  const [editOllama, setEditOllama] = useState(false);
  const [activeAnthropicWidget, setActiveAnthropicWidget] = useState(false);
  const [activeGoogleWidget, setActiveGoogleWidget] = useState(false);
  const [activeGithubWidget, setActiveGithubWidget] = useState(false);
  const [showPatInput, setShowPatInput] = useState(false);
  const [patInput, setPatInput] = useState('');

  const isAnthropicConfigured = state.anthropicMethod === 'cli' || state.anthropicKey === 'saved';
  const isGoogleConfigured = state.googleKey === 'saved' || state.googleKey === 'oauth';
  const isGithubConfigured = state.githubUser !== null;
  const isOllamaConfigured = state.ollamaKey === 'saved';
  const claudeDetected = state.cliStatus?.claude === true;

  const handleGoogleOAuth = async () => {
    try {
      await invoke<{ ok: boolean }>('app:start-oauth-listener');
    } catch (e: unknown) {
      console.error('OAuth start failed:', e);
    }
  };

  const handlePatSubmit = async () => {
    if (!patInput.trim()) return;
    try {
      const storeRes = await invoke<any>('auth:store-api-key', 'github', patInput.trim());
      if (!storeRes.ok) throw new Error(storeRes.error || 'Failed to store API key.');
      const res = await invoke<IpcResult<{ login: string; avatar_url: string }>>('github:test-connection');
      if (!res.ok) throw new Error(res.error || 'GitHub connection test failed');
      const user = unwrapIpc<{ login: string; avatar_url: string }>(res);
      if (user && user.login) {
        updateState({ githubUser: user, githubMethod: 'apikey' });
        setShowPatInput(false);
        setPatInput('');
      }
    } catch (e: unknown) {
      alert('GitHub Connection Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full py-2">
      {(isAnthropicConfigured || isGoogleConfigured) && (
        <div className="flex items-center justify-between p-4 mb-4 bg-zinc-900 border border-copernicus-phosphor/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Check size={18} className="text-copernicus-phosphor" />
            <div>
              <p className="text-xs font-bold text-copernicus-phosphor uppercase tracking-wide">Providers Ready</p>
              <p className="text-[10px] text-zinc-400 font-mono">Your providers are set up. Continue to workspace setup or review below.</p>
            </div>
          </div>
          <button
            onClick={() => updateState({ step: 2 })}
            className="bg-copernicus-phosphor text-black px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 flex items-center gap-2"
          >
            Continue <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1 mb-4 border-l-2 border-copernicus-phosphor pl-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
          <Key size={18} className="text-copernicus-phosphor" /> Intelligence Bus Connectivity
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Provisioning secure access to primary model orchestrators</p>
      </div>

      <div className="space-y-4">
        {/* Anthropic / Claude */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('anthropic'), { size: 12 })}
              {PROVIDER_METADATA['anthropic']?.displayName || 'Anthropic'}
            </span>
            {isAnthropicConfigured && !editAnthropic ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY · {state.anthropicMethod === 'cli' ? 'CLI' : 'API KEY'}</span>
                <button onClick={() => { setEditAnthropic(true); setActiveAnthropicWidget(false); }} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
              </div>
            ) : state.anthropicMethod && (
              <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor font-bold uppercase"><Check size={11} /> Selected</span>
            )}
          </div>

          {(!isAnthropicConfigured || editAnthropic) && (
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => { updateState({ anthropicMethod: 'cli' }); setActiveAnthropicWidget(true); }}
                disabled={!claudeDetected}
                className={`w-full text-left p-3 rounded border transition-all ${state.anthropicMethod === 'cli' ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black' : 'border-zinc-800 hover:border-zinc-700 opacity-60'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-2"><Zap size={12} /> Use Claude Code (CLI)</span>
                  {claudeDetected ? <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 rounded">DETECTED</span> : <span className="text-[9px] text-zinc-600">NOT FOUND</span>}
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">Leverages existing <code className="text-zinc-400">claude login</code> credentials.</p>
              </button>

              {state.anthropicMethod === 'cli' && activeAnthropicWidget && AUTH_CLI_CONFIGS['anthropic'] ? (
                <AuthCliWidget
                  config={AUTH_CLI_CONFIGS['anthropic']}
                  onComplete={() => { updateState({ anthropicMethod: 'cli', anthropicKey: 'saved' }); setEditAnthropic(false); setActiveAnthropicWidget(false); }}
                  onCancel={() => { updateState({ anthropicMethod: null }); setActiveAnthropicWidget(false); }}
                />
              ) : (
                <div className={`p-3 rounded border transition-all ${state.anthropicMethod === 'apikey' ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black' : 'border-zinc-800 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-2"><Key size={12} /> Direct API Access</span>
                    <button onClick={() => invoke('app:open-external', 'https://console.anthropic.com/')} className="text-[9px] text-zinc-500 hover:text-white underline">Manage Keys</button>
                  </div>
                  <input
                    type="password"
                    className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                    placeholder={state.anthropicKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'sk-ant-api03-...'}
                    value={state.anthropicKey === 'saved' ? '' : state.anthropicKey}
                    onChange={(e) => { updateState({ anthropicKey: e.target.value, anthropicMethod: 'apikey' }); }}
                    onFocus={() => { if (state.anthropicMethod !== 'apikey') updateState({ anthropicMethod: 'apikey' }) }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* GitHub Connection */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('github'), { size: 12 })}
              {PROVIDER_METADATA['github']?.displayName || 'GitHub'}
            </span>
            {isGithubConfigured && !editGithub ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY · {state.githubMethod === 'cli' ? 'CLI' : 'API KEY'}</span>
                <button onClick={() => { setEditGithub(true); setActiveGithubWidget(false); }} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
              </div>
            ) : state.githubUser && (
              <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor font-bold uppercase"><Check size={11} /> {state.githubUser.login}</span>
            )}
          </div>

          {(!isGithubConfigured || editGithub) && (
            <>
              {!showPatInput && (
                <button
                  onClick={() => { updateState({ githubMethod: 'cli' }); setActiveGithubWidget(true); }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all mb-2"
                >
                  Use CLI
                </button>
              )}
              {state.githubMethod === 'cli' && activeGithubWidget && AUTH_CLI_CONFIGS['github'] && (
                <AuthCliWidget
                  config={AUTH_CLI_CONFIGS['github']}
                  onComplete={() => {
                    invoke<IpcResult<{ login: string; avatar_url: string }>>('github:test-connection').then(res => {
                      if (!res.ok) return;
                      const user = unwrapIpc<{ login: string; avatar_url: string }>(res);
                      if (user && user.login) {
                        updateState({ githubUser: user, githubMethod: 'cli' });
                        setEditGithub(false);
                        setActiveGithubWidget(false);
                        setPatInput('');
                      }
                    }).catch(() => {});
                  }}
                  onCancel={() => { updateState({ githubMethod: null }); setActiveGithubWidget(false); }}
                />
              )}
              {!activeGithubWidget && (
                <button
                  onClick={() => setShowPatInput(true)}
                  className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all"
                >
                  {state.githubUser ? 'Swap GitHub Identity' : 'Connect via PAT'}
                </button>
              )}
              {showPatInput && (
                <div className="mt-2 space-y-2">
                  <input
                    type="password"
                    autoFocus
                    className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                    placeholder="ghp_..."
                    value={patInput}
                    onChange={e => setPatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePatSubmit()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handlePatSubmit}
                      className="flex-1 py-1.5 bg-copernicus-phosphor text-black border border-copernicus-phosphor/30 rounded text-[11px] font-bold uppercase"
                    >Connect</button>
                    <button
                      onClick={() => { setShowPatInput(false); setPatInput(''); }}
                      className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-[11px] uppercase"
                    >Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Local Ollama */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('ollama'), { size: 12 })}
              {PROVIDER_METADATA['ollama']?.displayName || 'Local Inference (Ollama)'}
            </span>
            {state.localOllamaKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
          </div>
          <input
            type="text"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.localOllamaKey === 'saved' ? 'http://localhost:11434' : 'http://localhost:11434'}
            value={state.localOllamaKey === 'saved' ? '' : state.localOllamaKey}
            onChange={(e) => updateState({ localOllamaKey: e.target.value })}
          />
        </div>

        {/* Ollama Cloud */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('ollama-cloud'), { size: 12 })}
              {PROVIDER_METADATA['ollama-cloud']?.displayName || 'High-Intelligence Tier (Ollama Cloud)'}
            </span>
            {isOllamaConfigured && !editOllama ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY</span>
                <button onClick={() => setEditOllama(true)} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
              </div>
            ) : state.ollamaKey === 'saved' && (
              <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">AUTHENTICATED</span>
            )}
          </div>

          {(!isOllamaConfigured || editOllama) && (
            <input
              type="password"
              className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
              placeholder={state.ollamaKey === 'saved' ? 'CLOUD TOKEN SECURED' : 'Ollama Bearer Token'}
              value={state.ollamaKey === 'saved' ? '' : state.ollamaKey}
              onChange={(e) => updateState({ ollamaKey: e.target.value })}
            />
          )}
        </div>

        {/* Google / Gemini */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('google'), { size: 12 })}
              {PROVIDER_METADATA['google']?.displayName || 'Google / Gemini'}
            </span>
            {isGoogleConfigured && !editGoogle ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY · {state.googleMethod === 'cli' ? 'CLI' : 'API KEY'}</span>
                <button onClick={() => { setEditGoogle(true); setActiveGoogleWidget(false); }} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
              </div>
            ) : (state.googleKey === 'saved' || state.googleKey === 'oauth') ? (
              <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">SESSION ACTIVE</span>
            ) : (
              <button onClick={handleGoogleOAuth} className="text-[10px] text-copernicus-phosphor font-bold uppercase hover:underline">Start OAuth Flow</button>
            )}
          </div>

          {(!isGoogleConfigured || editGoogle) && (
            <>
              {state.googleKey === 'cli' && activeGoogleWidget && AUTH_CLI_CONFIGS['google'] ? (
                <AuthCliWidget
                  config={AUTH_CLI_CONFIGS['google']}
                  onComplete={() => { updateState({ googleKey: 'saved', googleMethod: 'cli' }); setEditGoogle(false); setActiveGoogleWidget(false); }}
                  onCancel={() => { updateState({ googleKey: '' }); setActiveGoogleWidget(false); }}
                />
              ) : (
                <>
                  <button
                    onClick={() => { updateState({ googleKey: 'cli' }); setActiveGoogleWidget(true); }}
                    className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all mb-2"
                  >
                    Use CLI
                  </button>
                  <input
                    type="password"
                    className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                    placeholder={state.googleKey === 'saved' || state.googleKey === 'oauth' ? 'OAUTH CREDENTIALS ACTIVE' : 'API Key Override (Optional)'}
                    value={state.googleKey === 'saved' || state.googleKey === 'oauth' ? '' : state.googleKey}
                    onChange={(e) => { updateState({ googleKey: e.target.value, googleMethod: 'apikey' }); }}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Google Jules */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('jules'), { size: 12 })}
              {PROVIDER_METADATA['jules']?.displayName || 'Google Jules'}
              <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 rounded">Same CLI as Gemini</span>
            </span>
            {state.julesKey === 'saved' ? <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span> : (state.googleKey === 'saved' || state.googleKey === 'oauth' || state.googleKey === 'cli') ? <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">SAME ACCOUNT AS GEMINI — INHERITED</span> : null}
          </div>
          <input
            type="password"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.julesKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : ((state.googleKey === 'saved' || state.googleKey === 'oauth' || state.googleKey === 'cli') ? 'INHERITED FROM GEMINI' : 'Jules API Key')}
            value={state.julesKey === 'saved' ? '' : (state.julesKey === 'inherited' ? '' : state.julesKey)}
            onChange={(e) => updateState({ julesKey: e.target.value })}
            disabled={state.googleKey === 'saved' || state.googleKey === 'oauth' || state.googleKey === 'cli'}
          />
        </div>

        {/* Google Stitch */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('stitch'), { size: 12 })}
              {PROVIDER_METADATA['stitch']?.displayName || 'Google Stitch'}
              <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 rounded">Same CLI as Gemini</span>
            </span>
            {state.stitchKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
          </div>
          <input
            type="password"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.stitchKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'Stitch API Key'}
            value={state.stitchKey === 'saved' ? '' : state.stitchKey}
            onChange={(e) => updateState({ stitchKey: e.target.value })}
          />
        </div>

        {/* OpenAI */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('openai'), { size: 12 })}
              {PROVIDER_METADATA['openai']?.displayName || 'OpenAI'}
            </span>
            {state.openaiKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
          </div>
          <input
            type="password"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.openaiKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'sk-proj-...'}
            value={state.openaiKey === 'saved' ? '' : state.openaiKey}
            onChange={(e) => updateState({ openaiKey: e.target.value })}
          />
        </div>

        {/* OpenRouter */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('openrouter'), { size: 12 })}
              {PROVIDER_METADATA['openrouter']?.displayName || 'OpenRouter'}
            </span>
            {state.openrouterKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
          </div>
          <input
            type="password"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.openrouterKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'sk-or-v1-...'}
            value={state.openrouterKey === 'saved' ? '' : state.openrouterKey}
            onChange={(e) => updateState({ openrouterKey: e.target.value })}
          />
        </div>

        {/* DeepInfra */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('deepinfra'), { size: 12 })}
              {PROVIDER_METADATA['deepinfra']?.displayName || 'DeepInfra'}
            </span>
            {state.deepinfraKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
          </div>
          <input
            type="password"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.deepinfraKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'DeepInfra API Key'}
            value={state.deepinfraKey === 'saved' ? '' : state.deepinfraKey}
            onChange={(e) => updateState({ deepinfraKey: e.target.value })}
          />
        </div>

        {/* Tavily */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('tavily'), { size: 12 })}
              {PROVIDER_METADATA['tavily']?.displayName || 'Tavily'}
            </span>
            {state.tavilyKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
          </div>
          <input
            type="password"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.tavilyKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'tvly-...'}
            value={state.tavilyKey === 'saved' ? '' : state.tavilyKey}
            onChange={(e) => updateState({ tavilyKey: e.target.value })}
          />
        </div>

        {/* Context7 */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              {React.createElement(getProviderIcon('context7'), { size: 12 })}
              {PROVIDER_METADATA['context7']?.displayName || 'Context7'}
            </span>
            {state.context7Key === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
          </div>
          <input
            type="password"
            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
            placeholder={state.context7Key === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'Context7 API Key'}
            value={state.context7Key === 'saved' ? '' : state.context7Key}
            onChange={(e) => updateState({ context7Key: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-8 text-center opacity-50 text-[10px] text-zinc-500">
        BitNet embedded agent: active by default
      </div>
    </div>
  );
};
