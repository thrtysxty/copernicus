#!/bin/bash
# Jules assignment script
# Usage: jules_assign.sh docs/stories/story_NNN.md

if [ $# -ne 1 ]; then
    echo "Usage: $0 <story_file>"
    exit 1
fi

STORY_FILE="$1"

if [ ! -f "$STORY_FILE" ]; then
    echo "Error: Story file not found: $STORY_FILE"
    exit 1
fi

# Dispatch to Jules
STORY_NAME=$(basename "$STORY_FILE" .md)
echo "Dispatching to Jules: $STORY_NAME"
echo "Story file: $STORY_FILE"

# In production, this would call the Jules API
# curl -X POST http://localhost:8080/api/assign \
#   -H "Content-Type: application/json" \
#   -d "{\"story_file\": \"$STORY_FILE\", \"story_name\": \"$STORY_NAME\"}"

echo "Jules assignment started for: $STORY_NAME"
exit 0