const fs = require('fs');
let file = fs.readFileSync('copernicus/src/renderer/components/settings/TelemetryStatusTile.tsx', 'utf-8');

// I need to use `unwrapIpc` instead of `(res as any)` according to forbidden patterns.
// "unwrapIpc<T>(res)"
file = file.replace(
  "import { Activity } from 'lucide-react'",
  "import { Activity } from 'lucide-react'\nimport { unwrapIpc } from '../../types/ipc'"
);
file = file.replace(
  "const res = await invoke<TelemetryStatus>('telemetry:status')\n        if (mounted && (res as any).ok && (res as any).data) {\n          setStatus((res as any).data)\n        }",
  "const res = await invoke<TelemetryStatus>('telemetry:status')\n        if (mounted && (res as any).ok) {\n          setStatus(unwrapIpc<TelemetryStatus>(res as any))\n        }"
);
fs.writeFileSync('copernicus/src/renderer/components/settings/TelemetryStatusTile.tsx', file);
