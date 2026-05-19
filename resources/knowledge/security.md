# Security

Copernicus has multiple security layers to protect your code and credentials.

## API Key Encryption

All API keys are stored using Electron's `safeStorage` encryption. Keys are never stored in plaintext on disk. The encryption key is managed by the OS keychain (macOS Keychain, Linux Secret Service).

## CORS Configuration

Backend CORS origins are env-configurable via `config.env`. In production, wildcards are not allowed — only explicitly listed origins are accepted.

## GitGuard

A pre-commit hook that scans staged files for secrets (API keys, tokens, private keys). If a potential secret is detected, the commit is blocked.

## SandboxManager

Per-agent filesystem isolation via IPC. Agents can only write to directories explicitly granted by the user. This prevents agents from modifying files outside their scope.

## SecurityManager

Monitors file writes and shell output for dangerous patterns:
- File deletion (`rm -rf`)
- Credential exposure in logs
- Privilege escalation attempts

Alerts are logged to `security-alerts.jsonl`.

## Ollama Network Binding

The Docker Compose configuration for Ollama binds to `127.0.0.1:11434` only — it is not exposed on the network. This is enforced in `docker-compose.ollama.yml`.
