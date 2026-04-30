#!/bin/bash
# Install Pre-Commit Hooks

HOOK_DIR=".git/hooks"
PRE_COMMIT_HOOK="$HOOK_DIR/pre-commit"
SCANNER_SCRIPT="scripts/hooks/pre-commit-secrets.sh"

if [ ! -d "$HOOK_DIR" ]; then
    echo "Error: .git/hooks directory not found. Are you in the root of a git repository?"
    exit 1
fi

if [ ! -f "$SCANNER_SCRIPT" ]; then
    echo "Error: $SCANNER_SCRIPT not found."
    exit 1
fi

# Create pre-commit hook if it doesn't exist
if [ ! -f "$PRE_COMMIT_HOOK" ]; then
    echo "#!/bin/bash" > "$PRE_COMMIT_HOOK"
    chmod +x "$PRE_COMMIT_HOOK"
    echo "Created new $PRE_COMMIT_HOOK"
fi

# Idempotently add the scanner to the hook
SOURCE_LINE="source $SCANNER_SCRIPT"

if grep -qF "$SOURCE_LINE" "$PRE_COMMIT_HOOK"; then
    echo "Secret scanner already installed in pre-commit hook."
else
    # Insert it right after the shebang so it runs first in a cross-platform way
    # Save the first line (shebang)
    head -n 1 "$PRE_COMMIT_HOOK" > "$PRE_COMMIT_HOOK.tmp"
    # Append the source line
    echo "$SOURCE_LINE" >> "$PRE_COMMIT_HOOK.tmp"
    # Append the rest of the original file
    tail -n +2 "$PRE_COMMIT_HOOK" >> "$PRE_COMMIT_HOOK.tmp"

    mv "$PRE_COMMIT_HOOK.tmp" "$PRE_COMMIT_HOOK"
    chmod +x "$PRE_COMMIT_HOOK"

    echo "Installed secret scanner in pre-commit hook."
fi

# If test script exists, make sure it's executable
if [ -f "scripts/hooks/test-secret-scanner.sh" ]; then
    chmod +x "scripts/hooks/test-secret-scanner.sh"
fi

echo "Done."
