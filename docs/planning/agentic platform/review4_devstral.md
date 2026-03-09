# Code Review #4 — devstral

### Review #4 — COPERNICUS IDE

#### 1. Logic Errors in NEW Fixes

**backend/limiter.py:10**
```python
def _rate_limit_key() -> str:
    return flask_request.headers.get("X-Session-Id") or flask_request.remote_addr or "127.0.0.1"
```
**Risk: HIGH**
- **Issue**: The fallback to `"127.0.0.1"` is incorrect. If `X-Session-Id` is missing and `remote_addr` is falsy (e.g., `None` or empty string), the key becomes `"127.0.0.1"`, which means all unauthenticated requests will share the same rate limit bucket. This defeats the purpose of per-client rate limiting.
- **Fix**: Fall back to `remote_addr` only, and ensure it's never `None`. If `remote_addr` is `None`, raise an error or use a unique identifier per request (e.g., `request.headers.get("X-Forwarded-For")` or `request.remote_addr or "unknown"`).

---

**backend/api/agents.py:100**
```python
MODEL_TIER_PATTERN = re.compile(r'[:_-]?(7|70)b', re.IGNORECASE)
```
**Risk: MEDIUM**
- **Issue**: The regex pattern `[:_-]?(7|70)b` will match `7b` and `70b`, but it will also match `7b` in strings like `model-7b-extra`, which is correct, but it will also match `7b` in `model-70b` (incorrectly extracting `7` instead of `70`). The pattern should be greedy for the number.
- **Fix**: Change the pattern to `r'[:_-]?(70b|7b)'` to prioritize `70b` over `7b`.

---

**backend/api/agents.py:150**
```python
def _get_tier(self, model_name: Optional[str] = None) -> str:
    if not model_name:
        return "default"
    match = MODEL_TIER_PATTERN.search(model_name)
    if match:
        tier = match.group(1)  # "7" or "70"
        return f"{tier}b"
    return "default"
```
**Risk: MEDIUM**
- **Issue**: The `model_name` is not NFKC-normalized before regex matching, but the validation in `schemas/agents.py` normalizes it. This could lead to inconsistencies if the model name contains Unicode characters that normalize differently.
- **Fix**: Normalize `model_name` before matching:
  ```python
  normalized = unicodedata.normalize('NFKC', model_name)
  match = MODEL_TIER_PATTERN.search(normalized)
  ```

---

**backend/api/agents.py:200**
```python
def _prune_aggressiveness(self, model_name: Optional[str] = None) -> float:
    tier = self._get_tier(model_name)
    if tier == "7b":
        return 0.70  # keep 70% of content after pruning
    elif tier == "70b":
        return 0.90  # keep 90%
    return 0.80
```
**Risk: LOW**
- **Issue**: The comment says "keep 70%" but the code returns `0.70`, which means 70% of the content is **pruned** (30% kept). This is misleading.
- **Fix**: Update the comment to clarify:
  ```python
  # 7B: prune to 70% (keep 30%); 70B: prune to 90% (keep 10%).
  ```

---

**backend/api/agents.py:300**
```python
system_prompts = {
    PERSONA_JUNIOR_DEV: "You are a capable junior developer. Explain code clearly and concisely.",
    PERSONA_SCRIBE: "You are a technical writer. Respond in clear, structured markdown.",
    PERSONA_CODE_REVIEWER: "You are an expert code reviewer. Focus on correctness, maintainability, and best practices.",
}
```
**Risk: MEDIUM**
- **Issue**: The `PERSONA_CODE_REVIEWER` prompt is not in the `ALLOWED_PERSONAS` frozenset in `schemas/agents.py`. This could lead to a mismatch where the backend uses a persona not validated by the schema.
- **Fix**: Add `PERSONA_CODE_REVIEWER` to `ALLOWED_PERSONAS` in `schemas/agents.py`.

---

**backend/api/agents.py:350**
```python
result = subprocess.run(
    [
        "python3", str(GATEWAY_PATH),
        "--role", role,
        "--no-stream",
        "--history", history_path,
        "--context-id", session_id,
    ],
    capture_output=True,
    text=True,
    timeout=120,
    env={**os.environ, "AGENT_SESSION_ID": session_id},
)
```
**Risk: HIGH**
- **Issue**: The `GATEWAY_PATH` is resolved at module load time (`PROJECT_ROOT / "scripts" / "agent_gateway.py"`), but `PROJECT_ROOT` is computed as `Path(__file__).resolve().parent.parent.parent`. If the working directory changes or the script is symlinked, this could resolve to an incorrect path.
- **Fix**: Resolve `GATEWAY_PATH` at runtime using `shutil.which` or `Path.cwd()`:
  ```python
  GATEWAY_PATH = shutil.which("agent_gateway.py") or (Path.cwd() / "scripts" / "agent_gateway.py")
  ```

---

