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

# 3a. Inject Persona & Standards (Context Injection)
PERSONA_CONTEXT=""
if [ -f "docs/personas/08_jules.md" ]; then
    echo "🤖 Injecting Jules Persona..."
    PERSONA_CONTEXT="YOUR PERSONA & ROLE:
$(cat docs/personas/08_jules.md)
"
fi

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

PROMPT="${PERSONA_CONTEXT}

${STANDARDS_CONTEXT}

CONTEXT & REQUIREMENTS:
$STORY_CONTENT

ADDITIONAL NOTES:
${EXTRA_NOTES:-"None"}

Please follow your persona instructions and the project standards to implement this story. Your implementation is not 'Done' until it is build-verified, tested, and documented per the industrial pipeline."

# 4. Fire and Forget
echo "🚀 Sending task to Jules..."
jules new "$PROMPT"
