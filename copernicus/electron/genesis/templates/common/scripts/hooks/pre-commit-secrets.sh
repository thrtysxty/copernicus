#!/bin/bash
# Pre-Commit Secret Scanner
# Sourced or executed during pre-commit to prevent secrets from entering git history.

if [ "${COPERNICUS_SKIP_SECRET_SCAN:-0}" = "1" ]; then
  echo "[INFO] Secret scan skipped due to COPERNICUS_SKIP_SECRET_SCAN=1"
  return 0 2>/dev/null || exit 0
fi

# We use grep with -E for extended regex
# Define hard block patterns
declare -a HARD_PATTERNS=(
  "sk-ant-[a-zA-Z0-9]{10,}"
  "sk-[a-zA-Z0-9]{20,}"
  "(ghp_[a-zA-Z0-9]{36}|gh[ous]_[a-zA-Z0-9]+|github_pat_[a-zA-Z0-9_]+)"
  "AKIA[A-Z0-9]{16}"
  "\-\-\-\-\-BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY\-\-\-\-\-"
  "sk_live_[a-zA-Z0-9]{24,}"
  "(xoxb-[a-zA-Z0-9-]{50,}|xoxp-[a-zA-Z0-9-]+)"
)

WARN_KEYWORD_PATTERN="(secret|password|token|key|api_key|SECRET|PASSWORD|TOKEN|KEY|API_KEY)"
WARN_ENTROPY_PATTERN="[A-Za-z0-9+/]{40,}={0,2}"

EXIT_CODE=0

# Use process substitution with a while loop to correctly handle files with spaces
while IFS= read -r FILE; do
  if [ -z "$FILE" ]; then
    continue
  fi

  # Exclude .example and .test* files
  if [[ "$FILE" == *".example" ]] || [[ "$FILE" == *".test"* ]]; then
    continue
  fi

  # Read file content from index to ensure we only scan what's staged
  # Use grep -n to get line numbers
  CONTENT=$(git show ":$FILE")

  # Check Hard Patterns
  for PATTERN in "${HARD_PATTERNS[@]}"; do
    MATCHES=$(echo "$CONTENT" | grep -n -E "$PATTERN" || true)
    if [ -n "$MATCHES" ]; then
      echo "[ERROR] Hard-block secret pattern matched in $FILE:"
      echo "$MATCHES" | while IFS= read -r line; do
        LINENO=$(echo "$line" | cut -d: -f1)
        # AC: exit 1 with filename + line number + matched pattern
        echo "  $FILE:$LINENO matches $PATTERN"
      done
      EXIT_CODE=1
    fi
  done

  # Check Soft Warn Patterns
  WARN_MATCHES=$(echo "$CONTENT" | grep -n -E "$WARN_KEYWORD_PATTERN.*$WARN_ENTROPY_PATTERN|$WARN_ENTROPY_PATTERN.*$WARN_KEYWORD_PATTERN" || true)
  if [ -n "$WARN_MATCHES" ]; then
    echo "$WARN_MATCHES" | while IFS= read -r line; do
      LINENO=$(echo "$line" | cut -d: -f1)
      echo "[WARN] possible secret at $FILE:$LINENO"
    done
  fi
done <<< "$(git diff --cached --name-only --diff-filter=ACM)"

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Commit blocked due to hard-coded secrets."
  echo "If this is intentional, you can bypass this check with: COPERNICUS_SKIP_SECRET_SCAN=1 git commit"
  exit 1
fi

return 0 2>/dev/null || exit 0
