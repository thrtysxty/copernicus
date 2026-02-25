#!/bin/bash
# scripts/migrate_platform_assets.sh
# Migrates agentic workflow assets to the new boilerplate repo.

BOILERPLATE_DIR="agentic-boilerplate"

# Ensure the script is run from the root of the repo
if [ ! -f "scripts/migrate_platform_assets.sh" ]; then
    echo "Error: Please run this script from the root of the repository."
    exit 1
fi

echo "Creating boilerplate directory at $BOILERPLATE_DIR..."
mkdir -p "$BOILERPLATE_DIR"
mkdir -p "$BOILERPLATE_DIR/docs/personas"
mkdir -p "$BOILERPLATE_DIR/scripts/utils"
mkdir -p "$BOILERPLATE_DIR/config/devices"
mkdir -p "$BOILERPLATE_DIR/backend"
mkdir -p "$BOILERPLATE_DIR/frontend"

echo "Copying configuration files..."
cp .pre-commit-config.yaml "$BOILERPLATE_DIR/"
cp claude_mcp_config.json "$BOILERPLATE_DIR/"
cp Makefile "$BOILERPLATE_DIR/"
cp .gitignore "$BOILERPLATE_DIR/"
cp requirements-stack.txt "$BOILERPLATE_DIR/"

echo "Copying personas..."
cp docs/personas/*.md "$BOILERPLATE_DIR/docs/personas/"

echo "Copying scripts..."
# Only copy necessary scripts
if [ -f "scripts/utils/device_audit.py" ]; then
    cp scripts/utils/device_audit.py "$BOILERPLATE_DIR/scripts/utils/"
else
    # Create a placeholder if not present, but it should be based on previous step
    # Or maybe I should just create it later in the plan
    # But for now, let's assume it exists or I will create it.
    # Actually, I will create a generalized version later, but for migration I will check if it exists.
    echo "scripts/utils/device_audit.py not found. Creating placeholder..."
    touch "$BOILERPLATE_DIR/scripts/utils/device_audit.py"
fi

echo "Creating placeholder files..."
touch "$BOILERPLATE_DIR/backend/.gitkeep"
touch "$BOILERPLATE_DIR/frontend/.gitkeep"

echo "Migration complete. Assets are in $BOILERPLATE_DIR."
