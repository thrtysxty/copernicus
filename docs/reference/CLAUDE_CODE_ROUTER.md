# Claude Code Router — Copernicus Integration

## Overview
Claude Code Router (`ccr`) is a proxy that routes Claude Code requests to different LLM providers (OpenRouter, Ollama, DeepSeek) with intelligent model switching.

## Architecture

```
Claude Code → ccr (port 3456) → Provider (OpenRouter/Ollama)
                     ↓
              Transformer Pipeline
```

## Current Configuration

| Route | Provider | Model |
|-------|----------|-------|
| `default` | OpenRouter | moonshotai/kimi-k2.5:cloud |
| `background` | Ollama | claude-sonnet-4-6 |
| `think` | OpenRouter | anthropic/claude-opus-4-6 |
| `longContext` | OpenRouter | anthropic/claude-opus-4-6 |
| `webSearch` | OpenRouter | google/gemini-2.5-pro-exp-03-25:free |
| `image` | OpenRouter | anthropic/claude-sonnet-4-6 |

## Commands

```bash
# Server management
ccr start              # Start router daemon
ccr stop               # Stop router daemon
ccr restart            # Restart router daemon
ccr status             # Show status

# Interactive usage
ccr code               # Launch Claude Code through router
ccr code "prompt"      # Single command through router
ccr model              # Interactive model configuration
ccr ui                 # Open web UI for configuration

# Presets
ccr preset export prod    # Export current config as preset
ccr preset list           # List presets
ccr preset install ./dir  # Install preset from directory
```

## Shell Integration

Add to `~/.zshrc`:

```bash
# Claude Code Router integration
if command -v ccr >/dev/null 2>&1; then
    eval "$(ccr activate)"
fi
```

This sets:
- `ANTHROPIC_BASE_URL=http://127.0.0.1:3456`
- `ANTHROPIC_AUTH_TOKEN=` (router handles auth)

## Model-Specific Routing

Use `/model` command in Claude Code to switch:

```
/model default      # Use default model
/model background   # Use background (cheaper) model
/model think        # Use thinking model
/model longContext  # Use long-context model
```

## Copernicus Workflow

1. **Development**: Use default (kimi-k2.5 via OpenRouter)
2. **Background tasks**: Use Ollama (local, cost-free)
3. **Complex architecture**: Use `/model think` → Claude Opus
4. **Image analysis**: Use `/model image` → Claude Sonnet

## Logs

```bash
ls ~/.claude-code-router/logs/
cat ~/.claude-code-router/logs/latest.log
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Router not responding | `ccr restart` |
| API key errors | Check `~/.secrets` exports |
| Model not found | Run `ccr model` to update |
| Timeout | Increase `API_TIMEOUT_MS` in config |

## Configuration File

Location: `~/.claude-code-router/config.json`

Key settings:
- `LOG`: Enable request/response logging
- `LOG_LEVEL`: debug, info, warn, error
- `API_TIMEOUT_MS`: Request timeout (default 600000)
- `longContextThreshold`: Tokens threshold for long-context routing

## Environment Variables

The config supports variable interpolation:
- `$OPENROUTER_API_KEY`
- `$OLLAMA_API_KEY`
- `$ANTHROPIC_API_KEY`

## Provider Route Precedence

The daemon uses explicit route priorities based on task intent. Local providers are preferred over paid cloud providers.

| Intent | Priority Order |
|--------|---------------|
| `background` | LOCAL_OLLAMA → LOCAL_MLX → CCR_FREE |
| `review` | CCR_FREE → LOCAL_OLLAMA → OPENROUTER |
| `coder` | CCR_FREE → LOCAL_OLLAMA → OPENROUTER |
| `planning` | CCR_FREE → OPENROUTER |

### Route Definitions

```js
const ROUTES = {
  LOCAL_MLX:    { id: 'mlx-native',   baseURL: 'http://localhost:8080/v1',      cost: 'zero' },
  LOCAL_OLLAMA: { id: 'ollama',        baseURL: 'http://localhost:11434/v1',   cost: 'zero' },
  CCR_FREE:     { id: 'ccr',           baseURL: 'http://127.0.0.1:9669',       cost: 'free' },
  OPENROUTER:   { id: 'openrouter',    baseURL: 'https://openrouter.ai/api/v1', cost: 'paid' }
};
```

### Liveness Checks

Each route is checked via `/v1/models` with a 1500ms timeout before dispatch. If no route is alive, `ProviderUnavailableError` is thrown with the intent and tried routes listed — never silent fallthrough to paid providers.

### Checking Infrastructure

```bash
# Check CCR, Ollama, and MLX availability
python scripts/check_infra.py

# JSON output for automation
python scripts/check_infra.py --json
```

Exit code 0 if CCR and Ollama are both alive; exit code 1 otherwise.

## Presets

Export for team sharing:
```bash
ccr preset export copernicus-dev
# Creates ~/.claude-code-router/presets/copernicus-dev/
```
