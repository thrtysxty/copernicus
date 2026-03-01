# User Story: Header & Layout Integrity Refinement (ID: 624)

## Actor
The End User and Developer.

## Goal
Resolve UI overflows in the application header and ensure consistent layout responsiveness across report views and window controls.

## Acceptance Criteria
- [ ] Stoplight window buttons (Close, Minimize, Zoom) do not overflow the left system tray or header row.
- [ ] Workflow links in the header are properly contained and do not overlap with stoplight buttons or other UI elements.
- [ ] Application header workflow buttons (e.g., Studio, Canvas, Chat) correctly open the expected pane arrangements.
- [ ] Report tabs fill the entire left-to-right width of the view before forcing vertical scrolling.
- [ ] Spotlight shrink/expand buttons are functional in all views, including the Editor and Canvas.
- [ ] Remove hard-coded UI elements (stories, values) from the Engine Room and replace them with live system data.
- [ ] Editor FOUC (Flash of Unstyled Content) fixed: Editor pane should load in dark mode immediately if the system is in dark mode, not white then dark.
- [ ] CapEx rate is consistent across the application ($65 set in wizard must show as $65, not $150).
- [ ] CMD+P button in the header is identified and its functionality is either implemented or documented/labeled.

## Documentation Impact
- Update `USER_GUIDE.md` to explain the CMD+P button functionality.
- Update `UI_GUIDELINES.md` to include standards for header overflow management and stoplight button positioning.
- Ensure `ENGINE_ROOM.md` reflects the dynamic data integration.

## Canonical Paths
- Main Header Component: `copernicus/src/renderer/components/Header.tsx` (Verify)
- Engine Room View: `copernicus/src/renderer/components/EngineRoom.tsx` (Verify)
- Report View: `copernicus/src/renderer/components/Reports.tsx` (Verify)
- CapEx State: `copernicus/src/renderer/store/settings.ts` (Verify)
