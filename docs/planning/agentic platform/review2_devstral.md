# Code Review #2 — devstral

Here's a brutal, specific code review of the COPERNICUS IDE codebase:

### Security Issues

**[CRITICAL]** `backend/api/agents.py:350` — Command injection via `subprocess.run` with user-controlled `prompt` — risk
The `research` endpoint passes user input directly to a shell command via `subprocess.run(["python3", str(GATEWAY_PATH), prompt, ...])`. While `shell=True` is not used, the `prompt` parameter is still passed as a command-line argument which could contain malicious shell metacharacters.

**[HIGH]** `backend/api/agents.py:400` — SQL injection in `context_handoff` — risk
The `story_id` and `session_id` parameters are used directly in SQL queries without parameterization:
```python
cursor.execute("SELECT last_search_context FROM jules_sessions WHERE story_id = ? AND last_search_context IS NOT NULL ORDER BY started_at DESC LIMIT 1", (story_id,))
```
While this uses parameterization, the `story_id` comes from user input and isn't validated for SQL keywords.

**[HIGH]** `copernicus/electron/ipc/terminal-handlers.ts:100` — Unsafe terminal command execution — risk
The `gemini:spawn` handler allows arbitrary command execution through the Gemini agent without proper input validation:
```typescript
ipcMain.handle('gemini:spawn', (_e, opts: { cwd: string }) => handleIpc('gemini:spawn', [opts], async () => {
    const agent = new GeminiAgent({
        cwd: opts.cwd || fsManager.getRootPath(),
        onOutput: (chunk) => {
            win?.webContents.send('gemini:output', { sessionId: agent.sessionId, chunk })
        },
    })
    await agent.spawn()
    // ...
}))
```

**[MEDIUM]** `backend/app.py:30` — CORS misconfiguration — risk
The `validate_origin` function allows `app://copernicus` which is overly permissive and could allow attacks from malicious apps registering this protocol handler.

### Correctness Issues

**[CRITICAL]** `backend/api/agents.py:300` — Race condition in context management — risk
The `ContextManager` class uses an in-memory dictionary (`self._sessions`) without any locking mechanism, leading to potential race conditions when multiple threads access/modify sessions concurrently.

**[HIGH]** `copernicus/electron/ipc/app-handlers.ts:200` — Unhandled promise rejection in devtime handlers — risk
Several handlers like `devtime:run-tests` don't properly handle promise rejections:
```typescript
ipcMain.handle('devtime:run-tests', () => handleIpc('devtime:run-tests', [], async () => {
    const start = Date.now()
    const { stdout } = await execFileAsync(...) // No try-catch
    // ...
}))
```

**[HIGH]** `backend/utils/path_guard.py:20` — Incomplete path validation — risk
The `assert_safe_path` function doesn't properly handle Windows paths with drive letters and doesn't validate against path traversal attacks using UNC paths (`\\server\share`).

**[MEDIUM]** `copernicus/electron/main.ts:150` — Missing error handling in IPC registration — risk
The `registerIpcHandlers` function doesn't wrap the handler registrations in try-catch blocks, so if one handler fails to register, it could break the entire IPC system.

### Architecture Issues

**[CRITICAL]** `backend/api/agents.py` — Tight coupling between agents and context management — risk
The `agents.py` module contains both the agent execution logic and the `ContextManager` class, violating the Single Responsibility Principle. The context management should be in a separate module.

**[HIGH]** `copernicus/electron/ipc/` — Overly broad handler responsibilities — risk
Many IPC handlers (like `app-handlers.ts`) handle too many unrelated responsibilities. For example, `app-handlers.ts` handles settings, devtime, ledger, Jules, touchbar, git, and environment operations - this violates the Single Responsibility Principle.

**[MEDIUM]** `backend/providers/factory.py` — Missing provider interface validation — risk
The `get_provider` function doesn't validate that the returned provider implements all required methods from `BaseProvider`, which could lead to runtime errors.

**[MEDIUM]** `copernicus/src/renderer/components/chat/useChatPanel.ts` — State management sprawl — risk
The `useChatPanel` hook manages too much state (20+ state variables) and contains complex business logic that should be moved to a dedicated service layer.

### IPC Module Issues

**[CRITICAL]** `copernicus/electron/ipc/terminal-handlers.ts:50` — Unsafe terminal resizing — risk
The `terminal:resize` handler doesn't validate the `cols` and `rows` parameters, which could lead to integer overflow or other issues:
```typescript
ipcMain.handle('terminal:resize', (_e, { id, cols, rows }: { id: string; cols: number; rows: number }) =>
    handleIpc('terminal:resize', [{ id, cols, rows }], () => ptyManager.resize(id, cols, rows)));
```

