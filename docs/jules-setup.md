# Jules Environment Setup

This document records the snapshot configuration for the Jules coding agent in this repository.

## Initial Setup Script
The following script was used to capture the environment snapshot in the Jules web UI:

```bash
# Verify Node version
node -v

# Install dependencies
cd copernicus && npm install

# Verify TypeScript compiles
npx tsc --noEmit

echo "Environment ready."
```

## Captured Environment
- **Node.js**: v22.4.0 (captured from host)
- **npm**: v10.x
- **OS**: Linux (Jules VM default)
- **Snapshot ID**: `snap_20260228_ide_core` (example)

## Verification Command
Jules is configured to run `cd copernicus && npx tsc --noEmit` to verify its changes. If this command exits with code 0, the task is considered successful.
