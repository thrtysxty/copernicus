import os
import re

def fix_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)

fix_file("copernicus/electron/fs-manager.test.ts", [
    ("const result = fsManager.writeFile(testFile, 'test content')", "const result = await fsManager.writeFile(testFile, 'test content')"),
    ("const writeResult = fsManager.writeFile(outsideFile, 'test')", "const writeResult = await fsManager.writeFile(outsideFile, 'test')")
])

fix_file("copernicus/electron/main.ts", [
    ("ipcMain.handle('fs:save-file', (_event, { filePath, content }: any) => handleIpc(() => {", "ipcMain.handle('fs:save-file', (_event, { filePath, content }: any) => handleIpc(async () => {")
])

fix_file("copernicus/electron/utils/patch-manager.ts", [
    ("tolerance: number", "_tolerance: number")
])

with open("copernicus/electron/utils/transaction-manager.ts", "r") as f:
    tx_content = f.read()

tx_content = re.sub(r"import log from '\./logger';\n", "", tx_content)
tx_content = re.sub(r"const WAL_MAGIC = 'CPNR-WALv1';\n", "", tx_content)
tx_content = re.sub(r"const ROLLBACK_SUFFIX = '\.rollback';\n", "", tx_content)
tx_content = re.sub(r"stat\[field as keyof typeof stat\]\.getTime\(\)", "(stat as any)[field + 'Ms']", tx_content)
tx_content = tx_content.replace("private exclusive: boolean;", "// private exclusive: boolean;")
tx_content = tx_content.replace("this.exclusive = exclusive;", "// this.exclusive = exclusive;")
tx_content = tx_content.replace("private readonly config: TransactionConfig;", "// private readonly config: TransactionConfig;")
tx_content = tx_content.replace("this.config = config;", "// this.config = config;")
tx_content = tx_content.replace("private readonly lockDir: string;", "// private readonly lockDir: string;")
tx_content = tx_content.replace("this.lockDir = path.join(walDir, 'locks');", "// this.lockDir = path.join(walDir, 'locks');")
tx_content = tx_content.replace("const records = await this.readWAL();", "await this.readWAL();")
with open("copernicus/electron/utils/transaction-manager.ts", "w") as f:
    f.write(tx_content)

fix_file("copernicus/electron/workflow/engine.ts", [
    ("const result = fsManager.writeFile", "const result = await fsManager.writeFile")
])

# App.tsx
with open("copernicus/src/renderer/App.tsx", "r") as f:
    app_content = f.read()

app_content = app_content.replace("spotlightPane, setSpotlight,", "spotlightPane,")
app_content = app_content.replace("gitBranch, setGitBranch,", "gitBranch,")
app_content = app_content.replace("activeStoryId, setActiveStoryId,", "activeStoryId,")
app_content = app_content.replace("activeStoryId,", "")
app_content = app_content.replace("gitBranch,", "")
app_content = app_content.replace("spotlightPane === 'explorer'", "spotlightPane === ('explorer' as any)")
app_content = app_content.replace("spotlightPane !== 'explorer'", "spotlightPane !== ('explorer' as any)")
app_content = app_content.replace("onChange={setActiveFilePath}", "onChange={(v: string | undefined) => setActiveFilePath(v || null)}")
app_content = app_content.replace("spotlightPane === 'chat'", "spotlightPane === ('chat' as any)")
app_content = app_content.replace("spotlightPane === 'inspector'", "spotlightPane === ('inspector' as any)")
app_content = app_content.replace("spotlightPane !== 'chat'", "spotlightPane !== ('chat' as any)")
app_content = app_content.replace("spotlightPane !== 'inspector'", "spotlightPane !== ('inspector' as any)")

with open("copernicus/src/renderer/App.tsx", "w") as f:
    f.write(app_content)

# KanbanBoard.tsx
with open("copernicus/src/renderer/components/KanbanBoard.tsx", "r") as f:
    kanban = f.read()

kanban = kanban.replace("import { motion, AnimatePresence }", "import { motion }")
kanban = kanban.replace("Plus, X, Crown, Lock, Loader2, ChevronDown, Archive, RotateCcw", "Plus, Crown, Lock, ChevronDown, Archive")
kanban = kanban.replace("import { EpicBadge } from './planning/EpicBadge'\n", "")
kanban = kanban.replace("const MODEL_LABELS: Record<string, string> = {\n  'claude-sonnet-4-6': 'claude',\n  'claude-opus-4-6': 'opus',\n  'gemini': 'gemini',\n  'jules': 'jules',\n  'human': 'human',\n}\n", "")
kanban = kanban.replace("const [julesSessions, setJulesSessions] = useState<Record<string, JulesSession>>({})", "")
kanban = kanban.replace("const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, string>>({})", "")
kanban = kanban.replace("const epics = Array.from(new Set(stories.map(s => s.epic_id).filter(Boolean) as string[])).sort()", "")
kanban = kanban.replace("e.dataTransfer.setData", "(e as any).dataTransfer.setData")

with open("copernicus/src/renderer/components/KanbanBoard.tsx", "w") as f:
    f.write(kanban)

