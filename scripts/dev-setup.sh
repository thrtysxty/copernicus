#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Copernicus — Developer Setup${NC}"
echo ""

# ── Prerequisites ──────────────────────────────────────────────────────────
fail() { echo -e "${RED}FAIL: $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}WARN: $1${NC}"; }
ok()   { echo -e "${GREEN}OK:   $1${NC}"; }

# Node.js >= 18
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  [[ "$NODE_VER" -lt 18 ]] && fail "Node.js $NODE_VER found, need >= 18" || ok "Node.js $(node --version)"
else
  fail "Node.js not installed. Install from https://nodejs.org or: brew install node"
fi

# Python >= 3.11
if command -v python3 &>/dev/null; then
  PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
  PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
  [[ "$PY_MAJOR" -lt 3 || "$PY_MINOR" -lt 11 ]] && fail "Python $PY_VER found, need >= 3.11" || ok "Python $PY_VER"
else
  fail "Python 3 not installed. Install from https://python.org or: brew install python@3.11"
fi

# gh CLI (optional)
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  ok "gh CLI (authenticated)"
else
  warn "gh CLI not installed/authenticated. Install: brew install gh && gh auth login"
fi

# Ollama (optional)
if command -v ollama &>/dev/null; then
  ok "Ollama $(ollama --version 2>/dev/null || echo 'installed')"
else
  warn "Ollama not installed. Optional for cloud-only use. Install from ollama.com"
fi

# ── Install Dependencies ────────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."

# Python venv
VENV="backend/venv"
if [[ ! -d "$VENV" ]]; then
  python3 -m venv "$VENV"
  echo "  Created Python venv"
fi
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r backend/requirements.txt

# macOS-only: MLX for Apple Silicon local inference
if [[ "$(uname)" == "Darwin" ]] && [[ -f "backend/requirements-macos.txt" ]]; then
  "$VENV/bin/pip" install --quiet -r backend/requirements-macos.txt || warn "MLX install failed (non-Apple Silicon? Safe to ignore)"
fi
ok "Python dependencies"

# JS dependencies
if [[ ! -d "copernicus/node_modules" ]]; then
  (cd copernicus && npm install --silent)
fi
ok "JavaScript dependencies"

# ── Configuration ────────────────────────────────────────────────────────────
echo ""
echo "Setting up configuration..."

# App config dir
CONFIG_DIR=""
if [[ "$OSTYPE" == "darwin"* ]]; then
  CONFIG_DIR="$HOME/Library/Application Support/copernicus"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CONFIG_DIR="$HOME/.config/copernicus"
fi

if [[ -n "$CONFIG_DIR" ]]; then
  mkdir -p "$CONFIG_DIR"
  if [[ ! -f "$CONFIG_DIR/config.env" ]] && [[ -f ".env.example" ]]; then
    cp .env.example "$CONFIG_DIR/config.env"
    echo "  Copied .env.example → $CONFIG_DIR/config.env"
  fi
fi

# Secrets
if [[ ! -f "$HOME/.secrets" ]] && [[ -f "secrets.example" ]]; then
  cp secrets.example "$HOME/.secrets"
  echo -e "${YELLOW}  Copied secrets.example → ~/.secrets${NC}"
  echo -e "${RED}  ⚠ Edit ~/.secrets and add your API keys${NC}"
else
  ok "~/.secrets exists"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Setup complete! Run 'make dev' to start.${NC}"
