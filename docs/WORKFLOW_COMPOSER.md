# Workflow Composer

The Workflow Composer is a visual agent orchestration tool integrated into the Copernicus IDE. It allows users to design, visualize, and execute agentic workflows using a node-based interface.

## Node Types

### Agents
*   **Color:** Dynamic Phosphor Color (e.g., Green/Amber/Blue)
*   **Description:** Represents an AI agent (Claude, Gemini, Jules, Sentinel) performing a task.
*   **Usage:** Assign a persona and a prompt/instruction.

### Tools
*   **Color:** Blue (#60A5FA)
*   **Description:** Represents a deterministic operation.
*   **Examples:** Shell commands (`npm test`, `git commit`), File operations, API calls.

### Decisions
*   **Color:** Amber (#FBBF24)
*   **Description:** Logic gates that route execution based on conditions.
*   **Examples:** "Tests Passed?", "Review Approved?".

### Triggers
*   **Color:** Purple (#A78BFA)
*   **Description:** Events that initiate a workflow.
*   **Examples:** Manual Run, On Story Open, Cron Schedule.

## Execution Flow

1.  **Design:** Drag nodes onto the canvas (currently pre-populated). Connect nodes to define the execution path.
2.  **Run:** Click the "Run Workflow" button. The graph is serialized and sent to the backend engine.
3.  **Topological Sort:** The engine determines the execution order based on dependencies.
4.  **Execution:** Nodes are executed sequentially (mocked for MVP).
5.  **Feedback:** The canvas updates in real-time via status polling (Idle -> Running -> Completed/Failed).

## Technical Implementation

*   **Engine:** `copernicus/electron/workflow/engine.ts` implements a topological sort and state machine.
*   **Canvas:** `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx` uses a custom SVG implementation for high performance on constrained hardware (Raspberry Pi 3B+).
*   **IPC:** `workflow:run` and `workflow:status` handle communication between the renderer and the main process.
