#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_PY="$(realpath "$SCRIPT_DIR/jules_daemon.py")"
PYTHON="$(which python3)"

# Allow --uninstall flag
UNINSTALL=false
for arg in "$@"; do [[ "$arg" == "--uninstall" ]] && UNINSTALL=true; done

platform="$(uname -s)"

if [[ "$platform" == "Darwin" ]]; then
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
  <key>StandardOutPath</key><string>/tmp/jules-daemon.log</string>
  <key>StandardErrorPath</key><string>/tmp/jules-daemon.log</string>
</dict>
</plist>
PLIST_EOF
  # Replace placeholders with actual paths
  sed -i '' "s|PYTHON_PATH|$PYTHON|g; s|DAEMON_PATH|$DAEMON_PY|g" "$PLIST"
  launchctl load "$PLIST"
  echo "Jules daemon registered — starts at login"

elif [[ "$platform" == "Linux" ]]; then
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
ExecStart=$PYTHON $DAEMON_PY
Restart=on-failure

[Install]
WantedBy=default.target
UNIT_EOF
  systemctl --user daemon-reload
  systemctl --user enable jules-daemon
  systemctl --user start jules-daemon
  echo "Jules daemon registered and started via systemd --user"

else
  echo "Unsupported platform: $platform" >&2
  exit 1
fi
