const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'copernicus/src/renderer/components/wizard/Wizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// I also want to make sure the back button isn't disabled inappropriately. It is currently: `disabled={step === 1}` which is correct.
// However I need to double check `disabled` for the next button.
// `disabled={... || (step === 3 && wizardMode === 'existing' && (!selectedProject || repoStatus === 'no-git')) || (step === 3 && wizardMode === 'new' && step3Substate === 'base' && !newProjectName.trim()) || (step === 2 && !workspacePath)}`
// What if we are at step 3 and wizardMode is null? Then it shouldn't be disabled? Yes it should!
// We should add `(step === 3 && !wizardMode)` to disabled.
// Also, genesisLoading does not exist anymore. We removed it, so we need to delete `genesisLoading || ` and `{genesisLoading ... : `

const oldDisabled = "disabled={genesisLoading || (step === 3 && wizardMode === 'existing' && (!selectedProject || repoStatus === 'no-git')) || (step === 3 && wizardMode === 'new' && step3Substate === 'base' && !newProjectName.trim()) || (step === 2 && !workspacePath)}";
const newDisabled = "disabled={(step === 3 && !wizardMode) || (step === 3 && wizardMode === 'existing' && (!selectedProject || repoStatus === 'no-git')) || (step === 3 && wizardMode === 'new' && step3Substate === 'base' && !newProjectName.trim()) || (step === 2 && !workspacePath)}";

content = content.replace(oldDisabled, newDisabled);

const oldFooterContent = `{genesisLoading
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

const newFooterContent = `{step === 4
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

fs.writeFileSync(filePath, content, 'utf8');
