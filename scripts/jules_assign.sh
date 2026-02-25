#!/bin/bash
# jules_assign.sh
# Usage: ./jules_assign.sh [--as bolt|palette|sentinel] docs/stories/story_032.md
# Reads a local story file and sends its content to Google Jules as a task.

STORY_PATH=""
EXTRA_NOTES=""
IDENTITY_HEADER=""

# 1. Parse Arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --as)
            case $2 in
                bolt) IDENTITY_HEADER="IDENTITY OVERLAY: BOLT ⚡ (Performance Mode)\nMandate: Algorithmic efficiency, O(1) optimization, and RAM minimization.\n" ;;
                palette) IDENTITY_HEADER="IDENTITY OVERLAY: PALETTE 🎨 (UX/DX Mode)\nMandate: Visual precision, Professional Phosphor adherence, and interactive delight.\n" ;;
                sentinel) IDENTITY_HEADER="IDENTITY OVERLAY: SENTINEL 🛡️ (Security Mode)\nMandate: Hardening, secret detection, and vulnerability mitigation.\n" ;;
                *) echo "❌ Error: Unknown identity '$2'. Use bolt, palette, or sentinel." ; exit 1 ;;
            esac
            shift ;;
        *) 
            if [ -z "$STORY_PATH" ]; then
                STORY_PATH="$1"
            else
                EXTRA_NOTES="$1"
            fi
            ;;
    esac
    shift
done

# 2. Validation
if [ -z "$STORY_PATH" ]; then
    echo "Usage: ./jules_assign.sh [--as bolt|palette|sentinel] <path_to_story_file> [optional_notes]"
    exit 1
fi

if [ ! -f "$STORY_PATH" ]; then
    echo "❌ Error: Story file '$STORY_PATH' not found."
    exit 1
fi

# 3. Check for Jules CLI
if ! command -v jules &> /dev/null; then
    echo "❌ Error: 'jules' CLI is not installed or not in PATH."
    exit 1
fi

# 4. Construct the Prompt
echo "📖 Reading story from $STORY_PATH..."
STORY_CONTENT=$(cat "$STORY_PATH")

PROMPT="$IDENTITY_HEADER
CONTEXT & REQUIREMENTS:
$STORY_CONTENT

ADDITIONAL NOTES:
${EXTRA_NOTES:-"None"}

Please implement this story according to your standard operating procedures."

# 5. Fire and Forget
echo "🚀 Sending task to Jules..."
jules new "$PROMPT"
