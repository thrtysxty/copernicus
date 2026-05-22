#!/bin/bash
set -e
cd /Users/dadmin/Projects/copernicus
git pull origin main
gh pr ready 395 --repo JMThiessen/Copernicus
gh pr merge 395 --repo JMThiessen/Copernicus --squash --delete-branch
git pull origin main
echo DONE
