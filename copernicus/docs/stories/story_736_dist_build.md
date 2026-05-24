# story_736: DMG Build Gate

**Status:** READY
**Priority:** P1 — RC artifact

## Narrative
**As a** Copernicus releaser,
**I want** `make dist` to produce a mountable DMG,
**So that** we have a concrete release artifact to hand users.

## Context

Electron apps use electron-builder to produce platform-native packages.
This story adds electron-builder config and the `make dist` target.
The gate verifies the DMG is produced and mountable — not that it runs correctly
(that's the smoke test in story_737).

## Acceptance Criteria

### electron-builder Config
1. `electron-builder.yml` or `build` section in `package.json` configures:
   - `appId: "dev.thrtysxty.copernicus"`
   - `productName: "Copernicus"`
   - `mac.target: "dmg"`
   - `directories.output: "dist"` (or `release/`)
2. `package.json` has `"dist": "electron-builder --mac"` in `scripts`

### Makefile
3. `make dist` target:
   ```
   dist:
       npm run dist
   ```

### Gate
4. `make dist` completes without error
5. A `.dmg` file exists in `dist/` or `release/` after build
6. `hdiutil imageinfo dist/*.dmg` exits 0 (valid disk image)

## Files in Scope
- `electron-builder.yml` (new) OR `package.json` build section
- `Makefile` (add `dist` target)

## Frozen Surfaces
- `package.json` scripts other than adding `dist`
- Existing `make dev`, `make test`, `make tsc` targets

## Blocked By
- None

## Blocks
- story_737 (RC gate)

## Gate
```
make dist 2>&1 | tail -5 && hdiutil imageinfo dist/*.dmg 2>&1 | grep "Format:" | head -1
```

## Definition of Done
- [ ] electron-builder config written
- [ ] `make dist` exits 0
- [ ] `.dmg` file exists
- [ ] `hdiutil imageinfo` confirms valid image
