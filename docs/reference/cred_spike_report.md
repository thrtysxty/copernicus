# Cred Agent OAuth Delegation — Research Spike Report

**Story:** 390
**Date:** 2026-03-17
**Status:** Go (with prerequisites)
**Verdict:** Partial Go — self-hostable OAuth vault is viable using HashiCorp Vault or a custom TTL layer over `safeStorage`; the Cred hosted product itself requires verification against self-host requirements before committing.

---

## 1. Self-Host Assessment

**The problem:** `AuthManager.getApiKey()` returns raw plaintext keys to any caller. A looping or compromised agent holds a permanent credential with no expiry or scope limit.

**Cred (cred.ninja) overview:** Cred is an OAuth 2.0 token delegation service that vaults credentials and issues short-lived, scoped tokens to agents. The hosted product uses AWS KMS for vault encryption. **AWS KMS dependency is a non-starter** for our sovereign R620 deployment.

**Self-host path:**

| Option | Feasibility on R620 | Notes |
|--------|---------------------|-------|
| HashiCorp Vault (open source) | ✅ High | Runs on Linux, supports Transit secrets engine (software-backed encryption, no KMS required), excellent API, battle-tested. ~512MB RAM. |
| age (file-based encryption) | ⚠️ Medium | Good for static secrets, no built-in token TTL or revocation. Requires wrapping layer. |
| Electron `safeStorage` + TTL wrapper | ✅ High | Lowest operational overhead. Store encrypted keys in safeStorage; issue in-process tokens with expiry. No external service needed for local flows. |
| Cred hosted + self-hosted vault backend | 🔴 Risky | Depends on whether Cred supports pluggable vault backends. **Requires direct verification with Cred.** |

**Recommendation for R620:** Implement a `CredVault` service in the Electron main process backed by `safeStorage` for key storage + an in-memory token registry for short-lived tokens. For remote agent flows (agents running on R620 reaching external APIs), deploy HashiCorp Vault on the R620 itself.

---

## 2. MCP SDK Evaluation

**Cred MCP SDK:** Cred exposes an MCP tool server that agents can call to request tokens. The conceptual interface:

```
tool: cred_get_token
  input: { provider: "github", scope: "repo:read", agent_id: "jules-session-abc" }
  output: { token: "gho_xxx", expires_in: 3600, receipt: "<ed25519-signed>" }
```

**Current `AuthManager.getApiKey()` interface:**
```typescript
// copernicus/electron/auth-manager.ts
public getApiKey(provider: ProviderType): string | null
```

**Proposed replacement:**
```typescript
// New interface
public async getDelegatedToken(provider: string, scope: string, agentId: string): Promise<DelegatedToken | null>
interface DelegatedToken { token: string; expiresAt: Date; receiptId: string }
```

**Integration path:** Add `CredVault` as an optional layer in `AuthManager`. If `CredVault` is configured (settings flag `auth.useCredVault: true`), `getApiKey()` routes through `getDelegatedToken()` instead. Existing callers get the token string transparently — no call-site changes needed for the common case.

**MCP wiring:** Add a `cred-vault` MCP server entry to `claude_mcp_config.json` pointing to `http://localhost:8200` (HashiCorp Vault) or to the Electron-native vault service via IPC.

---

## 3. Token Lifecycle Design

**Proposed lifetimes:**

| Provider | Scope | Lifetime | Rationale |
|----------|-------|---------|-----------|
| GitHub | `repo:read` | 1 hour | Read-only, low risk |
| GitHub | `repo:write` | 15 minutes | Write access, short window |
| Linear | `issues:write` | 30 minutes | Task management operations |
| Slack | `messages:write` | 30 minutes | Notifications only |
| Anthropic API | — | Session-scoped | API key, not OAuth — use existing flow |

**Scope granularity:** Per-provider + per-operation. Not per-file or per-request — too fine-grained for practical use.

**Revocation UX:**
- Settings → Providers → each provider card shows "Agent Access" toggle + last-issued timestamp
- "Revoke All Agent Tokens" button calls `auth:revoke-agent` IPC → invalidates all tokens in the registry
- `agent_tokens` table in state ledger records issuances for audit trail

**Token registry (in-process):**
```typescript
// In-memory Map in main process
interface TokenEntry { agentId: string; provider: string; scope: string; token: string; expiresAt: Date; revokedAt?: Date }
```

---

## 4. Migration Path

**Changes required:**

| File | Change | Size |
|------|--------|------|
| `copernicus/electron/auth-manager.ts` | Add `getDelegatedToken()`, `revokeAgentTokens()`, optional CredVault routing | M |
| `copernicus/electron/ipc/auth-handlers.ts` | Add `auth:delegate`, `auth:revoke-agent` IPC handlers | S |
| `copernicus/electron/preload.ts` | Add `auth:delegate`, `auth:revoke-agent` to SEND_CHANNELS | S |
| `copernicus/src/renderer/components/settings/sections/ProvidersSection.tsx` | Add "Agent Access" toggle + revoke button per provider | S |
| `copernicus/electron/db/state-ledger.ts` | Add `agent_tokens` table schema + `logTokenIssuance()` | S |
| `copernicus/electron/vault/CredVault.ts` | New — in-process vault backed by safeStorage | M |
| `copernicus/electron/vault/HashiCorpVaultClient.ts` | New — optional remote vault for R620 deployment | M |

**Estimated story count:** 6–8 stories (S=1 point, M=2 points, 2 L stories for vault implementation)

**Existing callers of `getApiKey()`:** ~12 call sites across `llm/service.ts`, workflow engine, auth handlers. All return the token string — backward-compatible if `getDelegatedToken()` returns the token string via the same interface.

---

## 5. Go / No-Go Recommendation

**Verdict: Partial Go**

**Go on the pattern:** Short-lived token delegation is the right security model for agents calling external APIs. The migration is well-bounded and backward-compatible.

**Go on self-host:** HashiCorp Vault (open source) on R620 is production-ready, replaces AWS KMS entirely, and costs $0. Alternatively, the Electron-native `safeStorage` + in-process TTL registry covers local-only flows with zero operational overhead.

**Verify before committing to Cred hosted product:**
- [ ] Confirm whether Cred's vault backend is pluggable (replaceable with HashiCorp Vault)
- [ ] Confirm the MCP SDK works with Electron's IPC bridge (no browser-only APIs)
- [ ] Review Cred's data residency policy — all tokens must stay on-prem

**Recommended next step:** Implement the in-process `CredVault` + `agent_tokens` table first (2 stories). Evaluate Cred hosted product in parallel. If Cred self-host is confirmed feasible, swap the vault backend without touching any other code.

**If No-Go on Cred:** The in-process solution (safeStorage + TTL registry) is sufficient for v1. It covers the core security concern (agents don't hold permanent keys) without operational complexity.

---

## Follow-On Stories (if Go)

1. `agent_tokens` table + `logTokenIssuance()` in state ledger
2. `CredVault.ts` — in-process vault with safeStorage backend + TTL enforcement
3. `AuthManager` — add `getDelegatedToken()` + opt-in routing
4. `auth:delegate` + `auth:revoke-agent` IPC handlers
5. ProvidersSection — Agent Access toggle + revoke UX
6. (Optional) `HashiCorpVaultClient.ts` — remote vault for R620
