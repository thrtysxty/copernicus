const fs = require('fs');
const managerPath = 'copernicus/src/renderer/components/intelligence/IntelligenceManager.tsx';
let content = fs.readFileSync(managerPath, 'utf8');

// The replacement was slightly off
content = content.replace(/        setExpertiseAreasInput\(\(parsed\.expertiseAreas \|\| \[\]\)\.join\(\', \'\)\);\n        setCoreValuesInput\(\(parsed\.coreValues \|\| \[\]\)\.join\(\'\\\\n\'\)\);\n/, '');

// Need to fix the actual occurrences
content = content.replace(/setExpertiseAreasInput\('[^']*'\);\n\s*setCoreValuesInput\('[^']*'\);/, '');
content = content.replace(/setExpertiseAreasInput\([^;]+\);/g, '');
content = content.replace(/setCoreValuesInput\([^;]+\);/g, '');

content = content.replace(/value=\{coreValuesInput\}/g, `value={instructionFields.coreValues.join('\\n')}`);
content = content.replace(/value=\{expertiseAreasInput\}/g, `value={instructionFields.expertiseAreas.join(', ')}`);

fs.writeFileSync(managerPath, content);