**backend/api/llm.py:30**
```python
mock = request.args.get('mock') == 'true' or \
       request.headers.get('COPERNICUS_MOCK_LLM') == '1' or \
       os.environ.get('COPERNICUS_MOCK_LLM') == '1'
```
**Risk: MEDIUM**
- **Issue**: The `mock` check is case-sensitive (`'true'` vs `'True'`). This could lead to inconsistent behavior if the client sends `'True'` or `'TRUE'`.
- **Fix**: Use case-insensitive comparison:
  ```python
  mock = (request.args.get('mock') or '').lower() == 'true' or \
         (request.headers.get('COPERNICUS_MOCK_LLM') or '').lower() == '1' or \
         (os.environ.get('COPERNICUS_MOCK_LLM') or '').lower() == '1'
  ```

---

**backend/schemas/agents.py:20**
```python
ALLOWED_PERSONAS = frozenset({'default', 'junior-dev', 'senior-dev', 'sentinel', 'architect', 'scribe', 'researcher', 'dev'})
```
**Risk: MEDIUM**
- **Issue**: The `PERSONA_CODE_REVIEWER` used in `agents.py` is not in this set. This could cause validation failures if the backend tries to use `code-reviewer`.
- **Fix**: Add `'code-reviewer'` to `ALLOWED_PERSONAS`.

---

**backend/schemas/llm.py:10**
```python
ALLOWED_PROVIDERS = frozenset({'anthropic', 'openai', 'google', 'openrouter', 'deepinfra', 'ollama'})
```
**Risk: MEDIUM**
- **Issue**: The `providers/factory.py` does not handle `'deepinfra'` or `'openrouter'`. If a request includes these providers, `get_provider` will raise an `AppError`.
- **Fix**: Add cases for `'deepinfra'` and `'openrouter'` in `factory.py`.

---

**copernicus/electron/main.ts:50**
```typescript
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')
```
**Risk: HIGH**
- **Issue**: The `DIST` and `VITE_PUBLIC` paths are set at module load time, but `__dirname` is resolved relative to the main script. If the app is packaged and the working directory changes, these paths could become invalid.
- **Fix**: Resolve paths at runtime using `app.getAppPath()`:
  ```typescript
  process.env.DIST = path.join(app.getAppPath(), 'dist')
  process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(app.getAppPath(), 'public')
  ```

---

