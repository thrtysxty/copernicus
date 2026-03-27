const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'copernicus/src/renderer/components/wizard/Wizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add Step 3 Substate
content = content.replace(
  "const [wizardMode, setWizardMode] = useState<'new' | 'existing' | null>(null);",
  "const [wizardMode, setWizardMode] = useState<'new' | 'existing' | null>(null);\n  const [step3Substate, setStep3Substate] = useState<'base' | 'idea' | 'stack'>('base');"
);

// Update step display label
content = content.replace(
  "{`Step ${step} of 3`}",
  "{`Step ${step} of 4`}"
);

// We need to modify the navigation logic
const oldNav = `  const handleNext = () => {
    setError(null);
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else handleFinish();
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };`;

const newNav = `  const handleNext = () => {
    setError(null);
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
      setStep3Substate('base');
    } else if (step === 3) {
      if (wizardMode === 'existing') {
        setStep(4);
      } else if (wizardMode === 'new') {
        if (step3Substate === 'base') {
          if (!newProjectName.trim()) {
            setError('Please enter a project name.');
            return;
          }
          setStep3Substate('idea');
        } else if (step3Substate === 'idea') {
          setStep3Substate('stack');
        } else if (step3Substate === 'stack') {
          // Fire genesis:run in background here
          const fullPath = \`\${workspacePath}/\${newProjectName.trim()}\`;
          invoke('genesis:run', {
            projectName: newProjectName.trim(),
            idea: genesisIdea.trim() || 'A new software project.',
            audience: genesisAudience.trim() || 'Developers',
            coreValue: genesisCoreValue.trim() || 'Productivity',
            stack: genesisStack,
            repoPath: fullPath,
            isNewRepo: true,
          }).catch((err: unknown) => console.warn('[Wizard] genesis:run failed (non-fatal):', err));
          setStep(4);
        }
      }
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 4) {
      setStep(3);
      if (wizardMode === 'new') setStep3Substate('stack');
      else setStep3Substate('base');
    } else if (step === 3) {
      if (wizardMode === 'new' && step3Substate === 'stack') {
        setStep3Substate('idea');
      } else if (wizardMode === 'new' && step3Substate === 'idea') {
        setStep3Substate('base');
      } else {
        setStep(2);
      }
    } else if (step > 1) {
      setStep(step - 1);
    }
  };`;

content = content.replace(oldNav, newNav);

// Update handleFinish to not run genesis:run since it runs on Next at 3-stack
const handleFinishStart = "      // Genesis — scaffold repo + generate first-sprint backlog for new projects";
const handleFinishEnd = "      }";

content = content.replace(
  /[\s]*\/\/ Genesis — scaffold repo \+ generate first-sprint backlog for new projects[\s]*if \(wizardMode === 'new'\) \{[\s]*setGenesisLoading\(true\);[\s]*await invoke\('genesis:run', \{[\s\S]*?\}\)\.catch\(\(err: unknown\) => console\.warn\('\[Wizard\] genesis:run failed \(non-fatal\):', err\)\);[\s]*setGenesisLoading\(false\);[\s]*\}/,
  ""
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Nav and handleFinish replaced');
