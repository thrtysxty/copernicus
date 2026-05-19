# Configuration

## Secrets (~/.secrets)

Required and optional API keys. Copy from `secrets.example`:

| Key | Required? | Purpose |
|-----|-----------|---------|
| `ANTHROPIC_API_KEY` | Yes (one provider) | Claude models |
| `OPENAI_API_KEY` | Optional | GPT models |
| `OPENROUTER_API_KEY` | Optional | 200+ models via one key |
| `DEEPINFRA_API_KEY` | Optional | Open-weight inference |
| `GOOGLE_API_KEY` | Optional | Gemini models |
| `JULES_API_KEY` | Optional | Async PR agent dispatch |
| `GITHUB_TOKEN` | Optional | PR/issue management |
| `TAVILY_API_KEY` | Optional | Web search for research |

## App Config (config.env)

Non-secret settings. Located at:
- macOS: `~/Library/Application Support/copernicus/config.env`
- Linux: `~/.config/copernicus/config.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `COPERNICUS_BACKEND_URL` | `http://127.0.0.1:5001` | Backend API URL |
| `COPERNICUS_BACKEND_PORT` | `5001` | Backend port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OpenTelemetry endpoint |
| `COPERNICUS_LOG_LEVEL` | `INFO` | Log verbosity (DEBUG, INFO, WARNING, ERROR) |
| `MLX_PROVIDER_URL` | `http://localhost:8080/v1` | MLX inference server URL |

## Environment Variables

All config.env variables can also be set as environment variables, which take precedence over config.env values.
