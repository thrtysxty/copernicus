# Troubleshooting

## Backend Won't Start

**Symptom:** `make dev` starts the frontend but the backend fails or shows connection errors.

1. Check the backend port isn't already in use: `lsof -i :5001`
2. Verify Python venv exists: `ls backend/venv/bin/python3`
3. Reinstall deps: `backend/venv/bin/pip install -r backend/requirements.txt`
4. Check config: `cat ~/Library/Application\ Support/copernicus/config.env`

## Ollama Not Detected

**Symptom:** Settings shows no models under Ollama.

1. Verify Ollama is running: `curl http://localhost:11434/api/tags`
2. If using a remote server, set `OLLAMA_BASE_URL` in config.env
3. Pull a model: `ollama pull llama3`

## Type Check Errors

**Symptom:** `make tsc` fails.

1. Ensure dependencies are current: `cd copernicus && npm install`
2. Clean build: `cd copernicus && rm -rf node_modules && npm install && npx tsc --noEmit`
3. If OOM, run with more heap: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`

## App State Issues

**Symptom:** UI shows stale data, settings won't save.

Reset application state:
```bash
make reset
# Or manually:
rm -rf ~/Library/Application\ Support/copernicus/
rm -rf ~/.copernicus/logs/
```

The app will show the Genesis Wizard on next launch.

## Electron Blank Screen

**Symptom:** Window opens but shows blank/white.

1. Open DevTools: `Cmd+Option+I`
2. Check the console for errors
3. Try clearing app data: `make reset`

## LLM Connection Errors

**Symptom:** "Failed to get response from provider" in chat.

1. Check API key in `~/.secrets`
2. Test key directly: `curl -H "Authorization: Bearer $KEY" https://api.anthropic.com/v1/messages`
3. Check network/proxy settings
4. Verify the model is available for your plan
