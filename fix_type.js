const fs = require('fs');

const managerPath = 'copernicus/src/renderer/components/intelligence/IntelligenceManager.tsx';
let content = fs.readFileSync(managerPath, 'utf8');

content = content.replace(/  const handleInstructionFieldChange = \(field: keyof typeof instructionFields, value: any\) => \{\n    const newFields = \{ \.\.\.instructionFields, \[field\]: value \};\n\n    const newFields = \{ \.\.\.instructionFields, \[field\]: value \};\n    setInstructionFields\(newFields\);/, `  const handleInstructionFieldChange = (field: keyof typeof instructionFields, value: any) => {
    const newFields = { ...instructionFields, [field]: value };
    setInstructionFields(newFields);`);

fs.writeFileSync(managerPath, content);
