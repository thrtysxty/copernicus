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

## Presets

Export for team sharing:
```bash
ccr preset export copernicus-dev
# Creates ~/.claude-code-router/presets/copernicus-dev/
```
