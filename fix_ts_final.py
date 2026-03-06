import os
import re

def fix_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)

with open("copernicus/electron/fs-manager.test.ts", "r") as f:
    test_content = f.read()
test_content = re.sub(r"const result = fsManager\.writeFile\(filePath, 'new content'\)", "const result = await fsManager.writeFile(filePath, 'new content')", test_content)
test_content = re.sub(r"const writeResult = fsManager\.writeFile\(unsafePath, 'malicious'\)", "const writeResult = await fsManager.writeFile(unsafePath, 'malicious')", test_content)
with open("copernicus/electron/fs-manager.test.ts", "w") as f:
    f.write(test_content)

with open("copernicus/electron/utils/transaction-manager.ts", "r") as f:
    tx_content = f.read()
tx_content = tx_content.replace("result[field] = (stat as any)[field];", "result[field as keyof typeof result] = (stat as any)[field];")
tx_content = tx_content.replace("constructor(targetPath: string, lockDir: string, exclusive = false) {", "constructor(targetPath: string, lockDir: string, _exclusive = false) {")
tx_content = tx_content.replace("for (const rec of records) {", "const records = await this.readWAL();\n    for (const rec of records) {")
with open("copernicus/electron/utils/transaction-manager.ts", "w") as f:
    f.write(tx_content)

with open("copernicus/src/renderer/App.tsx", "r") as f:
    app_content = f.read()
app_content = app_content.replace("gitBranch, setGitBranch,", "")
app_content = app_content.replace("gitBranch,", "")
app_content = app_content.replace("setGitBranch,", "")
app_content = re.sub(r"invoke<any>\('git:branch'\)\.then\(\(r: any\) => setGitBranch\(unwrapIpc<any>\(r\) \?\? ''\)\)\.catch\(\(\) => \{\}\)\n", "", app_content)
with open("copernicus/src/renderer/App.tsx", "w") as f:
    f.write(app_content)

with open("copernicus/src/renderer/components/KanbanBoard.tsx", "r") as f:
    kanban_content = f.read()
kanban_content = re.sub(r"const \[julesSessions, setJulesSessions\] = useState<Record<string, JulesSession>>\(\{\}\)\n", "", kanban_content)
kanban_content = re.sub(r"const \[workflowStatuses, setWorkflowStatuses\] = useState<Record<string, string>>\(\{\}\)\n", "", kanban_content)
with open("copernicus/src/renderer/components/KanbanBoard.tsx", "w") as f:
    f.write(kanban_content)

