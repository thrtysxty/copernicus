#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Initialize status arrays
declare -A CHECKS
declare -A MESSAGES

# Function to check versions
version_check() {
    local name=$1
    local command=$2
    local min_major=$3
    local var_name=$4
    local current_version_full
    local current_major_version
    local is_fail=false

    if ! command -v "$command" &> /dev/null; then
        CHECKS["$name"]="FAIL"
        MESSAGES["$name"]="FAIL: $name is not installed."
        is_fail=true
    else
        current_version_full=$("$command" --version 2>&1)
        if [[ "$name" == "Node.js" ]]; then
            current_major_version=$(echo "$current_version_full" | cut -d 'v' -f 2 | cut -d '.' -f 1)
        elif [[ "$name" == "Python" ]]; then
            current_major_version=$(echo "$current_version_full" | cut -d ' ' -f 2 | cut -d '.' -f 1)
        else
            # For other tools, just get the first number
            current_major_version=$(echo "$current_version_full" | grep -oP '(?<!\.)\b\d+' | head -n 1)
        fi

        if [[ "$current_major_version" -lt "$min_major" ]]; then
            CHECKS["$name"]="FAIL"
            MESSAGES["$name"]="FAIL: $name version $current_major_version is less than $min_major."
            is_fail=true
        else
            CHECKS["$name"]="PASS"
            MESSAGES["$name"]="PASS: $name ($current_version_full)"
        fi
    fi
    export $var_name="$current_major_version" # Export the major version
    return $is_fail # Return true if failed, false otherwise
}

echo -e "${GREEN}Running Developer First-Launch Setup...${NC}"

# 1. Prerequisites check
echo "Checking prerequisites..."

NODE_MAJOR_VERSION=""
PYTHON_MAJOR_VERSION=""

version_check "Node.js" "node" 18 "NODE_MAJOR_VERSION"
version_check "Python" "python3" 3 "PYTHON_MAJOR_VERSION" # Note: Python 3.11+ is required, but python3 --version often shows "Python 3.x.y". We'll check for 3 as the major and rely on pip to handle exact minor.

# Special check for Python minor version if major is 3
if [[ "${CHECKS["Python"]}" == "PASS" && "$PYTHON_MAJOR_VERSION" -eq 3 ]]; then
    PYTHON_MINOR_VERSION=$(python3 --version 2>&1 | cut -d ' ' -f 2 | cut -d '.' -f 2)
    if [[ "$PYTHON_MINOR_VERSION" -lt 11 ]]; then
        CHECKS["Python"]="FAIL"
        MESSAGES["Python"]="FAIL: Python version 3.$PYTHON_MINOR_VERSION is less than 3.11."
    fi
fi


# gh CLI check
if ! command -v gh &> /dev/null; then
    CHECKS["gh CLI"]="WARN"
    MESSAGES["gh CLI"]="WARN: gh CLI is not installed. Not required for all operations. Install with 'brew install gh' (macOS) or see https://cli.github.com/manual/gh_installation for other OS."
else
    if ! gh auth status &> /dev/null; then
        CHECKS["gh CLI"]="WARN"
        MESSAGES["gh CLI"]="WARN: gh CLI is not authenticated. Run 'gh auth login' to authenticate."
    else
        CHECKS["gh CLI"]="PASS"
        MESSAGES["gh CLI"]="PASS: gh CLI (authenticated)"
    fi
fi

# Ollama check
if ! command -v ollama &> /dev/null; then
    CHECKS["Ollama"]="WARN"
    MESSAGES["Ollama"]="WARN: Ollama is not installed. Not required for cloud-only use. Download from ollama.com."
else
    CHECKS["Ollama"]="PASS"
    MESSAGES["Ollama"]="PASS: Ollama ($(ollama --version))"
fi

