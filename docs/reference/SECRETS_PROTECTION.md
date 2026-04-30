# Secrets Protection — Three-Layer Defense

**Applies to:** All Copernicus developers working with Claude Code and the E2E test suite.

---

## Why This Matters

Claude Code is an agentic system with broad filesystem access. During a session it can read files,
run shell commands, and write outputs to conversation transcripts and logs. If a real API key
lands in any of those surfaces — even briefly — it may appear in:

- Conversation context (sent to Anthropic's API)
- `~/.claude/` log files
- Playwright traces and screenshots captured during E2E runs
- Git history if accidentally staged

The three layers below ensure credentials stay out of all of these paths.

---

## Layer 1 — Claude Code File-Read Deny Rules

**Story:** 702 | **Target:** `~/.claude/settings.json`

Claude Code's `permissions.deny` array blocks tool calls before they execute. These rules fire
even if Claude is instructed to read a file — the deny fires at the hook layer, before Claude
sees the content.

### What is blocked

| Pattern | Rationale |
|---------|-----------|
| `**/.env`, `**/.env.*` | App credential files — even if not used in this repo, deny is global |
| `**/*.pem`, `**/*.key`, `**/*.p12`, `**/*.pfx` | Private key material |
| `~/.ssh/id_*`, `~/.ssh/config` | SSH identity files |
| `~/.aws/credentials`, `~/.aws/config` | AWS credential store |
| `~/.npmrc`, `~/.pypirc`, `**/.netrc` | Package registry tokens |
| `printenv`, bare `env` | Bulk env-var dumps — the most common leak path |

### What is explicitly allowed

- `**/.env.example` — template files with no real values, safe to read and commit
- `**/.env.test` — E2E test environment file containing intentional dummies (see Layer 3)

### JSON snippet (add to `~/.claude/settings.json`)

```json
"permissions": {
  "deny": [
    { "tool": "Read",  "pattern": "**/.env" },
    { "tool": "Read",  "pattern": "**/.env.*", "except": ["**/.env.example", "**/.env.test"] },
    { "tool": "Read",  "pattern": "**/*.pem" },
    { "tool": "Read",  "pattern": "**/*.key" },
    { "tool": "Read",  "pattern": "~/.ssh/id_*" },
    { "tool": "Read",  "pattern": "~/.aws/credentials" },
    { "tool": "Read",  "pattern": "~/.aws/config" },
    { "tool": "Read",  "pattern": "~/.npmrc" },
    { "tool": "Bash",  "pattern": "*printenv*" },
    { "tool": "Bash",  "pattern": "env " }
  ]
}
```

> These deny rules apply to **all projects** on this machine because `~/.claude/settings.json`
> is global. Project-level `settings.local.json` can add more restrictions but cannot loosen
> global ones.

---

## Layer 2 — Pre-Commit Secret Scanner

**Story:** 703 | **Target:** `scripts/hooks/pre-commit-secrets.sh` + `.git/hooks/pre-commit`

A pre-commit hook scans **staged content only** (`git diff --cached`) before each commit.
If a staged file contains a known secret pattern, the commit is blocked with a filename,
line number, and the matched pattern.

### Install

```bash
bash scripts/hooks/install-hooks.sh
```

This adds the scanner as the first stage of `.git/hooks/pre-commit`. Running it twice is safe.
The `scaffold.ts` script installs this automatically for any new project created through Copernicus.

### Patterns that hard-block a commit

| Pattern | Example match |
|---------|---------------|
| `sk-ant-[a-zA-Z0-9]{10,}` | Anthropic API key |
| `sk-[a-zA-Z0-9]{20,}` | OpenAI / generic sk- key |
| `ghp_[a-zA-Z0-9]{36}`, `gho_`, `ghu_`, `ghs_`, `github_pat_` | GitHub personal access token |
| `AKIA[A-Z0-9]{16}` | AWS access key ID |
| `-----BEGIN (RSA\|EC\|DSA\|OPENSSH) PRIVATE KEY-----` | Private key material |
| `sk_live_[a-zA-Z0-9]{24,}` | Stripe live secret key |
| `xoxb-[a-zA-Z0-9-]{50,}`, `xoxp-` | Slack bot/user token |

### Patterns that warn but allow the commit

High-entropy strings adjacent to keywords (`secret`, `password`, `token`, `key`, `api_key`)
print `[WARN] possible secret at file:line` but do not block. This avoids false positives on
hashed values and encoded content.

### Exemptions

- `*.example` files — `.env.example`, `config.example.json`, etc.
- `*.test*` files — `.env.test`, test fixtures

### Override (use sparingly)

```bash
COPERNICUS_SKIP_SECRET_SCAN=1 git commit -m "..."
```

Only use this for intentional dummy/test values. If you need to override, add a comment in
the file explaining why the pattern is safe.

### Self-test

```bash
bash scripts/hooks/test-secret-scanner.sh
```

Runs the scanner against synthetic staged files for each pattern. All assertions print PASS/FAIL.

---

## Layer 3 — E2E Test Environment Isolation

**Story:** 704 | **Target:** `copernicus/.env.test` + `copernicus/e2e/fixture.ts`

The Playwright E2E suite launches Electron, which inherits `process.env` from the test runner.
If a developer has real API keys in their shell (sourced from `~/.secrets`), those keys are
live inside the test Electron process.

`copernicus/.env.test` overrides all credential env vars with intentional dummy values.
The E2E fixture reads this file and passes the sanitized env to `_electron.launch()`.

### How it works

```ts
// e2e/fixture.ts (simplified)
const testEnv = { ...process.env, ...loadEnvTest() }
const app = await _electron.launch({ env: testEnv, ... })
```

`loadEnvTest()` is a minimal inline parser — no external dotenv dependency.
Non-credential vars (`PATH`, `HOME`, `DISPLAY`, `COPERNICUS_E2E_HOME`, etc.) are inherited
unchanged. Only vars listed in `.env.test` are overridden.

### What is in `.env.test`

```bash
# E2E test environment — ALL values are intentional dummies.
# Real credentials MUST NOT be placed here. This file is committed.
ANTHROPIC_API_KEY=sk-test-dummy-anthropic-key-for-e2e-testing
OPENAI_API_KEY=sk-test-dummy-openai-key-for-e2e-testing
OPENROUTER_API_KEY=sk-test-dummy-openrouter-key-for-e2e-testing
GOOGLE_API_KEY=test-dummy-google-key-for-e2e-testing
GITHUB_TOKEN=ghp_dummy_token_for_e2e_testing_only
```

### Adding a new credential var

When a new credential env var is added to the Electron main process:

1. Add a dummy entry to `copernicus/.env.test`
2. Verify the smoke suite still passes (`npm run test:e2e:smoke`)
3. Confirm the var does not appear in a Playwright trace (`npx playwright show-trace`)

### Effect on `auth:status` smoke test

The smoke test checks that `auth:status` returns *a response* — not that authentication
succeeds. With a dummy key, `auth:status` returns `{ ok: false, error: 'invalid key' }` or
similar. The smoke assertion is `expect(result).toBeDefined()`, so it still passes.

---

## Secrets Convention (pre-existing)

All actual API keys for development live in `~/.secrets` and are sourced via:

```bash
source ~/.secrets
```

They are never placed in `.env` files inside any repository, never committed, and never
referenced directly in code (always via `process.env.VAR_NAME`).

The three layers above are defense-in-depth on top of this convention — not a replacement for it.

---

## Verification Checklist (run after initial setup)

- [ ] Attempt `cat ~/.secrets` in a Claude Code session — deny rule fires, read blocked
- [ ] Stage a file containing `sk-ant-test123456789` — pre-commit scanner blocks commit
- [ ] Run `npm run test:e2e:smoke` — 12/12 pass with dummy env vars
- [ ] Open a Playwright trace — no `sk-` prefix visible in trace JSON
