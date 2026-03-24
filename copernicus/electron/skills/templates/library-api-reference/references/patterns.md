# IPC Request / Response Patterns

Below are common patterns for making IPC calls and handling their responses using TypeScript in the {{PROJECT_NAME}} project.

## Standard IPC Invoke with Envelope Unwrapping

When calling from the renderer to the main process:

```typescript
import { useIpcError } from '../hooks/useIpcError';
import { unwrapIpc } from '../types/ipc';

async function fetchStories() {
  const invoke = useIpcError();
  const result = await invoke<Story[]>('stories:list');
  
  // ALWAYS check result.ok first
  if (!result.ok) {
    // Error is handled implicitly by useIpcError hook (toast),
    // but we still need to exit early here
    return;
  }
  
  // Unwrap the actual data
  const stories = unwrapIpc<Story[]>(result);
  
  // Use the data safely
  console.log(stories.length);
}
```

## Main Process IPC Handler with `handleIpc`

When exposing functionality in `main.ts`:

```typescript
import { ipcMain } from 'electron';
import { handleIpc } from './utils/handle-ipc';
import { StoriesManager } from './stories';

export function registerStoriesHandlers(manager: StoriesManager) {
  // Wrap the async or sync logic in handleIpc to return an { ok, data, error } envelope
  ipcMain.handle('stories:list', (_event) => 
    handleIpc(() => manager.listStories())
  );
  
  // For calls with arguments
  ipcMain.handle('stories:create', (_event, title: string) => 
    handleIpc(() => manager.createStory(title))
  );
}
```
