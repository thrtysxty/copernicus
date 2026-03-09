# Code Review #5 — deepseek

Looking at this codebase with an antagonistic security lens, I found several CRITICAL and HIGH severity issues that need immediate attention:

## CRITICAL ISSUES

### 1. **Private API Key Leakage via Logs** - CRITICAL
**File:** `dev_orchestrator/cloud_agent.py`
**Lines:** 56-60, 78-82

```python
# OpenAI API key is logged directly
headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

# API key exposed in error messages
print(f"WARNING: OLLAMA_API_KEY not set — cloud request will be rejected (401)", file=sys.stderr)
```

**Risk:** API keys are logged to stderr, potentially exposing them in cloud logs or debugging output.

### 2. **Path Traversal in File Operations** - CRITICAL  
**File:** `copernicus/electron/ipc/file-handlers.ts`
**Lines:** Multiple instances

The `assertSafePath` function is inconsistently applied. While `fs:read-file` uses it, **`fs:save-file` and `fs:save-multiple` do NOT validate the path before writing**:

```typescript
ipcMain.handle('fs:save-file', (_event, { filePath, content }) => {
    // MISSING: assertSafePath(filePath); // <-- CRITICAL OMISSION
    await fsManager.writeFile(filePath, content)
})
```

**Risk:** Attackers can write files anywhere on the filesystem, including system directories.

### 3. **Unsafe Subprocess Execution** - CRITICAL
**File:** `dev_orchestrator/gemini_session_manager.py`
**Lines:** 160-166

```python
proc = subprocess.Popen(
    [GEMINI_BIN, '--approval-mode', 'yolo', '-p', prompt],
    # NO shell=False flag - uses potentially unsafe PATH resolution
)
```

**Risk:** An attacker who controls PATH environment could substitute malicious Gemini binary.

### 4. **Authorization Bypass in IPC Handlers** - CRITICAL
**File:** `copernicus/electron/preload.ts`
**Lines:** SEND_CHANNELS enumeration

Several critical operations have **no authentication** despite `require_auth` middleware:

- `fs:save-multiple` - Bulk file writes
- `app:set-root-path` - Changes workspace
- `github:clone-repo` - Executes git operations
- `env:install` - Spawns subprocesses

**Risk:** Any renderer process can invoke these without authentication.

## HIGH ISSUES

### 5. **Unbounded Memory Consumption** - HIGH
**File:** `backend/api/agents.py`
**Lines:** ContextManager `_sessions` structure

```python
self._sessions: Dict[str, OrderedDict] = {}
```

**Risk:** While there's a session cap (100), each session can grow unbounded via `ContextItem` additions. An attacker can exhaust memory by adding large content items to sessions.

### 6. **Denial of Service via Subprocess Spam** - HIGH
**File:** `copernicus/electron/ipc/app-handlers.ts`
**Lines:** Multiple terminal spawn endpoints

Endpoints like `env:install`, `terminal-create`, `gemini:spawn` can be rapidly invoked to spawn unlimited subprocesses. No rate limiting exists at the Electron level.

### 7. **SQL Injection Vector** - HIGH  
**File:** `backend/api/stories.py`
**Lines:** 115-125

```python
update_fields = []
values = []
# ... field validation ...
query = "UPDATE stories SET " + ", ".join(update_fields) + " WHERE id = ?"
```

**Risk:** Dynamic SQL string concatenation creates injection vulnerability despite parameterization.

### 8. **Token Exhaustion Attack** - HIGH
**File:** `backend/api/agents.py`
**Lines:** Research endpoint rate limiting

Rate limit is "10 per minute" but each request can spawn 120-second subprocess (`agent_gateway.py`). An attacker can exhaust worker processes with concurrent requests.

## MEDIUM ISSUES

### 9. **Incomplete Input Validation** - MEDIUM
**File:** `backend/schemas/agents.py`
**Lines:** Model name validation

The regex `r'^[a-zA-Z0-9]([a-zA-Z0-9_.:\-/]{0,99})$` allows colons and slashes, which could be used for path traversal in some contexts.

### 10. **Resource Leakage** - MEDIUM  
**File:** `copernicus/electron/main.ts`
**Lines:** Browser and LSP manager cleanup

The cleanup code assumes graceful shutdown, but crash scenarios leave browser processes and LSP servers running indefinitely.

### 11. **Information Disclosure** - MEDIUM
**File:** `backend/api/llm.py`
**Lines:** Git context endpoint

`/api/llm/context/git` exposes internal file structure without authentication, potentially revealing sensitive path information.

## RECOMMENDATIONS

1. **Immediate:**
   - Add `assertSafePath` to ALL file write operations
   - Implement Electron-level rate limiting for subprocess spawning
   - Remove API key logging and use secure credential storage
   - Add authentication to ALL critical IPC handlers

2. **Short-term:**
   - Implement memory limits per session in ContextManager
   - Add timeouts to all subprocess executions
   - Use prepared statements for ALL SQL queries
   - Validate ALL model names against allowlist

3. **Long-term:**
   - Implement process monitoring and cleanup daemon
   - Add sandboxing for subprocess execution
   - Implement comprehensive security audit logging

The most critical issues are the missing path validation in file write operations and the API key leakage - these should be addressed immediately.
