import re

with open('copernicus/electron/main.ts', 'r') as f:
    content = f.read()

# Remove handleIpc function definition
content = re.sub(r'// ── IPC Error Handling Helper \(Story 163\).*?\nasync function handleIpc<T>\([^}]+\)[^}]+\)[^}]+\)[^}]+\}\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'// ── IPC Error Handling Helper \(Story 163\).*?function computeCoveragePct', 'function computeCoveragePct', content, flags=re.DOTALL)

# Add import
if "import { handleIpc } from './utils/handle-ipc'" not in content:
    content = content.replace("import { AuthManager } from './auth-manager'", "import { AuthManager } from './auth-manager'\nimport { handleIpc } from './utils/handle-ipc'")

# Change new GithubManager(authManager, handleIpc) to new GithubManager(authManager)
content = content.replace("new GithubManager(authManager, handleIpc)", "new GithubManager(authManager)")

# Change registerSecurityHandlers(ipcMain, settingsStore, handleIpc)
content = content.replace("registerSecurityHandlers(ipcMain, settingsStore, handleIpc)", "registerSecurityHandlers(ipcMain, settingsStore)")

with open('copernicus/electron/main.ts', 'w') as f:
    f.write(content)