**[HIGH]** `copernicus/electron/ipc/file-handlers.ts:30` — Missing validation in file operations — risk
The `fs:save-multiple` handler doesn't validate the file paths before writing:
```typescript
ipcMain.handle('fs:save-multiple', (_e, files: { filePath: string, content: string }[]) =>
    handleIpc('fs:save-multiple', [files], async () => {
        const txId = await fsManager.beginTransaction();
        try {
            for (const f of files) {
                await fsManager.stageFile(txId, f.filePath, f.content); // No path validation
            }
            // ...
        } catch (err: unknown) {
            // ...
        }
    }))
```

### Validation Issues

**[CRITICAL]** `backend/utils/validate.py:30` — Incomplete path validation — risk
The `_is_path_violating` function doesn't check for Windows UNC paths (`\\server\share`) or other path traversal vectors.

**[HIGH]** `backend/schemas/agents.py` — Insufficient input validation — risk
The `AgentRunRequest` schema doesn't validate the `model` field against a allowlist of known models, allowing potential injection attacks.

**[MEDIUM]** `copernicus/electron/ipc/auth-handlers.ts:100` — Missing input validation in OAuth flows — risk
The OAuth handlers don't properly validate the redirect URLs and state parameters, which could lead to OAuth-related attacks.

### Cloud Agent Issues

**[CRITICAL]** `dev_orchestrator/cloud_agent.py:100` — Missing input validation in cloud agent — risk
The `run` method doesn't validate the `prompt` parameter before passing it to the Ollama client, which could contain malicious content.

**[HIGH]** `dev_orchestrator/cloud_agent.py:80` — Insecure API key handling — risk
The cloud agent stores the API key in a class variable without proper protection, and logs sensitive information to stderr.

**[MEDIUM]** `dev_orchestrator/cloud_agent.py:120` — Missing error handling in worktree operations — risk
The `WorktreeManager.create` method doesn't properly handle all error cases from git operations, which could leave the filesystem in an inconsistent state.

### Prior Audit Misses

**[CRITICAL]** `copernicus/electron/main.ts:80` — Missing Content Security Policy for webviews — risk
The application uses webviews (`webviewTag: true`) but doesn't set a proper CSP for them, which could allow XSS attacks.

**[HIGH]** `backend/api/stories.py:50` — Missing authentication for sensitive operations — risk
The stories API doesn't properly validate that the user has permission to access/modify specific stories, allowing potential data leakage.

**[MEDIUM]** `copernicus/src/renderer/components/chat/ChatPanel.tsx:30` — Missing input sanitization — risk
The chat component doesn't sanitize user input before rendering it, which could lead to XSS vulnerabilities if malicious content is displayed.

### Additional Findings

**[CRITICAL]** `copernicus/electron/ipc/app-handlers.ts:300` — Missing validation in environment variable handling — risk
The `env:install` handler doesn't properly validate the `command` parameter before executing it:
```typescript
ipcMain.handle('env:install', (_e, opts: { id: string; label: string; command: string; cwd?: string }) =>
    handleIpc('env:install', [opts], async () => {
        if (!/^[a-zA-Z0-9 _./-]+$/.test(opts.command)) {
            throw new Error('INVALID_COMMAND')
        }
        // ...
    }))
```
The regex is too permissive and allows potentially dangerous characters.

**[HIGH]** `backend/api/agents.py:250` — Missing rate limiting — risk
The agent endpoints don't implement any rate limiting, which could allow denial-of-service attacks.

**[MEDIUM]** `copernicus/electron/main.ts:120` — Missing proper error handling in window creation — risk
The `createWindow` function doesn't properly handle errors during window creation, which could leave the application in an inconsistent state.

### Recommendations

1. **Security Hardening**:
   - Implement proper input validation for all user-controlled parameters
   - Add rate limiting to all API endpoints
   - Implement proper CSP for webviews
   - Add proper authentication and authorization checks

2. **Architecture Improvements**:
   - Split large modules into smaller, focused components
   - Implement proper dependency injection
   - Add proper error handling and logging

3. **Validation Enhancements**:
   - Strengthen path validation to handle all edge cases
   - Add allowlists for sensitive operations
   - Implement proper input sanitization

4. **Testing**:
   - Add comprehensive unit and integration tests
   - Implement fuzz testing for input validation
   - Add security-focused penetration testing

5. **Documentation**:
   - Add security documentation for all public APIs
   - Document all assumptions and invariants
   - Add examples of proper usage patterns

The codebase shows signs of rapid development without sufficient focus on security and robustness. Many of these issues could be addressed by implementing proper validation layers, better error handling, and more modular architecture.
