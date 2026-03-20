The Workflow Builder lets you chain AI agents, tools, and decisions into automated pipelines.

**Opening the builder:**
- Click the Workflow icon in the Activity Bar

**Node types:**
- **Trigger** — starts the workflow (manual click or event)
- **Agent** — sends a prompt to an AI model and captures the response
- **Tool** — runs a built-in action (file read, shell command, git operation)
- **Decision** — branches the flow based on a condition (yes/no)
- **Flow** — groups nodes into a named sub-flow

**Building a workflow:**
1. Drag nodes from the Node Palette (left panel) onto the canvas
2. Click and drag from one node's output port to another's input port to connect them
3. Select a node to open the Inspector (right panel) and configure it:
   - Agent nodes: choose a model, set a system prompt and task
   - Decision nodes: set the condition expression
4. Click **▶ Run** in the toolbar to execute the workflow

**Workflow status:**
- Each node shows its state: Idle → Running → Complete / Error / Skipped
- The status bar shows overall workflow progress
- The Terminal panel shows agent output in real time

**Templates:**
- Pre-built workflow templates are available from the template picker in the toolbar