# 2. JS dependencies (copernicus/node_modules)
echo "Checking JavaScript dependencies..."
if [[ ! -d "copernicus/node_modules" ]]; then
    echo "copernicus/node_modules not found. Installing JavaScript dependencies..."
    (cd copernicus && npm install --silent)
    CHECKS["JS Dependencies"]="PASS"
    MESSAGES["JS Dependencies"]="PASS: JavaScript dependencies installed."
else
    CHECKS["JS Dependencies"]="PASS"
    MESSAGES["JS Dependencies"]="PASS: copernicus/node_modules found. Skipping npm install."
fi

# 3. Python venv (backend/venv)
echo "Checking Python virtual environment..."
if [[ ! -d "backend/venv" ]]; then
    echo "backend/venv not found. Creating Python virtual environment..."
    python3 -m venv backend/venv
    backend/venv/bin/pip install -r backend/requirements.txt --quiet
    CHECKS["Python venv"]="PASS"
    MESSAGES["Python venv"]="PASS: Python virtual environment created and dependencies installed."
else
    CHECKS["Python venv"]="PASS"
    MESSAGES["Python venv"]="PASS: backend/venv found. Skipping venv creation."
fi

# 4. Config directory
echo "Checking configuration directory..."
CONFIG_DIR=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_DIR="$HOME/Library/Application Support/copernicus"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CONFIG_DIR="$HOME/.config/copernicus"
else
    CHECKS["Config Dir"]="FAIL"
    MESSAGES["Config Dir"]="FAIL: Unsupported OS type: $OSTYPE. Cannot determine config directory."
fi

if [[ -n "$CONFIG_DIR" ]]; then
    mkdir -p "$CONFIG_DIR"
    if [[ ! -f "$CONFIG_DIR/config.env" ]]; then
        cp .env.example "$CONFIG_DIR/config.env"
        CHECKS["Config Dir"]="PASS"
        MESSAGES["Config Dir"]="PASS: Config directory created. .env.example copied to $CONFIG_DIR/config.env."
        echo -e "${YELLOW}Edit $CONFIG_DIR/config.env to set OLLAMA_BASE_URL and other non-secret config.${NC}"
    else
        CHECKS["Config Dir"]="PASS"
        MESSAGES["Config Dir"]="PASS: Config directory and config.env found. Skipping copy."
    fi
fi

# 5. Secrets file
echo "Checking secrets file..."
if [[ ! -f "$HOME/.secrets" ]]; then
    cp secrets.example "$HOME/.secrets"
    CHECKS["Secrets File"]="WARN"
    MESSAGES["Secrets File"]="WARN: ~/.secrets not found. Copied secrets.example to $HOME/.secrets."
    echo -e "${RED}===================================================================${NC}"
    echo -e "${RED}!!! WARNING: Please edit $HOME/.secrets and fill in your API keys !!!${NC}"
    echo -e "${RED}===================================================================${NC}"
else
    CHECKS["Secrets File"]="PASS"
    MESSAGES["Secrets File"]="PASS: ~/.secrets found. Skipping."
fi

# Summary
echo -e "
${GREEN}Setup Summary:${NC}"
ANY_FAILURES=0
for check in "${!CHECKS[@]}"; do
    STATUS=${CHECKS[$check]}
    MESSAGE=${MESSAGES[$check]}
    if [[ "$STATUS" == "PASS" ]]; then
        echo -e "${GREEN}$MESSAGE${NC}"
    elif [[ "$STATUS" == "WARN" ]]; then
        echo -e "${YELLOW}$MESSAGE${NC}"
    elif [[ "$STATUS" == "FAIL" ]]; then
        echo -e "${RED}$MESSAGE${NC}"
        ANY_FAILURES=1
    fi
done

if [[ "$ANY_FAILURES" -eq 1 ]]; then
    echo -e "${RED}Setup completed with FAILURES. Please address the issues above.${NC}"
    exit 1
else
    echo -e "${GREEN}Setup completed successfully!${NC}"
    exit 0
fi
