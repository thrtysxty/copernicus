#!/bin/bash
set -e
cd /Users/dadmin/Projects/copernicus
echo "=== Merging PR 393 (story 727: worktree handler tests) ==="
gh pr ready 393 --repo JMThiessen/Copernicus
gh pr merge 393 --repo JMThiessen/Copernicus --squash --delete-branch
echo ""
echo "=== Pushing main (stories 729-731) ==="
git push origin main
echo "=== Done ==="
