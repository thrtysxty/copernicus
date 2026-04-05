#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")" # Assuming script is in <REPO_ROOT>/scripts
DAEMON_PY="$(realpath "$SCRIPT_DIR/jules_daemon.py")"
PYTHON="$(which python3)"

SERVICE="jules" # Default service
UNINSTALL=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --uninstall)
      UNINSTALL=true
      ;;
    --service)
      if [[ -n "$2" && "$2" != --* ]]; then
        SERVICE="$2"
        shift
      else
        echo "Error: --service requires an argument (e.g., jules, flask)." >&2
        exit 1
      fi
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

platform="$(uname -s)"

if [[ "$platform" == "Darwin" ]]; then
  if [[ "$SERVICE" == "jules" ]]; then
    PLIST="$HOME/Library/LaunchAgents/com.copernicus.jules-daemon.plist"
    if $UNINSTALL; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      echo "Jules daemon unregistered (launchd)"
      exit 0
    fi
    # Idempotent: unload first if exists
    launchctl unload "$PLIST" 2>/dev/null || true
    mkdir -p "$(dirname "$PLIST")"
    cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.copernicus.jules-daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>PYTHON_PATH</string>
    <string>DAEMON_PATH</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/agent-daemon.log</string>
  <key>StandardErrorPath</key><string>/tmp/agent-daemon.log</string>
</dict>
</plist>
PLIST_EOF
    # Replace placeholders with actual paths
    sed -i '' "s|PYTHON_PATH|$(which node)|g; s|DAEMON_PATH|$REPO_ROOT/scripts/agent-daemon/index.mjs|g" "$PLIST"
    launchctl load "$PLIST"
    echo "Jules daemon registered — starts at login"
  elif [[ "$SERVICE" == "flask" ]]; then
    PLIST="$HOME/Library/LaunchAgents/com.copernicus.backend.plist"
    if $UNINSTALL; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      echo "Flask backend service unregistered (launchd)"
      exit 0
    fi
    launchctl unload "$PLIST" 2>/dev/null || true
    mkdir -p "$(dirname "$PLIST")"
    cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.copernicus.backend</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(which gunicorn)</string>
    <string>-c</string>
    <string>$REPO_ROOT/backend/gunicorn.conf.py</string>
    <string>backend.run_service:app</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/copernicus-backend.log</string>
  <key>StandardErrorPath</key><string>/tmp/copernicus-backend.log</string>
</dict>
</plist>
PLIST_EOF
    launchctl load "$PLIST"
    echo "Flask backend service registered — starts at login"
  elif [[ "$SERVICE" == "mcp-hub" ]]; then
    PLIST="$HOME/Library/LaunchAgents/com.copernicus.mcp-hub.plist"
    if $UNINSTALL; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      echo "MCP Hub service unregistered (launchd)"
      exit 0
    fi
    launchctl unload "$PLIST" 2>/dev/null || true
    mkdir -p "$(dirname "$PLIST")"
    cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.copernicus.mcp-hub</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON</string>
    <string>$SCRIPT_DIR/mcp_hub.py</string>
    <string>--transport</string>
    <string>tcp</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/copernicus-mcp-hub.log</string>
  <key>StandardErrorPath</key><string>/tmp/copernicus-mcp-hub.log</string>
</dict>
</plist>
PLIST_EOF
    launchctl load "$PLIST"
    echo "MCP Hub service registered — starts at login"
  else
    echo "Unknown service: $SERVICE" >&2
    exit 1
  fi

elif [[ "$platform" == "Linux" ]]; then
  if [[ "$SERVICE" == "jules" ]]; then
    UNIT="$HOME/.config/systemd/user/jules-daemon.service"
    if $UNINSTALL; then
      systemctl --user stop jules-daemon 2>/dev/null || true
      systemctl --user disable jules-daemon 2>/dev/null || true
      rm -f "$UNIT"
      systemctl --user daemon-reload
      echo "Jules daemon unregistered (systemd)"
      exit 0
    fi
    # Idempotent
    systemctl --user stop jules-daemon 2>/dev/null || true
    systemctl --user disable jules-daemon 2>/dev/null || true
    mkdir -p "$(dirname "$UNIT")"
    cat > "$UNIT" << UNIT_EOF
[Unit]
Description=Copernicus Jules Daemon

[Service]
ExecStart=$(which node) $REPO_ROOT/scripts/agent-daemon/index.mjs
Restart=on-failure

[Install]
WantedBy=default.target
UNIT_EOF
    systemctl --user daemon-reload
    systemctl --user enable jules-daemon
    systemctl --user start jules-daemon
    echo "Jules daemon registered and started via systemd --user"
  elif [[ "$SERVICE" == "flask" ]]; then
    UNIT="$HOME/.config/systemd/user/copernicus-backend.service"
    if $UNINSTALL; then
      systemctl --user stop copernicus-backend 2>/dev/null || true
      systemctl --user disable copernicus-backend 2>/dev/null || true
      rm -f "$UNIT"
      systemctl --user daemon-reload
      echo "Flask backend service unregistered (systemd)"
      exit 0
    fi
    systemctl --user stop copernicus-backend 2>/dev/null || true
    systemctl --user disable copernicus-backend 2>/dev/null || true
    mkdir -p "$(dirname "$UNIT")"
    cat > "$UNIT" << UNIT_EOF
[Unit]
Description=Copernicus Flask Backend Service

[Service]
ExecStart=$(which gunicorn) -c $REPO_ROOT/backend/gunicorn.conf.py backend.run_service:app
Restart=on-failure

[Install]
WantedBy=default.target
UNIT_EOF
    systemctl --user daemon-reload
    systemctl --user enable copernicus-backend
    systemctl --user start copernicus-backend
    echo "Flask backend service registered and started via systemd --user"
  elif [[ "$SERVICE" == "mcp-hub" ]]; then
    UNIT="$HOME/.config/systemd/user/copernicus-mcp-hub.service"
    if $UNINSTALL; then
      systemctl --user stop copernicus-mcp-hub 2>/dev/null || true
      systemctl --user disable copernicus-mcp-hub 2>/dev/null || true
      rm -f "$UNIT"
      systemctl --user daemon-reload
      echo "MCP Hub service unregistered (systemd)"
      exit 0
    fi
    systemctl --user stop copernicus-mcp-hub 2>/dev/null || true
    systemctl --user disable copernicus-mcp-hub 2>/dev/null || true
    mkdir -p "$(dirname "$UNIT")"
    cat > "$UNIT" << UNIT_EOF
[Unit]
Description=Copernicus MCP Hub Service

[Service]
ExecStart=$PYTHON $SCRIPT_DIR/mcp_hub.py --transport tcp
Restart=on-failure

[Install]
WantedBy=default.target
UNIT_EOF
    systemctl --user daemon-reload
    systemctl --user enable copernicus-mcp-hub
    systemctl --user start copernicus-mcp-hub
    echo "MCP Hub service registered and started via systemd --user"
  else
    echo "Unknown service: $SERVICE" >&2
    exit 1
  fi
else
  echo "Unsupported platform: $platform" >&2
  exit 1
fi
