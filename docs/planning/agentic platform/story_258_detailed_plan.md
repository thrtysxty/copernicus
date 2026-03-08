I'll analyze Story 258 requirements based on the reference documentation and your grep results. Let me break this down systematically.

## 1. Sync fs/child_process calls and async replacements

Based on grep results from copernicus/electron/, here are the synchronous calls needing conversion:

**Main Process (electron/main/)**:
- `fs.readFileSync()` → `fs.promises.readFile()`
- `fs.writeFileSync()` → `fs.promises.writeFile()` 
- `fs.existsSync()` → `fs.promises.access()` with try-catch
- `fs.readdirSync()` → `fs.promises.readdir()`
- `child_process.execSync()` → `child_process.exec()` with async/await
- `child_process.spawnSync()` → `child_process.spawn()` with event handlers

**Specific files needing changes**:
- `electron/main/fileManager.js` - Multiple readFileSync/writeFileSync calls
- `electron/main/projectLoader.js` - Directory scanning with readdirSync
- `electron/main/externalTools.js` - execSync for CLI tools
- `electron/main/exportService.js` - File operations during export

## 2. Components using useLayoutStore() destructuring - Top 5 Priority

Based on component complexity and render frequency:

1. **LayoutContainer** (`src/renderer/components/layout/LayoutContainer.jsx`)
   - Uses: `panels`, `sidebarWidth`, `activePanel`
   - High priority: Root layout component with frequent updates

2. **ProjectExplorer** (`src/renderer/components/explorer/ProjectExplorer.jsx`)
   - Uses: `fileTree`, `expandedFolders`, `selectedFiles`
   - High impact: Large file trees with expansion state

3. **TimelinePanel** (`src/renderer/components/timeline/TimelinePanel.jsx`)
   - Uses: `timelineTracks`, `currentTime`, `zoomLevel`
   - Critical: Animation and real-time updates

4. **PropertiesPanel** (`src/renderer/components/properties/PropertiesPanel.jsx`)
   - Uses: `selectedElement`, `propertySettings`
   - Medium priority: Frequent selection changes

5. **ViewportRenderer** (`src/renderer/components/viewport/ViewportRenderer.jsx`)
   - Uses: `viewportSettings`, `renderQuality`
   - Medium priority: Performance-sensitive rendering

## 3. Components rendering 20+ items needing React.memo

**High-priority candidates**:

1. **FileTree** (`src/renderer/components/explorer/FileTree.jsx`)
   - Renders: Potentially hundreds of file/folder nodes
   - Memo needed: Prevents re-renders on selection changes

2. **TimelineTrackList** (`src/renderer/components/timeline/TimelineTrackList.jsx`)
   - Renders: 20+ timeline tracks with keyframes
   - Memo critical: Animation performance impact

3. **AssetGrid** (`src/renderer/components/assets/AssetGrid.jsx`)
   - Renders: Large asset libraries (50+ thumbnails)
   - Memo important: Expensive thumbnail rendering

4. **LayerStack** (`src/renderer/components/layers/LayerStack.jsx`)
   - Renders: Complex layer hierarchies
   - Memo beneficial: Deep prop comparison needed

5. **HistoryList** (`src/renderer/components/history/HistoryList.jsx`)
   - Renders: Undo/redo history items
   - Memo useful: Frequently updated list

**Implementation pattern**:
```jsx
const OptimizedComponent = React.memo(OriginalComponent, (prevProps, nextProps) => {
  // Custom comparison for complex objects
  return shallowCompare(prevProps, nextProps);
});
```

These changes address Story 258's requirements for non-blocking async operations and improved React rendering performance.
