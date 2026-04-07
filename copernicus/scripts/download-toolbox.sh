#!/usr/bin/env bash
# Pinned to genai-toolbox v0.31.0
VERSION="v0.31.0"
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | sed 's/x86_64/amd64/')
DEST="scripts/agent-daemon/bin/toolbox"
curl -sSL "https://github.com/googleapis/genai-toolbox/releases/download/${VERSION}/toolbox_${PLATFORM}_${ARCH}" -o "$DEST"
chmod +x "$DEST"
