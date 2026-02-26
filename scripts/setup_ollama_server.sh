#!/usr/bin/env bash
# nosec
set -euo pipefail

CONTAINER="copernicus-ollama"
MODELS=(
  "nomic-embed-text"   # 274MB — semantic embeddings (Story 122)
  "qwen2.5:3b"         # 1.9GB — agent terminal LLM
  "phi3:mini"          # 2.2GB — local chat fallback
)

echo "[ollama-setup] Waiting for Ollama to be ready..."
until docker exec "$CONTAINER" ollama list > /dev/null 2>&1; do
  sleep 2
done

echo "[ollama-setup] Pulling models..."
for model in "${MODELS[@]}"; do
  echo "  → $model"
  docker exec "$CONTAINER" ollama pull "$model"
done

echo ""
echo "[ollama-setup] Installed models:"
docker exec "$CONTAINER" ollama list
