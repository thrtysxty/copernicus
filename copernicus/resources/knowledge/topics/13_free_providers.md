Several AI providers offer free access — no credit card required. COPERNICUS works best with at least one configured.

**Completely free (recommended first steps):**

**Ollama — fully local, no account needed**
- Download from ollama.com and install (macOS, Windows, Linux)
- Run: `ollama pull llama3.1:8b` (or any model you want)
- No account, no API key, no internet required after download
- Connect: Settings → Auth → Ollama → set URL (default: http://localhost:11434)
- Best for: privacy-first users, offline use, cost-free chat

**Google AI Studio — free Gemini API key**
- Go to aistudio.google.com and sign in with a Google account
- Click "Get API Key" → Create API Key
- Paste the key in Settings → Auth → Google
- Free tier: generous daily quota for Gemini 1.5 Flash and Gemini 2.0 Flash
- Best for: free cloud AI with a fast, capable model

**OpenRouter — free models with a free account**
- Sign up at openrouter.ai (Google or email)
- Create an API key in your dashboard
- Free models include: Meta Llama 3.1 8B, Mistral 7B, Gemma variants
- Paste the key in Settings → Auth → OpenRouter
- Best for: sampling many models without committing to one provider

**Paid providers (no free tier, but worth it):**
- **Anthropic (Claude):** console.anthropic.com — best reasoning and coding; requires payment
- **OpenAI (GPT-4):** platform.openai.com — requires payment
- **DeepInfra:** deepinfra.com — very cheap per-token for open models; small signup credit

**Recommendation for new users:**
1. Install Ollama first (free, local, no limits)
2. Get a Google AI Studio key (free cloud fallback)
3. Add Anthropic when budget allows (highest quality for coding tasks)

**Note on Genesis Wizard:**
The Genesis project scaffold requires a capable model (7B parameters minimum). BitNet 2B and very small Ollama models are not sufficient. Use Google Gemini (free), OpenRouter free models (Llama 8B+), or Ollama with llama3.1:8b or larger.
