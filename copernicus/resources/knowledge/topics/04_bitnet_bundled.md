The bundled BitNet B1.58 2B model lets you use COPERNICUS with no internet connection and no API keys. It runs entirely on your CPU.

**Starting the bundled model:**
1. Open Settings → Local AI
2. Click **Start Server**
3. Wait for the status dot to turn green (may take 15–30 seconds while the model loads)
4. The model registers as an Ollama-compatible provider automatically

**Using BitNet for chat:**
- Once running, select "BitNet B1.58 2B (Local)" from the model selector in the chat panel
- BitNet is optimised for answering questions about COPERNICUS setup and configuration
- For complex code generation or multi-step reasoning, switch to a cloud provider or a larger Ollama model

**Limitations:**
- 2 billion parameters — adequate for simple Q&A, not reliable for complex code tasks
- Context window: 4096 tokens
- No internet access required — fully private

**Stopping the server:**
- Settings → Local AI → click **Stop Server**
- The server also stops automatically when COPERNICUS closes
