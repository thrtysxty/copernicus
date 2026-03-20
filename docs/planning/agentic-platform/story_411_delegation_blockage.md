I am blocked from proceeding with Story 411. My attempts to delegate the implementation to both cloud-based and local Ollama sub-agents have failed due to infrastructure issues:

1.  **Cloud Delegation (`coder` role):** Failed with "model 'qwen3-coder-next' not found (status code: 404)". This indicates the specified cloud model is unavailable or misconfigured.
2.  **Local Ollama Delegation (`senior-dev` role):** Failed with two errors:
    *   `urllib.error.URLError: <urlopen error [Errno 61] Connection refused>`: The local server for persona registry (`localhost:5001`) is not running or is inaccessible.
    *   `Error: pull model manifest: file does not exist` and `Error executing model: Command '['ollama', 'run', 'senior-dev', ...]` The 'senior-dev' Ollama model is not found or its manifest is missing.

These issues prevent me from delegating the implementation task as per my instructions. I cannot proceed until these underlying infrastructure problems are resolved.