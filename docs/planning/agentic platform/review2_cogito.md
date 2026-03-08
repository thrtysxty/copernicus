# Code Review #2 — cogito

Here are the critical findings from my review, organized by severity:

**[CRITICAL]** `backend/api/agents.py:302` — Subprocess injection via `prompt` parameter in research endpoint — risk: Remote Code Execution
- The `prompt` parameter is passed directly to `subprocess.run` without any sanitization
- An attacker could inject command separators (e.g., `; rm -rf /`) in the prompt
- Fix: Use `shlex.quote()` on user input or switch to an allowlist-based approach

**[CRITICAL]** `backend/utils/validate.py:10` — Path validation bypass via symlinks — risk: Path Traversal
- `_is_path_violating` checks for `..` but doesn't resolve symlinks
- An attacker could create symlinks to bypass the path guard
- Fix: Use `os.path.realpath()` to resolve symlinks before validation

**[HIGH]** `backend/api/agents.py:100` — In-memory session storage — risk: Denial of Service
- `ContextManager` stores all sessions in memory with no eviction policy
- An attacker could create unlimited sessions to exhaust memory
- Fix: Implement LRU cache or persistent storage with size limits

**[HIGH]** `backend/api/agents.py:500` — SQL injection in context handoff — risk: SQL Injection
- Direct string interpolation in SQL query with `story_id`
- Fix: Use parameterized queries for all SQL statements

**[HIGH]** `backend/utils/path_guard.py:1` — Incomplete path validation — risk: Path Traversal
- Allows paths starting with allowed roots but doesn't prevent `../` after valid prefix
- Fix: Use `pathlib.Path.resolve()` and ensure resolved path starts with allowed root

**[MEDIUM]** `backend/api/agents.py:385` — Temporary file race condition — risk: Information Disclosure
- Uses predictable temporary filenames without `O_EXCL` flag
- Fix: Use `tempfile.mkstemp()` with proper flags

**[MEDIUM]** `backend/api/agents.py:1` — Missing rate limiting — risk: Denial of Service
- No rate limiting on any API endpoints
- Fix: Implement request rate limiting

**[MEDIUM]** `backend/providers/factory.py:1` — No input validation in provider factory — risk: SSRF/API Abuse
- Provider names not validated before use
- Fix: Validate against allowlist of known providers

**[LOW]** `backend/api/agents.py:1` — Insecure default token limits — risk: Service Degradation
- Default token limit of 8192 may be too high for some models
- Fix: Make token limits configurable per-model

**[LOW]** `backend/api/stories.py:1` — No input validation on story IDs — risk: IDOR
- Story IDs passed directly to SQL queries without validation
- Fix: Validate story IDs match expected format (UUID)

**[LOW]** `backend/utils/errors.py:1` — Information leakage in error messages — risk: Information Disclosure
- Full exception messages returned to client
- Fix: Sanitize error messages in production

**[ARCHITECTURE]** `backend/api/agents.py:1` — Tight coupling between API and business logic — risk: Maintenance Issues
- Business logic (ContextManager) mixed with API handlers
- Fix: Extract business logic to separate service layer

**[ARCHITECTURE]** `copernicus/electron/ipc/*` — IPC handlers doing too much — risk: Unmaintainable Code
- Many handlers contain complex business logic
- Fix: Extract business logic from IPC handlers

**[ARCHITECTURE]** `dev_orchestrator/cloud_agent.py:1` — Hardcoded credentials — risk: Security Breach
- API keys and URLs hardcoded in source
- Fix: Move to configuration files or environment variables

These issues should be prioritized based on severity, with critical security issues addressed first.
