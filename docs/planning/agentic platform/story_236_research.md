I'll analyze the codebase to identify the specific files and lines that need `data-testid` attributes and plan the Playwright tests.

## Analysis Results

### Files and Lines Requiring `data-testid` Attributes

#### 1. ActivityBar.tsx (Navigation Icons)
```
copernicus/src/renderer/components/layout/ActivityBar.tsx
```

Locations for `data-testid` attributes:
- Line ~45: Explorer icon button - `data-testid="activity-bar-explorer"`
- Line ~55: Search icon button - `data-testid="activity-bar-search"`
- Line ~65: Source Control icon button - `data-testid="activity-bar-source-control"`
- Line ~75: Debug icon button - `data-testid="activity-bar-debug"`
- Line ~85: Settings icon button - `data-testid="activity-bar-settings"`

#### 2. KanbanBoard.tsx (Columns and +New Story Button)
```
copernicus/src/renderer/components/stories/KanbanBoard.tsx
```

Locations for `data-testid` attributes:
- Line ~120: Backlog column - `data-testid="kanban-column-backlog"`
- Line ~125: In Progress column - `data-testid="kanban-column-inprogress"`
- Line ~130: Review column - `data-testid="kanban-column-review"`
- Line ~135: Done column - `data-testid="kanban-column-done"`
- Line ~35: +New Story button - `data-testid="kanban-new-story-button"`

#### 3. StoryDetail.tsx (Title/Description Inputs)
```
copernicus/src/renderer/components/stories/StoryDetail.tsx
```

Locations for `data-testid` attributes:
- Line ~80: Title input field - `data-testid="story-title-input"`
- Line ~95: Description textarea - `data-testid="story-description-input"`

#### 4. MonacoEditor.tsx (Monaco Container)
```
copernicus/src/renderer/components/editor/MonacoEditor.tsx
```

Locations for `data-testid` attributes:
- Line ~25: Monaco editor container - `data-testid="monaco-editor-container"`

#### 5. ChatPanel.tsx (Chat Input and Send Button)
```
copernicus/src/renderer/components/chat/ChatPanel.tsx
```

Locations for `data-testid` attributes:
- Line ~45: Chat input field - `data-testid="chat-input"`
- Line ~55: Send message button - `data-testid="chat-send-button"`

## Playwright Test Plans

### Story Lifecycle Test Plan

```typescript
// tests/story-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Story Lifecycle', () => {
  test('should create, edit, and complete a story', async ({ page }) => {
    // 1. Navigate to application
    await page.goto('/');
    
    // 2. Create new story
    await page.click('[data-testid="kanban-new-story-button"]');
    
    // 3. Fill story details
    await page.fill('[data-testid="story-title-input"]', 'Test Story Title');
    await page.fill('[data-testid="story-description-input"]', 'Test Story Description');
    await page.click('button:has-text("Save")');
    
    // 4. Verify story appears in Backlog
    await expect(page.locator('[data-testid="kanban-column-backlog"]'))
      .toContainText('Test Story Title');
    
    // 5. Move story to In Progress
    // Drag & drop or click "Start" button
    await page.dragAndDrop(
      'text=Test Story Title',
      '[data-testid="kanban-column-inprogress"]'
    );
    
    // 6. Verify story moved
    await expect(page.locator('[data-testid="kanban-column-inprogress"]'))
      .toContainText('Test Story Title');
    
    // 7. Open story details and edit
    await page.click('text=Test Story Title');
    await page.fill('[data-testid="story-title-input"]', 'Updated Story Title');
    await page.click('button:has-text("Save")');
    
    // 8. Move through remaining columns
    await page.dragAndDrop(
      'text=Updated Story Title',
      '[data-testid="kanban-column-review"]'
    );
    await page.dragAndDrop(
      'text=Updated Story Title',
      '[data-testid="kanban-column-done"]'
    );
    
    // 9. Verify completion
    await expect(page.locator('[data-testid="kanban-column-done"]'))
      .toContainText('Updated Story Title');
  });

  test('should use Monaco editor for story content', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="activity-bar-explorer"]');
    
    // Verify Monaco editor is present
    await expect(page.locator('[data-testid="monaco-editor-container"]'))
      .toBeVisible();
  });
});
```

### Onboarding Wizard Test Plan

```typescript
// tests/onboarding-wizard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard', () => {
  test('should complete onboarding flow', async ({ page }) => {
    await page.goto('/');
    
    // 1. Verify wizard starts automatically for new users
    await expect(page.locator('text=Welcome to Copernicus'))
      .toBeVisible();
    
    // 2. Step through wizard pages
    await page.click('button:has-text("Next")');
    await expect(page.locator('text=Project Setup'))
      .toBeVisible();
    
    // 3. Fill project details
    await page.fill('input[name="projectName"]', 'Test Project');
    await page.click('button:has-text("Next")');
    
    // 4. Test AI configuration
    await expect(page.locator('text=AI Assistant Setup'))
      .toBeVisible();
    await page.click('button:has-text("Skip")');
    
    // 5. Complete wizard
    await page.click('button:has-text("Finish")');
    
    // 6. Verify normal application loads
    await expect(page.locator('[data-testid="activity-bar-explorer"]'))
      .toBeVisible();
  });

  test('should test chat functionality', async ({ page }) => {
    await page.goto('/');
    
    // 1. Open chat panel
    await page.click('[data-testid="activity-bar-chat"]');
    
    // 2. Send message
    await page.fill('[data-testid="chat-input"]', 'Help me create a user story');
    await page.click('[data-testid="chat-send-button"]');
    
    // 3. Verify response
    await expect(page.locator('.chat-message:last-child'))
      .toContainText(/story|user|create/i);
    
    // 4. Test navigation integration
    await page.click('[data-testid="activity-bar-explorer"]');
    await expect(page.locator('[data-testid="kanban-new-story-button"]'))
      .toBeVisible();
  });
});
```

### Additional Test Files

```typescript
// tests/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between activity bar sections', async ({ page }) => {
    await page.goto('/');
    
    const sections = [
      { testid: 'activity-bar-explorer', content: 'Stories' },
      { testid: 'activity-bar-search', content: 'Search' },
      { testid: 'activity-bar-source-control', content: 'Source Control' },
      { testid: 'activity-bar-debug', content: 'Debug' },
      { testid: 'activity-bar-settings', content: 'Settings' }
    ];
    
    for (const section of sections) {
      await page.click(`[data-testid="${section.testid}"]`);
      await expect(page.locator(`text=${section.content}`)).toBeVisible();
    }
  });
});
```

## Implementation Notes

1. **Backend API Testing**: The Python backend (`backend/api/llm.py`) should have corresponding API tests for story CRUD operations
2. **Test Data**: Use test-specific data and cleanup mechanisms
3. **CI/CD Integration**: Configure these tests to run in your CI/CD pipeline
4. **Visual Testing**: Consider adding visual regression tests for critical UI components

The `data-testid` attributes provide stable selectors that won't break with CSS or text content changes, making the tests more robust.
