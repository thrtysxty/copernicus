#!/bin/bash
# jules_assign.sh
# Usage: ./jules_assign.sh docs/stories/story_032.md
# Reads a local story file and sends its content to Google Jules as a task.

STORY_PATH="$1"
EXTRA_NOTES="$2"

# 1. Validation
if [ -z "$STORY_PATH" ]; then
    echo "Usage: ./jules_assign.sh <path_to_story_file> [optional_notes]"
    exit 1
fi

if [ ! -f "$STORY_PATH" ]; then
    echo "❌ Error: Story file '$STORY_PATH' not found."
    exit 1
fi

# 2. Check for Jules CLI
if ! command -v jules &> /dev/null; then
    echo "❌ Error: 'jules' CLI is not installed or not in PATH."
    exit 1
fi

# 3. Construct the Prompt
echo "📖 Reading story from $STORY_PATH..."
STORY_CONTENT=$(cat "$STORY_PATH")

PROMPT="CONTEXT & REQUIREMENTS:
$STORY_CONTENT

ADDITIONAL NOTES:
${EXTRA_NOTES:-"None"}

Please implement this story according to your standard operating procedures."

# 4. Fire and Forget
echo "🚀 Sending task to Jules..."
jules new "$PROMPT"
