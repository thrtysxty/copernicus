const fs = require('fs');

const path = 'copernicus/src/renderer/components/settings/SettingsPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `  | 'extensions'\n  | 'skills'`,
  `  | 'extensions'\n  | 'skills'\n  | 'billing'`
);

content = content.replace(
  `import { SkillsSection } from './sections/SkillsSection'`,
  `import { SkillsSection } from './sections/SkillsSection'\nimport { BillingSection } from './sections/BillingSection'`
);

content = content.replace(
  `import { \n  X, Shield, Key, Layout, Cpu, \n  Settings, GitBranch, Workflow, FileText, \n  Terminal, Database, User, Layers, Search, Zap, Puzzle\n} from 'lucide-react'`,
  `import { \n  X, Shield, Key, Layout, Cpu, \n  Settings, GitBranch, Workflow, FileText, \n  Terminal, Database, User, Layers, Search, Zap, Puzzle, DollarSign\n} from 'lucide-react'`
);

content = content.replace(
  `      case 'skills':      return <SkillsSection />\n      default:            return <ProvidersSection />`,
  `      case 'skills':      return <SkillsSection />\n      case 'billing':     return <BillingSection />\n      default:            return <ProvidersSection />`
);

content = content.replace(
  `<TabButton id="skills" label="Skills" icon={<Zap size={14} />} active={activeTab} onClick={setActiveTab} />`,
  `<TabButton id="skills" label="Skills" icon={<Zap size={14} />} active={activeTab} onClick={setActiveTab} />\n            <TabButton id="billing" label="Billing" icon={<DollarSign size={14} />} active={activeTab} onClick={setActiveTab} />`
);

fs.writeFileSync(path, content, 'utf8');