**copernicus/electron/ipc/app-handlers.ts:100**
```typescript
ipcMain.handle('app:open-external', (_event, url: string) => handleIpc('app:open-external', [url], async () => {
    let parsed: URL
    try { parsed = new URL(url) } catch { throw new Error(`Invalid URL: ${url}`) }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Blocked external URL with protocol: ${parsed.protocol}`)
    }
    return shell.openExternal(url)
}))
```
**Risk: HIGH**
- **Issue**: The `URL` constructor will throw if `url` is not a valid URL, but the error message does not include the original `url` for debugging. Also, the protocol check is case-sensitive (`'HTTPS:'` would pass).
- **Fix**: Normalize the protocol and include the original URL in the error:
  ```typescript
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol.toLowerCase())) {
      throw new Error(`Blocked external URL with protocol: ${parsed.protocol} (URL: ${url})`)
    }
  } catch (e) {
    throw new Error(`Invalid URL: ${url} — ${e instanceof Error ? e.message : 'unknown error'}`)
  }
  ```

---

**copernicus/electron/ipc/file-handlers.ts:50**
```typescript
ipcMain.handle('fs:save-multiple', (_e, files: { filePath: string, content: string }[]) => handleIpc('fs:save-multiple', [files], async () => {
    const txId = await fsManager.beginTransaction();
    try {
      for (const f of files) {
        assertSafePath(f.filePath);
        await fsManager.stageFile(txId, f.filePath, f.content);
      }
      await fsManager.commitTransaction(txId);
      return { ok: true, txId };
    } catch (err: unknown) {
      await fsManager.rollbackTransaction(txId);
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
}))
```
**Risk: HIGH**
- **Issue**: If `fsManager.rollbackTransaction(txId)` fails, the error will be silently swallowed, and the function will return `{ ok: false, error: message }` from the original error. This could leave the transaction in an inconsistent state.
- **Fix**: Log the rollback error and ensure it doesn't mask the original error:
  ```typescript
  try {
    await fsManager.rollbackTransaction(txId);
  } catch (rollbackErr) {
    log.error('Rollback failed:', rollbackErr);
  }
  ```

---

**copernicus/electron/ipc/terminal-handlers.ts:50**
```typescript
ipcMain.handle('gemini:spawn', (_e, opts: { cwd: string }) => handleIpc('gemini:spawn', [opts], async () => {
    const agent = new GeminiAgent({
      cwd: opts.cwd || fsManager.getRootPath(),
      onOutput: (chunk) => {
        win?.webContents.send('gemini:output', { sessionId: agent.sessionId, chunk })
      },
    })
    await agent.spawn()
    geminiAgents.set(agent.sessionId, agent)
    agent.on('exit', () => geminiAgents.delete(agent.sessionId))
    return { sessionId: agent.sessionId }
}))
```
**Risk: HIGH**
- **Issue**: The `opts.cwd` is not validated with `assertSafePath`. An attacker could pass an arbitrary path (e.g., `/etc/passwd`) to spawn a Gemini agent in a sensitive directory.
- **Fix**: Validate `opts.cwd`:
  ```typescript
  const cwd = opts.cwd ? assertSafePath(opts.cwd) : fsManager.getRootPath();
  ```

---

**copernicus/electron/utils/path-guard.ts:20**
```typescript
const isSafe = absRoots.some(root => {
    return resolved === root || resolved.startsWith(root + path.sep);
});
```
**Risk: HIGH**
- **Issue**: On Windows, `path.sep` is `\`, but paths can also use `/`. An attacker could bypass the check by using a mixed-separator path (e.g., `C:/Windows\System32`).
- **Fix**: Normalize separators before comparison:
  ```typescript
  const normalizedResolved = resolved.replace(/\//g, path.sep);
  const normalizedRoot = root.replace(/\//g, path.sep);
  return normalizedResolved === normalizedRoot || normalizedResolved.startsWith(normalizedRoot + path.sep);
  ```

---

#### 2. Second-Order Issues

**backend/api/agents.py:10**
```python
ALLOWED_ORIGINS = {'http://localhost:3000', 'http://localhost:5001', 'app://copernicus'}
```
**Risk: MEDIUM**
- **Issue**: The `app://copernicus` origin is not standard and may not be recognized by all browsers. This could break CORS for the Electron app.
- **Fix**: Use a standard origin (e.g., `file://` for local files or a custom scheme registered with the OS).

---

**backend/api/agents.py:200**
```python
def _prune_aggressiveness(self, model_name: Optional[str] = None) -> float:
    tier = self._get_tier(model_name)
    if tier == "7b":
        return 0.70
    elif tier == "70b":
        return 0.90
    return 0.80
```
**Risk: MEDIUM**
- **Issue**: The default aggressiveness (`0.80`) is not documented or configurable. If a new model tier is added (e.g., `13b`), it will use the default, which may not be optimal.
- **Fix**: Add a fallback mechanism or configuration for unknown tiers.

---

**backend/api/agents.py:300**
```python
system_prompts = {
    PERSONA_JUNIOR_DEV: "You are a capable junior developer...",
    ...
}
```
**Risk: MEDIUM**
- **Issue**: The system prompts are hardcoded and not configurable. If a persona is added or modified, the code must be updated.
- **Fix**: Load system prompts from a configuration file or database.

---

**backend/api/llm.py:50**
```python
provider = get_provider(provider_name)
yield from provider.stream_chat(messages, model, system=system_prompt, api_key=api_key, base_url=base_url, tools=tools)
```
**Risk: MEDIUM**
- **Issue**: The `api_key` and `base_url` are passed directly to the provider without validation. If `api_key` is malformed or `base_url` is not a valid URL, the provider may fail silently.
- **Fix**: Validate `api_key` and `base_url` before passing them to the provider.

---

**copernicus/electron/ipc/app-handlers.ts:200**
```typescript
ipcMain.handle('env:scan', () => handleIpc('env:scan', [], async () => {
    const check = async (bin: string): Promise<{ found: boolean; version?: string }> => {
      try {
        const ALLOWED_BINS = ['git', 'node', 'python3', 'gemini', 'npm', 'npx']
        if (!ALLOWED_BINS.includes(bin)) throw new Error(`Disallowed binary: ${bin}`)
        ...
      }
    }
    const TOOLS = ['node', 'git', 'python3', 'make', 'bun', 'gh', 'curl']
    ...
}))
```
**Risk: MEDIUM**
- **Issue**: The `TOOLS` list includes `'make'`, `'bun'`, `'gh'`, and `'curl'`, but these are not in `ALLOWED_BINS`. This will cause the check to fail for these tools.
- **Fix**: Add all tools to `ALLOWED_BINS` or remove them from `TOOLS`.

---

**copernicus/electron/ipc/file-handlers.ts:100**
```typescript
ipcMain.handle('makefile:run', (_event, target) => handleIpc('makefile:run', [target], () => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (!ALLOWED.includes(target)) return;
    ...
}))
```
**Risk: MEDIUM**
- **Issue**: The `makefile:run` handler silently returns if the target is not allowed. This could confuse users who expect an error message.
- **Fix**: Throw an error for disallowed targets:
  ```typescript
  if (!ALLOWED.includes(target)) {
    throw new Error(`Disallowed make target: ${target}`);
  }
  ```

---

#### 3. Remaining Unvalidated Inputs

**backend/api/agents.py:350**
```python
result = subprocess.run(
    [
        "python3", str(GATEWAY_PATH),
        "--role", role,
        "--no-stream",
        "--history", history_path,
        "--context-id", session_id,
    ],
    ...
)
```
**Risk: HIGH**
- **Issue**: The `role` and `session_id` are not validated. An attacker could inject malicious values (e.g., `--role="; rm -rf /"`).
- **Fix**: Validate `role` against `PERSONA_ROLE_MAP` and `session_id` against a safe pattern.

---

**backend/api/stories.py:50**
```python
@stories_bp.route('/<story_id>', methods=['GET'])
@require_auth
def get_story(story_id):
    try:
        with closing(get_db_connection())
