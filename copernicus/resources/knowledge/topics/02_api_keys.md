API keys let COPERNICUS connect to cloud AI providers for chat, code generation, and embeddings.

**Adding a key:**
1. Click the gear icon in the Activity Bar to open Settings
2. Go to the **Auth** section
3. Find your provider (Anthropic, OpenAI, Google, OpenRouter, DeepInfra)
4. Paste your API key and click Save
5. The status dot turns green when the key is valid

**Provider notes:**
- **Anthropic (Claude):** Key starts with `sk-ant-`. Get one at console.anthropic.com
- **OpenAI (GPT-4):** Key starts with `sk-`. Get one at platform.openai.com
- **Google (Gemini):** Uses OAuth — click "Connect Google" and sign in. Also supports API key from AI Studio
- **OpenRouter:** Single key to access 100+ models. Get one at openrouter.ai
- **DeepInfra:** Cheap inference for open models. Get one at deepinfra.com

Keys are encrypted and stored locally using Electron's safeStorage. They are never transmitted except to the provider's own API.

**No API key?** Use the bundled BitNet model (Settings → Local AI) or install Ollama locally.
