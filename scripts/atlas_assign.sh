#!/bin/bash
# atlas_assign.sh
# Usage: ./scripts/atlas_assign.sh docs/stories/story_xxx.md
# Reads a local story file and sends its content to Google Jules as a task,
# specifically using ATLAS.md standards instead of the legacy CLAUDE.md.

STORY_PATH="$1"
EXTRA_NOTES="$2"

# 1. Validation
if [ -z "$STORY_PATH" ]; then
    echo "Usage: ./scripts/atlas_assign.sh <path_to_story_file> [optional_notes]"
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

# 3a. Inject ATLAS Standards (Context Injection)
STANDARDS_CONTEXT=""
if [ -f "atlas/ATLAS.md" ]; then
    echo "📋 Injecting atlas/ATLAS.md standards..."
    STANDARDS_CONTEXT="PROJECT STANDARDS & PATTERNS:
$(cat atlas/ATLAS.md)
"
fi

PROMPT="Act as a Senior Software Engineer specializing in Electron and React. Your task is to implement the following User Story for the ATLAS IDE.

${STANDARDS_CONTEXT}
CONTEXT & REQUIREMENTS:
$STORY_CONTENT

ADDITIONAL NOTES:
${EXTRA_NOTES:-"None"}

Please:
1. Analyze the requirements.
2. Plan the implementation.
3. Write the code and tests.
4. Verify the tests pass.
"

# 4. Fire and Forget
echo "🚀 Sending ATLAS task to Jules..."
jules new "$PROMPT"
