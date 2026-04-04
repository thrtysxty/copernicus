1. Update `copernicus/src/renderer/store/layout.ts`
  - Add `'knowledge-base'` to the `StoryboardView` union type.
2. Update `copernicus/src/renderer/components/layout/ActivityBar.tsx`
  - In the bottom tools section (`<!-- Bottom Tools -->`), change the Genesis icon from `FolderPlus` to `Wand2`.
  - Add the new Knowledge Base `NavItem` with `BookOpen` icon, `label="Knowledge Base"`, and `onClick` handler that calls `useLayoutStore.getState().setView('knowledge-base')`. Ensure it's placed between Genesis and Settings.
  - Remove the `FolderPlus` import and add `Wand2` and `BookOpen` imports from `lucide-react`.
3. Implement `copernicus/src/renderer/components/kb/KnowledgeBaseView.tsx`
  - Create a functional component `KnowledgeBaseView` that returns a two-column layout.
  - The left column should be a sidebar stub for the content tree.
  - The right column should be the main area stub for articles.
  - Include correct header chrome matching other views (e.g., using `bg-[#050505]`, `border-b border-white/5 bg-black/20`, etc., following patterns from `CommandCenter.tsx` or `CapexDashboard.tsx`).
4. Update `copernicus/src/renderer/App.tsx`
  - Import `KnowledgeBaseView`.
  - In the main content area, render `KnowledgeBaseView` when `activeView === 'knowledge-base'`.
5. Verify changes
  - Read `KnowledgeBaseView.tsx` and `App.tsx` contents to confirm edits.
6. Run tests/type checks
  - `cd copernicus && npx tsc --noEmit`
  - Run the relevant vitest suite: `cd copernicus && npx vitest run src/renderer/components/kb` (if exists or related).
7. Complete pre commit steps
  - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
8. Submit
  - Commit the changes with the message `feat(story-565): Add Knowledge Base view scaffold and activity bar entry`.
