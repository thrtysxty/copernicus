const fs = require('fs');
const managerPath = 'copernicus/src/renderer/components/intelligence/IntelligenceManager.tsx';
let content = fs.readFileSync(managerPath, 'utf8');
content = content.replace("  const [expertiseAreasInput, setExpertiseAreasInput] = useState('')\n  const [coreValuesInput, setCoreValuesInput] = useState('')\n", '');
content = content.replace("      setExpertiseAreasInput('');\n      setCoreValuesInput('');", '');
content = content.replace("        setExpertiseAreasInput((parsed.expertiseAreas || []).join(', '));\n        setCoreValuesInput((parsed.coreValues || []).join('\\\\n'));\n", '');
fs.writeFileSync(managerPath, content);
