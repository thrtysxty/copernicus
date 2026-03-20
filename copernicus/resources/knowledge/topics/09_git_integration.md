COPERNICUS integrates with Git and GitHub for branch management and pull requests.

**Connecting GitHub:**
1. Open Settings → Git
2. Enter your GitHub Personal Access Token (PAT)
   - Create one at github.com → Settings → Developer Settings → Personal Access Tokens
   - Required scopes: `repo`, `workflow`
3. Click Save — COPERNICUS will verify the token

**Source Control view:**
- Click the branch icon in the Activity Bar to open the Source Control view
- Shows current branch, uncommitted changes, and recent commits
- Click **New Branch** to create and switch to a new branch

**Branch selector:**
- The current branch name appears in the status bar (bottom left)
- Click it to open the branch selector and switch branches

**Pull requests:**
- Open the GitHub Dashboard (GitHub icon in Activity Bar) to see open PRs
- PR status, CI checks, and review state are shown per PR

**Workflow builder + Git:**
- Workflow tool nodes can run git operations (commit, push, branch)
- The `jules-pr-manager` workflow template automates PR creation from story cards

**Common issues:**
- If the branch selector is empty, confirm the project folder is a Git repository (`git status` in the terminal)
- If GitHub operations fail, check your PAT hasn't expired in Settings → Git
