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

# 3a. Inject Project Standards (Context Injection)
STANDARDS_CONTEXT=""
if [ -f "CLAUDE.md" ]; then
    echo "📋 Injecting CLAUDE.md standards..."
    STANDARDS_CONTEXT="PROJECT STANDARDS & PATTERNS:
$(cat CLAUDE.md)
"
fi

if [ -f "DESIGN_SYSTEM.md" ]; then
    echo "🎨 Injecting DESIGN_SYSTEM.md styles..."
    STANDARDS_CONTEXT="${STANDARDS_CONTEXT}
VISUAL DESIGN SYSTEM:
$(cat DESIGN_SYSTEM.md)
"
fi

PROMPT="Act as a Senior Software Engineer. Your task is to implement the following User Story.

${STANDARDS_CONTEXT}
CONTEXT & REQUIREMENTS:
$STORY_CONTENT

ADDITIONAL NOTES:
${EXTRA_NOTES:-"None"}

Please:
1. Analyze the requirements.
2. Plan the implementation.
3. Write the code and tests.
4. Verify the tests pass."

# 4. Fire and Forget
echo "🚀 Sending task to Jules..."
jules new "$PROMPT"
