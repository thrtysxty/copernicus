# Provider Setup Guide

This guide covers detailed setup for every AI provider Copernicus supports. The setup wizard handles the basics; this document covers advanced configuration, model selection, troubleshooting, and edge cases.

API keys are stored in `~/.secrets`. Run `source ~/.secrets` to load them into your shell, or let the IDE load them automatically at startup.

---

## Anthropic

**Key location:** `~/.secrets` as `ANTHROPIC_API_KEY`
**How to get a key:** console.anthropic.com → API Keys

### Model tiers

| Model | Speed | Cost | Best for |
|---|---|---|---|
| `claude-opus-4-6` | Slow | High | Complex planning, architecture |
| `claude-sonnet-4-6` | Fast | Medium | Implementation, review, chat |
| `claude-haiku-4-5-20251001` | Very fast | Low | Classification, quick lookups |

All models support vision (image input) except older Haiku variants. Sonnet 4.6 is the default for the review gate.

### Rate limits
Free tier: limited RPM and tokens/day. Paid tier limits depend on usage tier (T1–T5). If you hit 429s in the chat panel, check your tier at console.anthropic.com → Usage.

### Troubleshooting
- **401 Unauthorized** — Key is wrong or expired. Regenerate at console.anthropic.com.
- **429 rate_limit_error** — Reduce concurrent sessions or upgrade tier.
- **overloaded_error** — Anthropic capacity issue, not your key. Retry in a few seconds.

---

## Google / Gemini

**Key location:** `~/.secrets` as `GOOGLE_API_KEY`
**How to get a key:** aistudio.google.com → Get API Key

### API key vs OAuth

Use **API key** for most cases: text, code, Gemini Pro/Flash access.

Use **OAuth** when: accessing Google Drive sources in NotebookLM, or using Gemini features that require user account identity. The OAuth flow is triggered automatically when a Drive-sourced notebook is selected.

### Token limits
Gemini 2.5 Flash: 1M context window. Gemini 2.5 Pro: 2M context. Useful for long-document analysis or multi-file context injection.

### Safety settings
Gemini applies safety filters by default. If the model refuses requests that other providers allow, adjust safety settings in your GCP project console or use a different model.

### Troubleshooting
- **API_KEY_INVALID** — Key not enabled for Generative Language API. Enable it in GCP console → APIs & Services.
- **RESOURCE_EXHAUSTED** — Free tier quota hit. The Gemini free tier resets daily; paid billing removes this.
- **oauth_callback mismatch** — OAuth redirect URI doesn't match. See `docs/reference/GOOGLE_OAUTH_SETUP.md` for the exact setup steps.

---

## OpenAI

**Key location:** `~/.secrets` as `OPENAI_API_KEY`
**How to get a key:** platform.openai.com → API Keys

### Model selection
- `gpt-4o` — Vision, function calling, large context
- `gpt-4o-mini` — Fast and cheap, good for summaries and routing
- `o1` / `o3` — Reasoning models; slower, no streaming

### Org ID
If your key is under an organization, add `OPENAI_ORG_ID=""` to `~/.secrets` as well. Copernicus picks it up automatically.

### Troubleshooting
- **insufficient_quota** — Billing not set up or prepaid credits exhausted. Add payment at platform.openai.com.
- **model_not_found** — Your tier doesn't have access to the requested model. Upgrade or switch to `gpt-4o-mini`.

---

## OpenRouter

**Key location:** `~/.secrets` as `OPENROUTER_API_KEY`
**How to get a key:** openrouter.ai → Keys

OpenRouter aggregates hundreds of models from multiple providers under one API key. Useful for:
- Accessing models not directly available in your region
- Cost comparison between providers
- Failover when a provider is down

### How credits work
Pre-purchase credits at openrouter.ai. Each model has a per-token rate listed in the model catalogue. Credits don't expire.

### Cost vs direct-provider pricing
OpenRouter adds a small markup over provider list prices. For high-volume use, direct provider keys are cheaper. For low-volume exploration, OpenRouter's unified key is more convenient.

### Troubleshooting
- **No endpoints available** — The specific model is at capacity on OpenRouter's routing pool. Try a different model or retry in a few minutes.
- **402 Payment Required** — Credits depleted. Top up at openrouter.ai.

---

## DeepInfra

**Key location:** `~/.secrets` as `DEEPINFRA_API_KEY`
**How to get a key:** deepinfra.com → API Keys

DeepInfra hosts open-weight models (DeepSeek, Qwen, Mistral, etc.) at competitive rates. Good choice for:
- Large reasoning models (DeepSeek-V3, Qwen 2.5)
- Tasks where Anthropic/OpenAI pricing is prohibitive
- Batch document processing

### When to prefer DeepInfra over OpenRouter
When you know the specific model you want and DeepInfra hosts it — their inference is often faster and cheaper than the same model through OpenRouter.

### Troubleshooting
- **401** — Key invalid or expired. Regenerate at deepinfra.com.
- **503** — Model is loading (cold start). Wait 10–30 seconds and retry.

---

## Ollama (Local)

**No API key required.**
**Config:** Set `OLLAMA_BASE_URL` in `~/Library/Application Support/copernicus/config.env` (leave blank for `localhost:11434`)

### Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

Start the daemon: `ollama serve` (or it starts automatically on macOS after install).

### Pull models

```bash
ollama pull llama3.2          # 3B, fast
ollama pull qwen2.5:14b       # 14B, good coding
ollama pull deepseek-r1:7b    # reasoning
ollama pull qwen3-embedding:0.6b  # for semantic search
```

### Remote Ollama instance
If running Ollama on a separate machine (e.g., your R210 server):
```
OLLAMA_BASE_URL=http://192.168.1.185:11434
```
Set this in `~/Library/Application Support/copernicus/config.env`.

### Auth status
For Ollama, Copernicus shows auth as "Connected" when `ollama serve` is reachable at the configured URL. No key exchange — reachability is the check.

### Troubleshooting
- **Cannot reach Ollama** — Check `ollama serve` is running. On macOS, Ollama may not auto-start after a restart; run it manually or add it to login items.
- **Model not found** — Run `ollama pull <model>` first.
- **Slow responses** — You're CPU-inferencing. Pull a smaller model or use a machine with a GPU.

---

## NotebookLM

> 📌 **Pending Stories 432–433** — NotebookLM integration is not yet available. This section will be populated when those stories ship.

Once available:
- Use `notebooklm login` from the setup wizard to authenticate
- Select a notebook as a context source in the Chat panel
- Credentials are stored in `~/Library/Application Support/copernicus/` (never in `~/.secrets`)
