const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'copernicus/src/renderer/components/wizard/Wizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldDisabled = "disabled={genesisLoading || (step === 3 && wizardMode === 'existing' && (!selectedProject || repoStatus === 'no-git')) || (step === 3 && wizardMode === 'new' && !newProjectName.trim()) || (step === 2 && !workspacePath)}";

const newDisabled = "disabled={genesisLoading || (step === 3 && wizardMode === 'existing' && (!selectedProject || repoStatus === 'no-git')) || (step === 3 && wizardMode === 'new' && step3Substate === 'base' && !newProjectName.trim()) || (step === 2 && !workspacePath)}";

content = content.replace(oldDisabled, newDisabled);

const oldFooterContent = `{genesisLoading
              ? <><Loader2 size={14} className="animate-spin" /> Scaffolding...</>
              : step === 3 && wizardMode === 'new'
                ? <>Generate &amp; Launch <Sparkles size={16} className="group-hover:scale-110 transition-transform" /></>
                : step === 3
                  ? <>Launch COPERNICUS <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                  : step === 2
                    ? <>Next: Project <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    : <>Advance <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
            }`;

const newFooterContent = `{genesisLoading
              ? <><Loader2 size={14} className="animate-spin" /> Scaffolding...</>
              : step === 4
                ? <>Launch COPERNICUS <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                : step === 3 && wizardMode === 'new' && step3Substate === 'stack'
                  ? <>Generate &amp; Launch <Sparkles size={16} className="group-hover:scale-110 transition-transform" /></>
                  : step === 3 && wizardMode === 'existing'
                    ? <>Next: Billing <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    : step === 3 && wizardMode === 'new' && step3Substate === 'idea'
                      ? <>Next: Stack <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                      : step === 3 && wizardMode === 'new' && step3Substate === 'base'
                        ? <>Next: Idea <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                        : step === 2
                          ? <>Next: Project <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                          : <>Advance <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
            }`;

content = content.replace(oldFooterContent, newFooterContent);

// And update the progress label from step 4 instead of step 3
content = content.replace('{`Step ${step} of 3`}', '{`Step ${step} of 4`}');

fs.writeFileSync(filePath, content, 'utf8');
