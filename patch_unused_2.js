const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'copernicus/src/renderer/components/wizard/Wizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace("const [genesisLoading] = useState(false);", "");

fs.writeFileSync(filePath, content, 'utf8');
