| Class | Files that import/use it | Decision |
|---|---|---|
| DapClient | `copernicus/electron/ipc/debug-handlers.ts` | KEEP |
| DiagnosticsRunner | `copernicus/electron/ipc/diag-handlers.ts` | KEEP |
| ExtensionLoader | `copernicus/electron/ipc/extension-handlers.ts`, `copernicus/electron/ipc/register-all-handlers.ts` | KEEP |
| ExtensionRegistry | `copernicus/electron/extensions/ExtensionLoader.ts`, `copernicus/electron/workflow/engine.ts`, `copernicus/electron/workflow/types.ts`, `copernicus/electron/ipc/extension-handlers.ts`, `copernicus/electron/ipc/register-all-handlers.ts` | KEEP |
| GithubManager | `copernicus/electron/main.ts`, `copernicus/electron/workflow/engine.ts`, `copernicus/electron/ipc/deps.ts` | KEEP |
| BackendManager | `copernicus/electron/main.ts`, `copernicus/electron/ipc/deps.ts` | KEEP |
| AuthManager | `copernicus/electron/main.ts`, `copernicus/electron/workflow/engine.ts`, `copernicus/electron/ipc/deps.ts`, `copernicus/electron/genesis/genesis-runner.ts`, `copernicus/electron/github-manager.ts` | KEEP |
| GitGuard | `copernicus/electron/security/security-manager.ts`, `copernicus/src/renderer/components/settings/sections/SecuritySection.tsx` | KEEP |
| HybridRetriever | `copernicus/electron/main.ts`, `copernicus/electron/utils/rag-benchmark.ts`, `copernicus/electron/ipc/deps.ts` | KEEP |
| FSManager | `copernicus/electron/main.ts`, `copernicus/electron/workflow/engine.ts`, `copernicus/electron/ipc/test-handlers.ts`, `copernicus/electron/ipc/deps.ts` | KEEP |
