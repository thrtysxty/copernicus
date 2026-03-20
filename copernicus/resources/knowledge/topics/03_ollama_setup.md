Ollama lets you run open-source AI models locally with no API costs.

**Installation:**
1. Download Ollama from ollama.com and install it
2. Open a terminal and run: `ollama pull qwen2.5:7b` (or any model you want)
3. For codebase search embeddings, also run: `ollama pull nomic-embed-text`
4. Start Ollama: `ollama serve` (it may start automatically on login)

**Connecting to COPERNICUS:**
- COPERNICUS auto-detects Ollama at `http://localhost:11434`
- Open Settings → Auth → Ollama section to set a custom URL if Ollama runs on another machine (e.g. your R210ii server at `http://core:11434`)
- Open Settings → Models and select an Ollama model as your default

**Pulling models via COPERNICUS:**
- The startup wizard shows available Ollama models if Ollama is running
- Recommended models: `qwen2.5:7b` for chat, `nomic-embed-text` for search embeddings

**Ollama not showing in COPERNICUS?**
- Confirm Ollama is running: `curl http://localhost:11434/api/tags`
- Check the URL in Settings → Auth → Ollama
- Restart COPERNICUS after Ollama starts
