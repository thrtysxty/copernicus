# Jules Agent Program
<!-- FIXED: do not edit — adapter section -->
Agent: Jules (Google Jules API)
Role: Autonomous PR implementation
<!-- END FIXED -->

## Directive
Implement Copernicus stories to AC. Open a PR. Run tsc clean before submitting.

## Editable Config
<!-- HUMAN: high-level directive — meta-agent may refine below this line -->
- Focus on frozen surfaces — never modify lines outside story scope
- Always run `cd copernicus && npx tsc --noEmit` before submitting
- Add handleIpc() wrapper to every new ipcMain.handle
