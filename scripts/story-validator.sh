#!/bin/bash

# Usage: bash scripts/story-validator.sh <story_path>
# Calls python3 scripts/utils/story_validator.py "$1"
# Exits 0 on pass, 1 on any FAIL

STORY_PATH="$1"

if [ -z "$STORY_PATH" ]; then
  echo "Usage: bash scripts/story-validator.sh <story_path>"
  exit 1
fi

python3 scripts/utils/story_validator.py "$STORY_PATH"
EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "
$(tput setaf 2)Story validation passed.$(tput sgr0)" # Green
else
  echo -e "
$(tput setaf 1)Story validation failed. Please fix the errors.$(tput sgr0)" # Red
fi

exit "$EXIT_CODE"
