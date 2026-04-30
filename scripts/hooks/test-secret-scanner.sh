#!/bin/bash
# Test Script for Pre-Commit Secret Scanner

set -e

# Create a temporary directory and git repo
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

git init >/dev/null 2>&1
git config user.name "Test User"
git config user.email "test@example.com"

# Copy the scanner script
mkdir -p scripts/hooks
# Assuming this test script runs from the repository root
if [ -f "$OLDPWD/scripts/hooks/pre-commit-secrets.sh" ]; then
    cp "$OLDPWD/scripts/hooks/pre-commit-secrets.sh" scripts/hooks/
else
    echo "FAIL: Cannot find pre-commit-secrets.sh"
    exit 1
fi

SCANNER="./scripts/hooks/pre-commit-secrets.sh"
FAIL_COUNT=0

function run_test() {
    local NAME=$1
    local CONTENT=$2
    local EXPECTED_EXIT=$3
    local FILENAME=${4:-"testfile.txt"}
    local ENV_VAR=${5:-""}

    echo "$CONTENT" > "$FILENAME"
    git add "$FILENAME"

    set +e
    if [ -n "$ENV_VAR" ]; then
        eval "$ENV_VAR" $SCANNER > /dev/null 2>&1
    else
        $SCANNER > /dev/null 2>&1
    fi
    local ACTUAL_EXIT=$?
    set -e

    git rm -f --cached "$FILENAME" >/dev/null 2>&1

    if [ $ACTUAL_EXIT -eq $EXPECTED_EXIT ]; then
        echo "PASS: $NAME"
    else
        echo "FAIL: $NAME (Expected $EXPECTED_EXIT, got $ACTUAL_EXIT)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo "Running Pre-Commit Secret Scanner Tests..."

# 1. Anthropic API keys
run_test "Anthropic Key" "const key = 'sk-ant-1234567890abcdef';" 1

# 2. OpenAI / generic sk- keys
run_test "OpenAI Key" "OPENAI_KEY=sk-12345678901234567890abcdef;" 1

# 3. GitHub tokens
run_test "GitHub Token (ghp)" "token = 'ghp_123456789012345678901234567890123456';" 1
run_test "GitHub Token (gho)" "token = 'gho_12345678901234567890';" 1

# 4. AWS access keys
run_test "AWS Key" "aws_access_key_id = AKIAIOSFODNN7EXAMPLE" 1

# 5. Private key material
run_test "RSA Private Key" "-----BEGIN RSA PRIVATE KEY-----" 1
run_test "OpenSSH Private Key" "-----BEGIN OPENSSH PRIVATE KEY-----" 1

# 6. Stripe keys
run_test "Stripe Live Key" "stripe_sk = 'sk_live_123456789012345678901234567890';" 1
run_test "Stripe Test Key (Should Pass)" "stripe_sk = 'sk_test_123456789012345678901234567890';" 0

# 7. Slack tokens
run_test "Slack Bot Token" "slack = 'xoxb-123456789012-1234567890123-123456789012345678901234';" 1
run_test "Slack User Token" "slack = 'xoxp-123456789012-1234567890123-1234567890123-123456789012345678901234';" 1

# 8. Clean file
run_test "Clean File" "console.log('Hello World');" 0

# 9. Exemption: .env.example
run_test "Exemption: .env.example" "ANTHROPIC_API_KEY=sk-ant-dummy" 0 ".env.example"

# 10. Exemption: .env.test
run_test "Exemption: .env.test" "ANTHROPIC_API_KEY=sk-ant-dummy" 0 ".env.test"

# 11. Override env var
run_test "Override Env Var" "const key = 'sk-ant-1234567890abcdef';" 0 "testfile.txt" "COPERNICUS_SKIP_SECRET_SCAN=1"

# 12. Warn Pattern (Soft Warn) -> Should exit 0
run_test "Soft Warn Pattern" "const secret = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';" 0

if [ $FAIL_COUNT -eq 0 ]; then
    echo "All tests passed."
    exit 0
else
    echo "$FAIL_COUNT tests failed."
    exit 1
fi
