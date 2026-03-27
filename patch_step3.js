const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'copernicus/src/renderer/components/wizard/Wizard.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

let inStep3 = false;
let newLines = [];
let hasInjectedStep4 = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('{/* ── Step 3: New or Existing Project ────────────────────────── */}')) {
    inStep3 = true;

    // Inject our new Step 3 logic
    newLines.push(`              {/* ── Step 3: New or Existing Project ────────────────────────── */}`);
    newLines.push(`              {step === 3 && (`);
    newLines.push(`                <div className="space-y-6 max-w-2xl mx-auto w-full py-4">`);
    newLines.push(`                  <div className="flex flex-col gap-1 mb-2 text-center">`);
    newLines.push(`                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">`);
    newLines.push(`                      <Layout size={28} className="text-copernicus-phosphor" /> Your Project`);
    newLines.push(`                    </h2>`);
    newLines.push(`                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">`);
    newLines.push(`                      {wizardMode === 'new' && step3Substate === 'idea' ? 'Describe your application' :`);
    newLines.push(`                       wizardMode === 'new' && step3Substate === 'stack' ? 'Select your stack' :`);
    newLines.push(`                       'Open an existing repository or start something new'}`);
    newLines.push(`                    </p>`);
    newLines.push(`                  </div>`);

    newLines.push(`                  {step3Substate === 'base' && (`);
    newLines.push(`                    <>`);
    newLines.push(`                      {/* Mode selector */}`);
    newLines.push(`                      <div className="grid grid-cols-2 gap-4">`);
    newLines.push(`                        <button onClick={() => { setWizardMode('existing'); setNewProjectName(''); setError(null); }} className={\`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all \${wizardMode === 'existing' ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white' : 'border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}\`}>`);
    newLines.push(`                          <FolderOpen size={28} className={wizardMode === 'existing' ? 'text-copernicus-phosphor' : ''} />`);
    newLines.push(`                          <div className="text-center">`);
    newLines.push(`                            <p className="text-[11px] font-black uppercase tracking-widest">Existing Project</p>`);
    newLines.push(`                            <p className="text-[9px] mt-1 opacity-60">Open a repository from your workspace</p>`);
    newLines.push(`                          </div>`);
    newLines.push(`                        </button>`);
    newLines.push(`                        <button onClick={() => { setWizardMode('new'); setSelectedProject(''); setError(null); }} className={\`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all \${wizardMode === 'new' ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white' : 'border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}\`}>`);
    newLines.push(`                          <Sparkles size={28} className={wizardMode === 'new' ? 'text-copernicus-phosphor' : ''} />`);
    newLines.push(`                          <div className="text-center">`);
    newLines.push(`                            <p className="text-[11px] font-black uppercase tracking-widest">New Project</p>`);
    newLines.push(`                            <p className="text-[9px] mt-1 opacity-60">Scaffold a repo + generate first sprint</p>`);
    newLines.push(`                          </div>`);
    newLines.push(`                        </button>`);
    newLines.push(`                      </div>`);

    newLines.push(`                      {/* Existing: repo picker */}`);
    newLines.push(`                      {wizardMode === 'existing' && (`);
    newLines.push(`                        <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">`);
    newLines.push(`                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Select Repository</p>`);
    newLines.push(`                          {availableProjects.length > 0 && (`);
    newLines.push(`                            <select className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); if (error) setError(null); }}>`);
    newLines.push(`                              <option value="">— choose from workspace —</option>`);
    newLines.push(`                              {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}`);
    newLines.push(`                            </select>`);
    newLines.push(`                          )}`);
    newLines.push(`                          <button onClick={handleBrowseProject} className="w-full flex items-center justify-center gap-2 py-3 bg-black/40 border border-zinc-700 hover:border-copernicus-phosphor/40 hover:text-white text-zinc-400 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all">`);
    newLines.push(`                            <FolderOpen size={13} /> Browse for Repository`);
    newLines.push(`                          </button>`);
    newLines.push(`                          {selectedProject && (`);
    newLines.push(`                            <div className="flex flex-col gap-2">`);
    newLines.push(`                              <div className="flex items-center gap-2 p-2.5 bg-copernicus-phosphor/5 border border-copernicus-phosphor/20 rounded-lg">`);
    newLines.push(`                                <Check size={12} className="flex-none text-copernicus-phosphor" />`);
    newLines.push(`                                <span className="text-[9px] font-mono text-zinc-300 truncate">{selectedProject.startsWith('/') ? selectedProject : \`\${workspacePath}/\${selectedProject}\`}</span>`);
    newLines.push(`                              </div>`);
    newLines.push(`                              {repoStatus === 'checking' && <div className="flex items-center gap-2 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-zinc-400"><Loader2 size={12} className="animate-spin" /><span className="text-[9px] font-mono uppercase">Checking repo status...</span></div>}`);
    newLines.push(`                              {repoStatus === 'has-git' && <div className="flex items-center gap-2 p-2.5 bg-copernicus-phosphor/10 border border-copernicus-phosphor/30 rounded-lg text-copernicus-phosphor"><Check size={12} /><span className="text-[9px] font-mono uppercase">Git repository found</span></div>}`);
    newLines.push(`                              {repoStatus === 'no-git' && (`);
    newLines.push(`                                <div className="flex flex-col gap-2 p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg">`);
    newLines.push(`                                  <div className="flex items-start gap-2 text-amber-500">`);
    newLines.push(`                                    <Zap size={14} className="flex-none mt-0.5" />`);
    newLines.push(`                                    <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-widest">No git repo found. Initialise one?</p><p className="text-[9px] opacity-70">A git repository is required for COPERNICUS to function.</p></div>`);
    newLines.push(`                                  </div>`);
    newLines.push(`                                  {repoInitError && <div className="mt-2 p-2 bg-red-900/20 border border-red-900/40 rounded text-red-500 text-[9px] font-mono break-words">{repoInitError}</div>}`);
    newLines.push(`                                  <div className="flex gap-2 mt-2">`);
    newLines.push(`                                    <button onClick={handleInitGitRepo} className="flex-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded text-[9px] font-bold uppercase transition-colors">Yes, init & setup</button>`);
    newLines.push(`                                    <button onClick={handleNext} className="flex-1 py-1.5 bg-black/40 hover:bg-black/60 text-zinc-400 border border-zinc-800 hover:border-zinc-700 rounded text-[9px] font-bold uppercase transition-colors">No, continue anyway</button>`);
    newLines.push(`                                  </div>`);
    newLines.push(`                                </div>`);
    newLines.push(`                              )}`);
    newLines.push(`                            </div>`);
    newLines.push(`                          )}`);
    newLines.push(`                        </div>`);
    newLines.push(`                      )}`);

    newLines.push(`                      {/* New: Project Name */} `);
    newLines.push(`                      {wizardMode === 'new' && (`);
    newLines.push(`                        <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">`);
    newLines.push(`                          <div className="space-y-1">`);
    newLines.push(`                            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Project Name</label>`);
    newLines.push(`                            <input type="text" autoFocus className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" placeholder="my-new-project" value={newProjectName} onChange={e => { setNewProjectName(e.target.value); if (error) setError(null); }} />`);
    newLines.push(`                          </div>`);
    newLines.push(`                        </div>`);
    newLines.push(`                      )}`);
    newLines.push(`                    </>`);
    newLines.push(`                  )}`);

    newLines.push(`                  {wizardMode === 'new' && step3Substate === 'idea' && (`);
    newLines.push(`                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">`);
    newLines.push(`                      <div className="space-y-1">`);
    newLines.push(`                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">What are you building? <span className="opacity-50">(optional)</span></label>`);
    newLines.push(`                        <textarea rows={2} className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors resize-none" placeholder="A prop rental platform for the midwest film industry..." value={genesisIdea} onChange={e => setGenesisIdea(e.target.value)} />`);
    newLines.push(`                      </div>`);
    newLines.push(`                      <div className="grid grid-cols-2 gap-3">`);
    newLines.push(`                        <div className="space-y-1">`);
    newLines.push(`                          <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Who is it for?</label>`);
    newLines.push(`                          <input type="text" className="w-full bg-black/60 border border-zinc-800 rounded-lg p-2.5 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" placeholder="Film crews, prop houses..." value={genesisAudience} onChange={e => setGenesisAudience(e.target.value)} />`);
    newLines.push(`                        </div>`);
    newLines.push(`                        <div className="space-y-1">`);
    newLines.push(`                          <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Core value</label>`);
    newLines.push(`                          <input type="text" className="w-full bg-black/60 border border-zinc-800 rounded-lg p-2.5 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" placeholder="Same-day, local inventory..." value={genesisCoreValue} onChange={e => setGenesisCoreValue(e.target.value)} />`);
    newLines.push(`                        </div>`);
    newLines.push(`                      </div>`);
    newLines.push(`                    </div>`);
    newLines.push(`                  )}`);

    newLines.push(`                  {wizardMode === 'new' && step3Substate === 'stack' && (`);
    newLines.push(`                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">`);
    newLines.push(`                      <div className="space-y-1">`);
    newLines.push(`                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Stack template</label>`);
    newLines.push(`                        <select className="w-full bg-black/60 border border-zinc-800 rounded-lg p-2.5 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" value={genesisStack} onChange={e => setGenesisStack(e.target.value)}>`);
    newLines.push(`                          <option value="react-electron">React + Electron (Desktop IDE)</option>`);
    newLines.push(`                          <option value="react-flask">React + Flask (Web App)</option>`);
    newLines.push(`                          <option value="nextjs">Next.js (Full-stack Web)</option>`);
    newLines.push(`                          <option value="react-native">React Native (Mobile)</option>`);
    newLines.push(`                          <option value="python-cli">Python CLI / Scripts</option>`);
    newLines.push(`                          <option value="other">Other / Custom</option>`);
    newLines.push(`                        </select>`);
    newLines.push(`                      </div>`);
    newLines.push(`                    </div>`);
    newLines.push(`                  )}`);

    newLines.push(`                  {error && step === 3 && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mt-4"><p className="text-xs text-red-400">{error}</p></div>}`);
    newLines.push(`                </div>`);
    newLines.push(`              )}`);

    newLines.push(`              {/* ── Step 4: CapEx & Billing ────────────────────────── */}`);
    newLines.push(`              {step === 4 && (`);
    newLines.push(`                <div className="space-y-6 max-w-2xl mx-auto w-full py-4">`);
    newLines.push(`                  <div className="flex flex-col gap-1 mb-2 text-center">`);
    newLines.push(`                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">`);
    newLines.push(`                      <DollarSign size={28} className="text-copernicus-phosphor" /> Capital Expenditure`);
    newLines.push(`                    </h2>`);
    newLines.push(`                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Configure billing for this project</p>`);
    newLines.push(`                  </div>`);
    newLines.push(`                  <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">`);
    newLines.push(`                    <div className="flex items-center justify-between">`);
    newLines.push(`                      <div className="flex items-center gap-2 text-copernicus-phosphor">`);
    newLines.push(`                        <DollarSign size={16} />`);
    newLines.push(`                        <span className="text-[10px] font-black uppercase tracking-widest">Billing</span>`);
    newLines.push(`                      </div>`);
    newLines.push(`                      <div className="flex gap-2">`);
    newLines.push(`                        {(['CAPEX', 'OPEX', 'NONE'] as const).map(mode => (`);
    newLines.push(`                          <button key={mode} onClick={() => setBillingMode(mode)} className={\`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border \${billingMode === mode ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}\`}>{mode}</button>`);
    newLines.push(`                        ))}`);
    newLines.push(`                      </div>`);
    newLines.push(`                    </div>`);
    newLines.push(`                    <div className="flex items-center gap-4">`);
    newLines.push(`                      <span className="text-zinc-700 text-2xl font-extralight">$</span>`);
    newLines.push(`                      <input type="number" className="bg-transparent text-4xl font-black text-white w-28 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:text-copernicus-phosphor transition-colors" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />`);
    newLines.push(`                      <span className="text-zinc-700 text-lg font-mono">/HR</span>`);
    newLines.push(`                    </div>`);
    newLines.push(`                  </div>`);
    newLines.push(`                  {error && step === 4 && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mt-4"><p className="text-xs text-red-400">{error}</p></div>}`);
    newLines.push(`                </div>`);
    newLines.push(`              )}`);

    continue;
  }

  // We are skipping the original Step 3 contents
  if (inStep3) {
    if (line.includes('</motion.div>')) {
      inStep3 = false;
      newLines.push(line);
    }
  } else {
    newLines.push(line);
  }
}

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('Step 3 block refactored and Step 4 added');
