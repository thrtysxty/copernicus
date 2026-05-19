# Model Routing and Providers

Copernicus routes requests to LLM providers through a unified interface. Switch models mid-conversation without losing context.

## Supported Providers

| Provider | Auth | Dynamic Models |
|----------|------|-----------------|
| **Anthropic** | API key | Claude Opus, Sonnet, Haiku |
| **OpenAI** | API key | All models your key can access |
| **Google** | API key | All Gemini models your key can access |
| **OpenRouter** | API key or OAuth | 200+ models |
| **DeepInfra** | API key | Open-weight models |
| **Ollama** | None (local) | All locally pulled models |

## Model Hot-Swap

Click the model badge in the chat header to switch models mid-conversation. Context carries over — the new model receives the full conversation history.

## Vision Routing

Models with the `supportsVision` flag automatically receive image payloads. Models without it skip images. Configure per-model in Settings → Models.

## Cost Tracking

Every LLM call is logged with model, provider, token count, and cost. View the CapEx dashboard (Financial tab) for per-model spending breakdowns.

## Ollama Setup

1. Install from ollama.com
2. Pull models: `ollama pull llama3`, `ollama pull codellama`
3. Copernicus auto-discovers running models
4. For remote Ollama, set `OLLAMA_BASE_URL` in config.env

## Apple Silicon (MLX)

On M-series Macs, Copernicus can run local models via MLX:
1. `pip install mlx-lm`
2. Configure in Settings → Hardware
3. Default models: Qwen2.5-Coder-7B (coder), DeepSeek-R1-Distill-7B (reviewer), Mistral-7B (planner)
